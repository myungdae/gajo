import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  REGIONAL_CANDIDATE_DATASETS,
  RegionalCandidateRecord,
} from '../regions/regional-candidate.registry';
import { HAPCHEON_MASTER_DATA } from '../regions/hapcheon/master-data';
import {
  RegionalDataRecord,
  RegionalDataRecordDocument,
} from './regional-data.schema';
const SOURCE_TYPES = new Set([
  'OFFICIAL_LOCAL_GOV',
  'OFFICIAL_BUSINESS',
  'KTO',
  'OFFICIAL_MAP_LISTING',
  'OTHER_VERIFIED_SOURCE',
]);
const TRANSFER_SCHEMA_VERSION='1.0';
const ENTITY_TYPES=new Set(['ATTRACTION','CAFE','ACCOMMODATION','RESTAURANT','EXPERIENCE','EVENT','FACILITY','ACTIVITY','AREA','CULTURAL_AREA','MARKET','SHOPPING_AREA','OTHER']);
const TRANSFER_FIELDS=['displayName','entityType','category','tags','areaLabel','address','latitude','longitude','phone','websiteUrl','reservationUrl','operatingHours','shortDescription'] as const;
@Injectable()
export class RegionalDataService implements OnModuleInit {
  constructor(
    @InjectModel(RegionalDataRecord.name)
    private model: Model<RegionalDataRecordDocument>,
  ) {}
  async onModuleInit() {
    for (const item of HAPCHEON_MASTER_DATA) {
      await this.model.updateOne(
        { canonicalEntityId: item.entityUri, regionId: 'hapcheon' },
        {
          $setOnInsert: {
            id: `seed-${item.canonicalId}`,
            canonicalEntityId: item.entityUri,
            regionId: 'hapcheon',
            displayName: item.canonicalLabelKo,
            entityType: item.entityType,
            category: item.category,
            address: item.address,
            latitude: item.latitude,
            longitude: item.longitude,
            phone: item.telephone,
            websiteUrl: item.website,
            reservationUrl: item.reservationUrl,
            shortDescription: item.description,
            source: item.source,
            lastVerifiedAt: item.lastVerifiedAt,
            verificationStatus: 'VERIFIED',
            lifecycleStatus: 'ACTIVE',
            auditTrail: [
              {
                action: 'BASELINE_SEEDED',
                at: new Date().toISOString(),
                source: item.source,
              },
            ],
          },
        },
        { upsert: true },
      );
    }
  }
  async list(filters: any = {}) {
    const query = Object.fromEntries(
      [
        'regionId',
        'lifecycleStatus',
        'entityType',
        'verificationStatus',
      ].flatMap((key) => (filters[key] ? [[key, filters[key]]] : [])),
    );
    return this.model.find(query).sort({ regionId: 1, displayName: 1 }).lean();
  }
  async create(input: any) {
    if (
      !input.regionId ||
      !input.source?.sourceType ||
      !input.source?.sourceUrl ||
      !input.proposedFacts?.displayName
    )
      throw new BadRequestException(
        'regionId, source and proposedFacts.displayName are required',
      );
    if (!SOURCE_TYPES.has(input.source.sourceType))
      throw new BadRequestException('Unsupported sourceType');
    const canonical =
      input.canonicalEntityId ||
      `urn:regional-candidate:${input.regionId}:${randomUUID()}`;
    const baseline = this.baseline(input.regionId, canonical);
    const existing: any = await this.model.findOne({
      canonicalEntityId: canonical,
      regionId: input.regionId,
    });
    if (existing) {
      const current = this.toCandidate(baseline, existing);
      existing.source = input.source;
      existing.proposedFacts = input.proposedFacts;
      existing.detectedChanges = this.diff(current, input.proposedFacts);
      existing.lifecycleStatus = existing.verificationStatus === 'VERIFIED'
        ? 'CHANGE_DETECTED'
        : 'NEW_CANDIDATE';
      existing.auditTrail.push({
        action: existing.verificationStatus === 'VERIFIED'
          ? 'CHANGE_DETECTED'
          : 'CANDIDATE_UPDATED',
        at: new Date().toISOString(),
        source: input.source,
        changes: existing.detectedChanges,
      });
      await existing.save();
      return existing.toObject();
    }
    return this.model.create({
      id: `rd-${randomUUID()}`,
      canonicalEntityId: canonical,
      regionId: input.regionId,
      displayName: input.proposedFacts.displayName,
      entityType: input.proposedFacts.entityType,
      category: input.proposedFacts.category,
      source: input.source,
      proposedFacts: input.proposedFacts,
      verificationStatus: 'UNVERIFIED',
      lifecycleStatus: baseline ? 'CHANGE_DETECTED' : 'NEW_CANDIDATE',
      detectedChanges: this.diff(baseline, input.proposedFacts),
      auditTrail: [
        {
          action: baseline ? 'CHANGE_DETECTED' : 'CANDIDATE_CREATED',
          at: new Date().toISOString(),
          source: input.source,
        },
      ],
    });
  }
  async action(
    id: string,
    action: string,
    editedFacts?: Record<string, unknown>,
  ) {
    const row: any = await this.model.findOne({ id });
    if (!row) throw new NotFoundException();
    const facts = { ...(row.proposedFacts || {}), ...(editedFacts || {}) };
    const auditedChanges=[...(row.detectedChanges||[])];
    if (['APPROVE', 'APPLY_CHANGE', 'APPROVE_EDITED'].includes(action)) {
      if (!row.source?.sourceUrl || !SOURCE_TYPES.has(row.source?.sourceType))
        throw new BadRequestException('Verified provenance is required');
      Object.assign(row, this.factFields(facts), {
        proposedFacts: facts,
        verificationStatus: 'VERIFIED',
        lifecycleStatus: 'ACTIVE',
        lastVerifiedAt: new Date().toISOString(),
        detectedChanges: [],
      });
    } else if (action === 'HOLD' || action === 'REVERIFY')
      Object.assign(row, {
        lifecycleStatus: 'NEEDS_VERIFICATION',
        verificationStatus: 'REVERIFY_REQUIRED',
      });
    else if (action === 'REJECT') row.lifecycleStatus = 'REJECTED';
    else if (action === 'STOP') row.lifecycleStatus = 'ARCHIVED';
    else if (action === 'IGNORE_CHANGE')
      Object.assign(row, {
        lifecycleStatus: 'ACTIVE',
        detectedChanges: [],
        proposedFacts: undefined,
      });
    else throw new BadRequestException('Unsupported action');
    row.auditTrail.push({
      action,
      at: new Date().toISOString(),
      source: row.source,
      changes: auditedChanges,
    });
    await row.save();
    return row.toObject();
  }
  async effectiveDataset(regionId: string) {
    const base = REGIONAL_CANDIDATE_DATASETS[regionId];
    if (!base) return undefined;
    const regionalRows: any[] = await this.model.find({ regionId }).lean();
    const overrides = regionalRows.filter(
      (row) => row.verificationStatus === 'VERIFIED' &&
        ['ACTIVE', 'CHANGE_DETECTED'].includes(row.lifecycleStatus),
    );
    const questionable:any[]=await this.model.find({regionId,lifecycleStatus:'CHANGE_DETECTED'}).lean();
    const records = [...base.records];
    for (const row of overrides) {
      const index = records.findIndex(
        (item) => item.entityUri === row.canonicalEntityId,
      );
      const merged = this.toCandidate(
        index >= 0 ? records[index] : undefined,
        row,
      );
      if (index >= 0) records[index] = merged;
      else records.push(merged);
    }
    for(const row of questionable.filter(row=>row.detectedChanges?.some((change:any)=>change.unsafe))){const index=records.findIndex(item=>item.entityUri===row.canonicalEntityId);if(index<0)continue;const actions={...(records[index].actions||{})}as any;delete actions.navigate;records[index]={...records[index],latitude:undefined,longitude:undefined,actions}}
    return { ...base, records };
  }
  async quality() {
    const rows: any[] = await this.model.find().lean();
    const active = rows.filter((x) => x.lifecycleStatus === 'ACTIVE');
    return {
      totalActive: active.length,
      awaitingVerification: rows.filter((x) =>
        ['NEW_CANDIDATE', 'NEEDS_VERIFICATION'].includes(x.lifecycleStatus),
      ).length,
      needsReverification: rows.filter(
        (x) => x.verificationStatus === 'REVERIFY_REQUIRED',
      ).length,
      changeDetected: rows.filter(
        (x) => x.lifecycleStatus === 'CHANGE_DETECTED',
      ).length,
      missingCoordinates: active.filter(
        (x) => !Number.isFinite(x.latitude) || !Number.isFinite(x.longitude),
      ).length,
      missingPhone: active.filter((x) => !x.phone).length,
      missingActions: active.filter(
        (x) =>
          !x.websiteUrl &&
          !x.reservationUrl &&
          !x.phone &&
          !Number.isFinite(x.latitude),
      ).length,
    };
  }
  async exportPackage(regionId:string,options:{includeChanges?:boolean;backup?:boolean}={}){
    if(!REGIONAL_CANDIDATE_DATASETS[regionId])throw new BadRequestException('Unsupported regionId');
    const rows:any[]=await this.model.find({regionId}).lean();
    const eligible=rows.filter(row=>options.backup?true:(row.verificationStatus==='VERIFIED'&&(row.lifecycleStatus==='ACTIVE'||(options.includeChanges&&row.lifecycleStatus==='CHANGE_DETECTED'))));
    const exportedAt=new Date().toISOString(),exportId=`regional-export-${randomUUID()}`;
    const packageValue={packageType:'REGIONAL_OPERATIONAL_DATA',schemaVersion:TRANSFER_SCHEMA_VERSION,exportId,exportedAt,sourceEnvironment:process.env.DEPLOYMENT_ENV||process.env.NODE_ENV||'development',regionId,mode:options.backup?'WORKFLOW_BACKUP':options.includeChanges?'ACTIVE_WITH_CHANGES':'ACTIVE_VERIFIED',records:eligible.map(row=>this.exportRecord(row,options.backup))};
    const event={action:'DATA_EXPORT_CREATED',at:exportedAt,source:{packageVersion:TRANSFER_SCHEMA_VERSION,regionId,recordCount:eligible.length,exportId}};
    for(const row of eligible)await this.model.updateOne({id:row.id},{$push:{auditTrail:event}});
    return packageValue;
  }
  async previewImport(packageValue:any,options:{trustedVerified?:boolean}={}){return this.importPackage(packageValue,{...options,dryRun:true})}
  async importPackage(packageValue:any,options:{trustedVerified?:boolean;dryRun?:boolean}={}){
    this.validatePackage(packageValue,options.trustedVerified===true);
    const summary={regionId:packageValue.regionId,schemaVersion:packageValue.schemaVersion,recordCount:packageValue.records.length,newRecords:0,unchangedRecords:0,conflicts:0,stagedRecords:0,activatedRecords:0,dryRun:Boolean(options.dryRun),results:[] as any[]};
    for(const imported of packageValue.records){
      const existing:any=await this.model.findOne({regionId:packageValue.regionId,canonicalEntityId:imported.canonicalEntityId});
      const facts=this.importFacts(imported);
      const comparable=existing?(existing.proposedFacts&&existing.lifecycleStatus!=='ACTIVE'?existing.proposedFacts:this.factFields(existing)):undefined;
      const same=existing&&this.sameFacts(comparable,facts);
      if(same){summary.unchangedRecords++;summary.results.push({canonicalEntityId:imported.canonicalEntityId,outcome:'UNCHANGED'});continue}
      if(existing&&existing.verificationStatus==='VERIFIED'){
        summary.conflicts++;summary.results.push({canonicalEntityId:imported.canonicalEntityId,outcome:'CONFLICT'});
        if(!options.dryRun){existing.proposedFacts=facts;existing.source=imported.source;existing.detectedChanges=this.diff(this.toCandidate(this.baseline(existing.regionId,existing.canonicalEntityId),existing),facts);existing.lifecycleStatus='CHANGE_DETECTED';existing.auditTrail.push({action:'DATA_IMPORT_CONFLICT',at:new Date().toISOString(),source:{packageVersion:packageValue.schemaVersion,regionId:packageValue.regionId,recordCount:packageValue.records.length,exportId:packageValue.exportId},changes:existing.detectedChanges});await existing.save()}
        continue;
      }
      const trusted=options.trustedVerified===true;
      summary.newRecords++;if(trusted)summary.activatedRecords++;else summary.stagedRecords++;
      summary.results.push({canonicalEntityId:imported.canonicalEntityId,outcome:trusted?'ACTIVATED':'STAGED'});
      if(!options.dryRun)await this.model.create({id:`rd-${randomUUID()}`,canonicalEntityId:imported.canonicalEntityId,regionId:packageValue.regionId,displayName:imported.displayName,entityType:imported.entityType,category:imported.category,source:imported.source,lastVerifiedAt:imported.verifiedAt,verificationStatus:trusted?'VERIFIED':'REVERIFY_REQUIRED',lifecycleStatus:trusted?'ACTIVE':'NEEDS_VERIFICATION',...(trusted?this.factFields(facts):{}),proposedFacts:facts,detectedChanges:[],auditTrail:[{action:trusted?'DATA_IMPORT_ACTIVATED':'DATA_IMPORT_STAGED',at:new Date().toISOString(),source:{packageVersion:packageValue.schemaVersion,regionId:packageValue.regionId,recordCount:packageValue.records.length,exportId:packageValue.exportId}}]});
    }
    return summary;
  }
  private exportRecord(row:any,includeWorkflow=false){const value:any={canonicalEntityId:row.canonicalEntityId,regionId:row.regionId,...this.factFields(row),source:row.source,verifiedAt:row.lastVerifiedAt,verificationStatus:row.verificationStatus,lifecycleStatus:row.lifecycleStatus,actionInputs:{call:row.phone||undefined,website:row.websiteUrl||undefined,reserve:row.reservationUrl||undefined,navigate:Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)?{latitude:row.latitude,longitude:row.longitude}:undefined},auditSummary:{lastAction:row.auditTrail?.at(-1)?.action,lastActionAt:row.auditTrail?.at(-1)?.at}};if(includeWorkflow){value.proposedFacts=row.proposedFacts;value.detectedChanges=row.detectedChanges}return value}
  private validatePackage(value:any,trusted:boolean){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new BadRequestException('A JSON package is required');
    if(JSON.stringify(value).length>1_000_000)throw new BadRequestException('Package exceeds 1 MB');
    if(value.packageType!=='REGIONAL_OPERATIONAL_DATA'||value.schemaVersion!==TRANSFER_SCHEMA_VERSION||!value.exportId||!value.exportedAt)throw new BadRequestException('Unsupported or untrusted package');
    if(!REGIONAL_CANDIDATE_DATASETS[value.regionId]||!Array.isArray(value.records))throw new BadRequestException('Invalid package region or records');
    const ids=new Set<string>();for(const row of value.records){
      if(!row||row.regionId!==value.regionId||typeof row.canonicalEntityId!=='string'||!(/^(https:\/\/|urn:)/.test(row.canonicalEntityId))||ids.has(row.canonicalEntityId))throw new BadRequestException('Cross-region, malformed, or duplicate canonical identity');ids.add(row.canonicalEntityId);
      if(!row.displayName||!ENTITY_TYPES.has(row.entityType||'OTHER'))throw new BadRequestException('Unsupported entity record');
      if(!row.source?.sourceUrl||!SOURCE_TYPES.has(row.source?.sourceType)||!/^https:\/\//.test(row.source.sourceUrl))throw new BadRequestException('Verified provenance is required');
      const hasLat=row.latitude!==undefined,hasLng=row.longitude!==undefined;if(hasLat!==hasLng||(hasLat&&(!Number.isFinite(row.latitude)||!Number.isFinite(row.longitude)||row.latitude < -90||row.latitude > 90||row.longitude < -180||row.longitude > 180)))throw new BadRequestException('Malformed coordinates');
      if(this.containsExecutable(row))throw new BadRequestException('Executable content is not allowed');
      if(trusted&&(row.verificationStatus!=='VERIFIED'||!['ACTIVE','CHANGE_DETECTED'].includes(row.lifecycleStatus)))throw new BadRequestException('Trusted import requires verified operational records');
    }
  }
  private importFacts(row:any){return Object.fromEntries(TRANSFER_FIELDS.filter(field=>row[field]!==undefined).map(field=>[field,row[field]]))}
  private sameFacts(a:any,b:any){return JSON.stringify(this.importFacts(a||{}))===JSON.stringify(this.importFacts(b||{}))}
  private containsExecutable(value:any):boolean{if(typeof value==='string')return /<script|javascript:|data:text\/html/i.test(value);if(Array.isArray(value))return value.some(x=>this.containsExecutable(x));if(value&&typeof value==='object')return Object.entries(value).some(([key,v])=>['__proto__','constructor','prototype'].includes(key)||this.containsExecutable(v));return false}
  private baseline(region: string, id: string) {
    return REGIONAL_CANDIDATE_DATASETS[region]?.records.find(
      (x) => x.entityUri === id,
    );
  }
  private diff(base: any, facts: any) {
    if (!base) return [];
    return [
      'phone',
      'address',
      'latitude',
      'longitude',
      'websiteUrl',
      'reservationUrl',
      'operatingHours',
      'businessStatus',
    ]
      .filter(
        (field) =>
          facts[field] !== undefined &&
          facts[field] !==
            ({ phone: base.telephone, websiteUrl: base.website }[field] ??
              base[field]),
      )
      .map((field) => ({
        field,
        previousValue:
          { phone: base.telephone, websiteUrl: base.website }[field] ??
          base[field],
        newValue: facts[field],
        unsafe: ['latitude', 'longitude'].includes(field),
      }));
  }
  private factFields(f: any) {
    return {
      displayName: f.displayName,
      entityType: f.entityType,
      category: f.category,
      tags: Array.isArray(f.tags) ? f.tags : [],
      areaLabel: f.areaLabel,
      address: f.address,
      latitude: f.latitude,
      longitude: f.longitude,
      phone: f.phone,
      websiteUrl: f.websiteUrl,
      reservationUrl: f.reservationUrl,
      operatingHours: f.operatingHours,
      shortDescription: f.shortDescription,
    };
  }
  private toCandidate(
    base: RegionalCandidateRecord | undefined,
    row: any,
  ): RegionalCandidateRecord {
    const coordinatesSafe =
      !row.detectedChanges?.some((x: any) => x.unsafe) &&
      Number.isFinite(row.latitude) &&
      Number.isFinite(row.longitude);
    const actions: any = { ...(base?.actions || {}) };
    if (row.phone) actions.call = { phone: row.phone };
    if (row.websiteUrl) actions.website = { url: row.websiteUrl };
    if (row.reservationUrl) actions.reserve = { url: row.reservationUrl };
    if (coordinatesSafe)
      actions.navigate = { latitude: row.latitude, longitude: row.longitude };
    else delete actions.navigate;
    return {
      ...(base || {
        alternateLabels: [],
        tags: [],
        runtimeDataStatus: 'VERIFIED',
      }),
      entityUri: row.canonicalEntityId,
      canonicalLabelKo: row.displayName,
      category: row.category || base?.category || 'OTHER',
      entityType: row.entityType || base?.entityType,
      tags: row.tags?.length ? row.tags : (base?.tags || []),
      areaLabel: row.areaLabel ?? base?.areaLabel,
      address: row.address ?? base?.address,
      telephone: row.phone ?? base?.telephone,
      website: row.websiteUrl ?? base?.website,
      reservationUrl: row.reservationUrl ?? base?.reservationUrl,
      operatingHours: row.operatingHours ?? base?.operatingHours,
      latitude: coordinatesSafe ? row.latitude : undefined,
      longitude: coordinatesSafe ? row.longitude : undefined,
      description: row.shortDescription ?? base?.description,
      source: row.source,
      lastVerifiedAt: row.lastVerifiedAt,
      actions,
    };
  }
}
