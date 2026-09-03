import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { verifiedDirectBookingAction } from './public-action-policy';
import {
  REGIONAL_CANDIDATE_DATASETS,
  REGIONAL_BOOTSTRAP_REGION_IDS,
  RegionalCandidateRecord,
} from '../regions/regional-candidate.registry';
import {
  RegionalDataRecord,
  RegionalDataRecordDocument,
} from './regional-data.schema';
import {
  operationalReadinessSummary,
  operationalVerificationMatrix,
  operationalVerificationTasks,
} from './operational-readiness';
import { automaticBootstrapSeedEnabled } from '../bootstrap/startup-data-policy';
import { validVisitorContent } from '../i18n/place-content';
const SOURCE_TYPES = new Set([
  'OFFICIAL_LOCAL_GOV',
  'OFFICIAL_BUSINESS',
  'KTO',
  'OFFICIAL_MAP_LISTING',
  'OTHER_VERIFIED_SOURCE',
]);
const TRANSFER_SCHEMA_VERSION = '1.0';
const ENTITY_TYPES = new Set([
  'ATTRACTION',
  'CAFE',
  'ACCOMMODATION',
  'RESTAURANT',
  'EXPERIENCE',
  'EVENT',
  'FACILITY',
  'ACTIVITY',
  'AREA',
  'CULTURAL_AREA',
  'MARKET',
  'SHOPPING_AREA',
  'OTHER',
]);
const TRANSFER_FIELDS = [
  'displayName',
  'visitorContent',
  'aliases',
  'entityType',
  'category',
  'tags',
  'areaLabel',
  'address',
  'latitude',
  'longitude',
  'phone',
  'websiteUrl',
  'reservationUrl',
  'operatingHours',
  'closureDays',
  'parking',
  'accessibility',
  'walkingAccess',
  'shortDescription',
] as const;
const OPERATIONAL_FIELDS = new Set([
  'coordinates',
  'phone',
  'hours',
  'parking',
  'accessibility',
]);
@Injectable()
export class RegionalDataService implements OnModuleInit {
  constructor(
    @InjectModel(RegionalDataRecord.name)
    private model: Model<RegionalDataRecordDocument>,
  ) {}
  async onModuleInit() {
    if (!automaticBootstrapSeedEnabled()) {
      let missing = 0;
      for (const regionId of REGIONAL_BOOTSTRAP_REGION_IDS)
        for (const item of REGIONAL_CANDIDATE_DATASETS[regionId].records)
          if (
            !(await this.model.findOne({
              canonicalEntityId: item.entityUri,
              regionId,
            }))
          )
            missing++;
      if (missing)
        throw new Error(
          `Regional data bootstrap validation failed: missing documents=${missing}`,
        );
      return;
    }
    for (const regionId of REGIONAL_BOOTSTRAP_REGION_IDS)
      for (const item of REGIONAL_CANDIDATE_DATASETS[regionId].records) {
        await this.model.updateOne(
          { canonicalEntityId: item.entityUri, regionId },
          {
            $setOnInsert: {
              id: `seed-${regionId}-${'canonicalId' in item ? item.canonicalId : item.entityUri.split('#').pop()}`,
              canonicalEntityId: item.entityUri,
              regionId,
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
              verificationStatus:
                item.runtimeDataStatus === 'VERIFIED'
                  ? 'VERIFIED'
                  : 'UNVERIFIED',
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
    const requestedCanonical = input.canonicalEntityId;
    const identityBaseline = requestedCanonical
      ? undefined
      : this.findEquivalentBaseline(input.regionId, input.proposedFacts);
    const regionalRows: any[] = requestedCanonical
      ? []
      : await this.model.find({ regionId: input.regionId }).lean();
    const identityRow = requestedCanonical
      ? undefined
      : regionalRows.find((row) =>
          this.sameIdentity(row, input.proposedFacts),
        );
    const canonical =
      requestedCanonical ||
      identityBaseline?.entityUri ||
      identityRow?.canonicalEntityId ||
      `urn:regional-candidate:${input.regionId}:${randomUUID()}`;
    const baseline = this.baseline(input.regionId, canonical);
    const existing: any = await this.model.findOne({
      canonicalEntityId: canonical,
      regionId: input.regionId,
    });
    if (existing) {
      if (
        existing.proposedFacts &&
        this.sameFacts(existing.proposedFacts, input.proposedFacts)
      )
        return { ...existing.toObject(), ingestionOutcome: 'UNCHANGED' };
      const current = this.toCandidate(baseline, existing);
      const changes = this.diffAll(current, input.proposedFacts);
      if (existing.verificationStatus === 'VERIFIED' && changes.length === 0)
        return { ...existing.toObject(), ingestionOutcome: 'UNCHANGED' };
      existing.source = input.source;
      existing.proposedFacts = input.proposedFacts;
      existing.detectedChanges = changes;
      existing.lifecycleStatus =
        existing.verificationStatus === 'VERIFIED'
          ? 'CHANGE_DETECTED'
          : 'NEW_CANDIDATE';
      existing.auditTrail.push({
        action:
          existing.verificationStatus === 'VERIFIED'
            ? 'CHANGE_DETECTED'
            : 'CANDIDATE_UPDATED',
        at: new Date().toISOString(),
        source: input.source,
        changes: existing.detectedChanges,
      });
      await existing.save();
      return {
        ...existing.toObject(),
        ingestionOutcome:
          existing.verificationStatus === 'VERIFIED'
            ? 'CHANGE_DETECTED'
            : 'CANDIDATE_UPDATED',
      };
    }
    const created: any = await this.model.create({
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
    return {
      ...created.toObject(),
      ingestionOutcome: baseline ? 'CHANGE_DETECTED' : 'CREATED',
    };
  }
  async action(
    id: string,
    action: string,
    editedFacts?: Record<string, unknown>,
    auditContext?: { actorId?: string; regionId?: string; action?: string },
  ) {
    const row: any = await this.model.findOne({ id });
    if (!row) throw new NotFoundException();
    const facts = { ...(row.proposedFacts || {}), ...(editedFacts || {}) };
    const auditedChanges = [...(row.detectedChanges || [])];
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
      action: auditContext?.action || action,
      at: new Date().toISOString(),
      source: row.source,
      changes: auditedChanges,
      actorId: auditContext?.actorId || 'SYSTEM_INTERNAL',
      regionId: auditContext?.regionId || row.regionId,
    });
    await row.save();
    return row.toObject();
  }
  async approveCoreCoverageFix(
    regionId: string,
    canonicalEntityId: string,
    editedFacts: { category?: string; aliases?: string[] },
    auditContext: { actorId: string },
  ) {
    const keys = Object.keys(editedFacts);
    if (
      !keys.length ||
      keys.some((key) => !['category', 'aliases'].includes(key))
    )
      throw new BadRequestException(
        'Only category or alias coverage fixes are supported',
      );
    const row: any = await this.model.findOne({ regionId, canonicalEntityId });
    if (!row)
      throw new NotFoundException('Canonical regional entity not found');
    const facts = {
      ...this.factFields(row),
      ...(row.proposedFacts || {}),
      ...editedFacts,
    };
    return this.action(row.id, 'APPROVE_EDITED', facts, {
      actorId: auditContext.actorId,
      regionId,
      action: 'CORE_COVERAGE_FIX_APPROVED',
    });
  }
  async effectiveDataset(regionId: string) {
    const base = REGIONAL_CANDIDATE_DATASETS[regionId];
    if (!base) return undefined;
    const regionalRows: any[] = await this.model.find({ regionId }).lean();
    const overrides = regionalRows.filter(
      (row) =>
        ['ACTIVE', 'CHANGE_DETECTED'].includes(row.lifecycleStatus) &&
        (row.verificationStatus === 'VERIFIED' ||
          Object.values(row.fieldEvidence || {}).some(
            (e: any) => e?.status === 'APPROVED',
          )),
    );
    const questionable: any[] = await this.model
      .find({ regionId, lifecycleStatus: 'CHANGE_DETECTED' })
      .lean();
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
    for (const row of questionable.filter((row) =>
      row.detectedChanges?.some((change: any) => change.unsafe),
    )) {
      const index = records.findIndex(
        (item) => item.entityUri === row.canonicalEntityId,
      );
      if (index < 0) continue;
      const actions = { ...(records[index].actions || {}) } as any;
      delete actions.navigate;
      records[index] = {
        ...records[index],
        latitude: undefined,
        longitude: undefined,
        actions,
      };
    }
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
  async operationalReadiness(regionId: string) {
    const dataset = await this.effectiveDataset(regionId);
    if (!dataset) throw new BadRequestException('Unsupported regionId');
    const rows: any[] = await this.model.find({ regionId }).lean(),
      matrix = operationalVerificationMatrix(dataset.records, rows);
    return {
      regionId,
      summary: operationalReadinessSummary(matrix),
      matrix,
      tasks: operationalVerificationTasks(regionId, matrix),
    };
  }
  async operationalEntity(regionId: string, canonicalEntityId: string) {
    const readiness = await this.operationalReadiness(regionId),
      entity = readiness.matrix.find(
        (x) => x.canonicalEntityId === canonicalEntityId,
      ),
      document: any = await this.model.findOne({ regionId, canonicalEntityId }),
      row: any = document?.toObject ? document.toObject() : document;
    if (!entity || !row) throw new NotFoundException();
    return {
      regionId,
      ...entity,
      fieldEvidence: row.fieldEvidence || {},
      auditTrail: row.auditTrail || [],
    };
  }
  async proposeOperationalEvidence(
    regionId: string,
    canonicalEntityId: string,
    field: string,
    proposal: any,
    actorId: string,
  ) {
    if (!OPERATIONAL_FIELDS.has(field))
      throw new BadRequestException('Unsupported operational field');
    if (
      !proposal?.source?.sourceType ||
      !/^https:\/\//.test(proposal?.source?.sourceUrl || '') ||
      !proposal?.observedAt ||
      proposal.proposed === undefined
    )
      throw new BadRequestException(
        'Proposed value, source URL and observed timestamp are required',
      );
    this.validateOperationalValue(field, proposal.proposed);
    const row: any = await this.model.findOne({ regionId, canonicalEntityId });
    if (!row) throw new NotFoundException();
    const current = this.operationalCurrent(row, field),
      evidence = {
        current,
        proposed: proposal.proposed,
        source: proposal.source,
        observedAt: proposal.observedAt,
        confidence: proposal.confidence || 'EVIDENCE_ONLY',
        evidenceStatus: proposal.evidenceStatus || 'UNVERIFIED_EVIDENCE',
        whyReviewNeeded:
          proposal.whyReviewNeeded ||
          '운영 기능에 사용하기 전에 관리자의 명시적 확인이 필요합니다.',
        status: 'PROPOSED',
      };
    row.fieldEvidence = { ...(row.fieldEvidence || {}), [field]: evidence };
    row.markModified?.('fieldEvidence');
    row.auditTrail.push({
      action: 'OPERATIONAL_EVIDENCE_REVIEWED',
      actorId,
      regionId,
      entityId: canonicalEntityId,
      field,
      previousValue: current,
      newValue: proposal.proposed,
      evidenceSource: proposal.source,
      at: new Date().toISOString(),
    });
    await row.save();
    return this.operationalEntity(regionId, canonicalEntityId);
  }
  async decideOperationalEvidence(
    regionId: string,
    canonicalEntityId: string,
    field: string,
    decision: string,
    actorId: string,
    confirmed: boolean,
    editedValue?: unknown,
  ) {
    if (!confirmed)
      throw new BadRequestException('Explicit human confirmation required');
    if (!OPERATIONAL_FIELDS.has(field))
      throw new BadRequestException('Unsupported operational field');
    if (!['APPROVE', 'MODIFY', 'HOLD', 'REJECT'].includes(decision))
      throw new BadRequestException('Unsupported evidence decision');
    const row: any = await this.model.findOne({ regionId, canonicalEntityId });
    if (!row) throw new NotFoundException();
    const evidence = row.fieldEvidence?.[field];
    if (!evidence || evidence.status !== 'PROPOSED')
      throw new BadRequestException('Proposed field evidence is required');
    const nextValue = decision === 'MODIFY' ? editedValue : evidence.proposed;
    if (['APPROVE', 'MODIFY'].includes(decision)) {
      this.validateOperationalValue(field, nextValue);
      this.applyOperationalValue(row, field, nextValue);
      evidence.proposed = nextValue;
      evidence.status = 'APPROVED';
      row.verificationStatus =
        row.verificationStatus === 'UNVERIFIED'
          ? 'PARTIAL'
          : row.verificationStatus;
      row.lifecycleStatus = 'ACTIVE';
      row.lastVerifiedAt = new Date().toISOString();
    } else evidence.status = decision === 'HOLD' ? 'HELD' : 'REJECTED';
    evidence.reviewedAt = new Date().toISOString();
    evidence.reviewedBy = actorId;
    row.fieldEvidence = { ...(row.fieldEvidence || {}), [field]: evidence };
    row.markModified?.('fieldEvidence');
    const eventByField: Record<string, string> = {
      coordinates: 'COORDINATE_APPROVED',
      phone: 'PHONE_APPROVED',
      hours: 'HOURS_APPROVED',
      parking: 'PARKING_APPROVED',
      accessibility: 'ACCESSIBILITY_APPROVED',
    };
    row.auditTrail.push({
      action: ['APPROVE', 'MODIFY'].includes(decision)
        ? eventByField[field]
        : `OPERATIONAL_EVIDENCE_${decision === 'HOLD' ? 'HELD' : 'REJECTED'}`,
      actorId,
      regionId,
      entityId: canonicalEntityId,
      field,
      previousValue: evidence.current,
      newValue: ['APPROVE', 'MODIFY'].includes(decision)
        ? nextValue
        : undefined,
      evidenceSource: evidence.source,
      at: evidence.reviewedAt,
    });
    await row.save();
    return {
      entity: await this.operationalEntity(regionId, canonicalEntityId),
      readiness: await this.operationalReadiness(regionId),
    };
  }
  async exportPackage(
    regionId: string,
    options: { includeChanges?: boolean; backup?: boolean } = {},
  ) {
    if (!REGIONAL_CANDIDATE_DATASETS[regionId])
      throw new BadRequestException('Unsupported regionId');
    const rows: any[] = await this.model.find({ regionId }).lean();
    const eligible = rows.filter((row) =>
      options.backup
        ? true
        : row.verificationStatus === 'VERIFIED' &&
          (row.lifecycleStatus === 'ACTIVE' ||
            (options.includeChanges &&
              row.lifecycleStatus === 'CHANGE_DETECTED')),
    );
    const exportedAt = new Date().toISOString(),
      exportId = `regional-export-${randomUUID()}`;
    const packageValue = {
      packageType: 'REGIONAL_OPERATIONAL_DATA',
      schemaVersion: TRANSFER_SCHEMA_VERSION,
      exportId,
      exportedAt,
      sourceEnvironment:
        process.env.DEPLOYMENT_ENV || process.env.NODE_ENV || 'development',
      regionId,
      mode: options.backup
        ? 'WORKFLOW_BACKUP'
        : options.includeChanges
          ? 'ACTIVE_WITH_CHANGES'
          : 'ACTIVE_VERIFIED',
      records: eligible.map((row) => this.exportRecord(row, options.backup)),
    };
    const event = {
      action: 'DATA_EXPORT_CREATED',
      at: exportedAt,
      source: {
        packageVersion: TRANSFER_SCHEMA_VERSION,
        regionId,
        recordCount: eligible.length,
        exportId,
      },
    };
    for (const row of eligible)
      await this.model.updateOne(
        { id: row.id },
        { $push: { auditTrail: event } },
      );
    return packageValue;
  }
  async previewImport(
    packageValue: any,
    options: { trustedVerified?: boolean } = {},
  ) {
    return this.importPackage(packageValue, { ...options, dryRun: true });
  }
  async importPackage(
    packageValue: any,
    options: { trustedVerified?: boolean; dryRun?: boolean } = {},
  ) {
    this.validatePackage(packageValue, options.trustedVerified === true);
    const summary = {
      regionId: packageValue.regionId,
      schemaVersion: packageValue.schemaVersion,
      recordCount: packageValue.records.length,
      newRecords: 0,
      unchangedRecords: 0,
      conflicts: 0,
      stagedRecords: 0,
      activatedRecords: 0,
      dryRun: Boolean(options.dryRun),
      results: [] as any[],
    };
    for (const imported of packageValue.records) {
      const existing: any = await this.model.findOne({
        regionId: packageValue.regionId,
        canonicalEntityId: imported.canonicalEntityId,
      });
      const facts = this.importFacts(imported);
      const comparable = existing
        ? existing.proposedFacts && existing.lifecycleStatus !== 'ACTIVE'
          ? existing.proposedFacts
          : this.factFields(existing)
        : undefined;
      const same = existing && this.sameFacts(comparable, facts);
      if (same) {
        summary.unchangedRecords++;
        summary.results.push({
          canonicalEntityId: imported.canonicalEntityId,
          outcome: 'UNCHANGED',
        });
        continue;
      }
      if (existing && existing.verificationStatus === 'VERIFIED') {
        summary.conflicts++;
        summary.results.push({
          canonicalEntityId: imported.canonicalEntityId,
          outcome: 'CONFLICT',
        });
        if (!options.dryRun) {
          existing.proposedFacts = facts;
          existing.source = imported.source;
          existing.detectedChanges = this.diff(
            this.toCandidate(
              this.baseline(existing.regionId, existing.canonicalEntityId),
              existing,
            ),
            facts,
          );
          existing.lifecycleStatus = 'CHANGE_DETECTED';
          existing.auditTrail.push({
            action: 'DATA_IMPORT_CONFLICT',
            at: new Date().toISOString(),
            source: {
              packageVersion: packageValue.schemaVersion,
              regionId: packageValue.regionId,
              recordCount: packageValue.records.length,
              exportId: packageValue.exportId,
            },
            changes: existing.detectedChanges,
          });
          await existing.save();
        }
        continue;
      }
      const trusted = options.trustedVerified === true;
      summary.newRecords++;
      if (trusted) summary.activatedRecords++;
      else summary.stagedRecords++;
      summary.results.push({
        canonicalEntityId: imported.canonicalEntityId,
        outcome: trusted ? 'ACTIVATED' : 'STAGED',
      });
      if (!options.dryRun)
        await this.model.create({
          id: `rd-${randomUUID()}`,
          canonicalEntityId: imported.canonicalEntityId,
          regionId: packageValue.regionId,
          displayName: imported.displayName,
          entityType: imported.entityType,
          category: imported.category,
          source: imported.source,
          lastVerifiedAt: imported.verifiedAt,
          verificationStatus: trusted ? 'VERIFIED' : 'REVERIFY_REQUIRED',
          lifecycleStatus: trusted ? 'ACTIVE' : 'NEEDS_VERIFICATION',
          ...(trusted ? this.factFields(facts) : {}),
          proposedFacts: facts,
          detectedChanges: [],
          auditTrail: [
            {
              action: trusted ? 'DATA_IMPORT_ACTIVATED' : 'DATA_IMPORT_STAGED',
              at: new Date().toISOString(),
              source: {
                packageVersion: packageValue.schemaVersion,
                regionId: packageValue.regionId,
                recordCount: packageValue.records.length,
                exportId: packageValue.exportId,
              },
            },
          ],
        });
    }
    return summary;
  }
  private exportRecord(row: any, includeWorkflow = false) {
    const value: any = {
      canonicalEntityId: row.canonicalEntityId,
      regionId: row.regionId,
      ...this.factFields(row),
      source: row.source,
      verifiedAt: row.lastVerifiedAt,
      verificationStatus: row.verificationStatus,
      lifecycleStatus: row.lifecycleStatus,
      actionInputs: {
        call: row.phone || undefined,
        website: row.websiteUrl || undefined,
        reserve: row.reservationUrl || undefined,
        navigate:
          Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
            ? { latitude: row.latitude, longitude: row.longitude }
            : undefined,
      },
      auditSummary: {
        lastAction: row.auditTrail?.at(-1)?.action,
        lastActionAt: row.auditTrail?.at(-1)?.at,
      },
    };
    if (includeWorkflow) {
      value.proposedFacts = row.proposedFacts;
      value.detectedChanges = row.detectedChanges;
    }
    return value;
  }
  private validatePackage(value: any, trusted: boolean) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('A JSON package is required');
    if (JSON.stringify(value).length > 1_000_000)
      throw new BadRequestException('Package exceeds 1 MB');
    if (
      value.packageType !== 'REGIONAL_OPERATIONAL_DATA' ||
      value.schemaVersion !== TRANSFER_SCHEMA_VERSION ||
      !value.exportId ||
      !value.exportedAt
    )
      throw new BadRequestException('Unsupported or untrusted package');
    if (
      !REGIONAL_CANDIDATE_DATASETS[value.regionId] ||
      !Array.isArray(value.records)
    )
      throw new BadRequestException('Invalid package region or records');
    const ids = new Set<string>();
    for (const row of value.records) {
      if (
        !row ||
        row.regionId !== value.regionId ||
        typeof row.canonicalEntityId !== 'string' ||
        !/^(https:\/\/|urn:)/.test(row.canonicalEntityId) ||
        ids.has(row.canonicalEntityId)
      )
        throw new BadRequestException(
          'Cross-region, malformed, or duplicate canonical identity',
        );
      ids.add(row.canonicalEntityId);
      if (!row.displayName || !ENTITY_TYPES.has(row.entityType || 'OTHER'))
        throw new BadRequestException('Unsupported entity record');
      if (
        !row.source?.sourceUrl ||
        !SOURCE_TYPES.has(row.source?.sourceType) ||
        !/^https:\/\//.test(row.source.sourceUrl)
      )
        throw new BadRequestException('Verified provenance is required');
      const hasLat = row.latitude !== undefined,
        hasLng = row.longitude !== undefined;
      if (
        hasLat !== hasLng ||
        (hasLat &&
          (!Number.isFinite(row.latitude) ||
            !Number.isFinite(row.longitude) ||
            row.latitude < -90 ||
            row.latitude > 90 ||
            row.longitude < -180 ||
            row.longitude > 180))
      )
        throw new BadRequestException('Malformed coordinates');
      if (this.containsExecutable(row))
        throw new BadRequestException('Executable content is not allowed');
      if (row.visitorContent !== undefined && !validVisitorContent(row.visitorContent))
        throw new BadRequestException('Invalid reviewed visitor content');
      if (
        trusted &&
        (row.verificationStatus !== 'VERIFIED' ||
          !['ACTIVE', 'CHANGE_DETECTED'].includes(row.lifecycleStatus))
      )
        throw new BadRequestException(
          'Trusted import requires verified operational records',
        );
    }
  }
  private importFacts(row: any) {
    return Object.fromEntries(
      TRANSFER_FIELDS.filter((field) => row[field] !== undefined).map(
        (field) => [field, row[field]],
      ),
    );
  }
  private sameFacts(a: any, b: any) {
    return (
      JSON.stringify(this.importFacts(a || {})) ===
      JSON.stringify(this.importFacts(b || {}))
    );
  }
  private containsExecutable(value: any): boolean {
    if (typeof value === 'string')
      return /<script|javascript:|data:text\/html/i.test(value);
    if (Array.isArray(value))
      return value.some((x) => this.containsExecutable(x));
    if (value && typeof value === 'object')
      return Object.entries(value).some(
        ([key, v]) =>
          ['__proto__', 'constructor', 'prototype'].includes(key) ||
          this.containsExecutable(v),
      );
    return false;
  }
  private baseline(region: string, id: string) {
    return REGIONAL_CANDIDATE_DATASETS[region]?.records.find(
      (x) => x.entityUri === id,
    );
  }
  private findEquivalentBaseline(region: string, facts: any) {
    return REGIONAL_CANDIDATE_DATASETS[region]?.records.find((row) =>
      this.sameIdentity(row, facts),
    );
  }
  private sameIdentity(row: any, facts: any) {
    const normalize = (value?: unknown) =>
      typeof value === 'string'
        ? value
            .normalize('NFKC')
            .toLocaleLowerCase('ko-KR')
            .replace(/[^0-9a-z가-힣]/g, '')
        : undefined;
    const names = [
      row.canonicalLabelKo,
      row.displayName,
      ...(row.alternateLabels || []),
      ...(row.aliases || []),
    ]
      .map(normalize)
      .filter(Boolean);
    const proposedNames = [facts.displayName, ...(facts.aliases || [])]
      .map(normalize)
      .filter(Boolean);
    if (proposedNames.some((name) => names.includes(name))) return true;
    const sameKind =
      Boolean(
        facts.entityType &&
        facts.entityType === row.entityType,
      ) ||
      Boolean(
        facts.category &&
        facts.category === row.category,
      );
    const rowAddress = normalize(row.address);
    const proposedAddress = normalize(facts.address);
    if (sameKind && proposedAddress && proposedAddress === rowAddress)
      return true;
    const phone = (value?: string) => value?.replace(/\D/g, '');
    if (
      phone(facts.phone) &&
      phone(facts.phone) ===
        phone(row.phone || row.telephone)
    )
      return true;
    const rowLat = row.latitude,
      rowLng = row.longitude;
    if (
      Number.isFinite(facts.latitude) &&
      Number.isFinite(facts.longitude) &&
      Number.isFinite(rowLat) &&
      Number.isFinite(rowLng)
    ) {
      const latMeters = (facts.latitude - rowLat) * 111_000;
      const lngMeters = (facts.longitude - rowLng) * 88_000;
      if (sameKind && Math.hypot(latMeters, lngMeters) <= 30) return true;
    }
    return false;
  }
  private diffAll(base: any, facts: any) {
    const current = this.factFields({
      displayName: base.canonicalLabelKo || base.displayName,
      aliases: base.alternateLabels || base.aliases,
      entityType: base.entityType,
      category: base.category,
      tags: base.tags,
      areaLabel: base.areaLabel,
      address: base.address,
      latitude: base.latitude,
      longitude: base.longitude,
      phone: base.telephone || base.phone,
      websiteUrl: base.website || base.websiteUrl,
      reservationUrl: base.reservationUrl,
      operatingHours: base.operatingHours,
      closureDays: base.closureDays,
      parking: base.parking,
      accessibility: base.accessibility,
      walkingAccess: base.walkingAccess,
      shortDescription: base.description || base.shortDescription,
    });
    return TRANSFER_FIELDS.filter(
      (field) =>
        facts[field] !== undefined &&
        JSON.stringify(facts[field]) !== JSON.stringify(current[field]),
    ).map((field) => ({
      field,
      previousValue: current[field],
      newValue: facts[field],
      unsafe: ['latitude', 'longitude'].includes(field),
    }));
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
    if (f.visitorContent !== undefined && !validVisitorContent(f.visitorContent))
      throw new BadRequestException('Invalid reviewed visitor content');
    return {
      displayName: f.displayName,
      visitorContent: f.visitorContent,
      aliases: Array.isArray(f.aliases) ? f.aliases : [],
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
      closureDays: f.closureDays,
      parking: f.parking,
      accessibility: f.accessibility,
      walkingAccess: f.walkingAccess,
      shortDescription: f.shortDescription,
      operationalTips: Array.isArray(f.operationalTips) ? f.operationalTips : [],
    };
  }
  private toCandidate(
    base: RegionalCandidateRecord | undefined,
    row: any,
  ): RegionalCandidateRecord {
    const coordinatesSafe =
      !row.detectedChanges?.some((x: any) => x.unsafe) &&
      Number.isFinite(row.latitude) &&
      Number.isFinite(row.longitude) &&
      (row.verificationStatus === 'VERIFIED' ||
        row.fieldEvidence?.coordinates?.status === 'APPROVED');
    const actions: any = { ...(base?.actions || {}) };
    if (row.phone) actions.call = { phone: row.phone };
    if (row.websiteUrl) actions.website = { url: row.websiteUrl };
    const reservationEvidence = row.fieldEvidence?.reservationUrl;
    const reserve = verifiedDirectBookingAction(
      row.reservationUrl,
      reservationEvidence?.status === 'APPROVED' &&
        reservationEvidence.evidenceStatus === 'VERIFIED_DIRECT_BOOKING' &&
        typeof reservationEvidence.current === 'string' &&
        typeof reservationEvidence.source?.sourceUrl === 'string'
        ? {
            kind: 'DIRECT_BOOKING',
            verificationStatus: 'VERIFIED',
            verifiedUrl: reservationEvidence.current,
            sourceUrl: reservationEvidence.source.sourceUrl,
            verifiedAt:
              reservationEvidence.reviewedAt || reservationEvidence.observedAt,
          }
        : undefined,
      row.websiteUrl,
    );
    if (reserve) actions.reserve = reserve;
    else delete actions.reserve;
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
      visitorContent: row.visitorContent ?? base?.visitorContent,
      alternateLabels: row.aliases?.length
        ? row.aliases
        : base?.alternateLabels || [],
      category: row.category || base?.category || 'OTHER',
      entityType: row.entityType || base?.entityType,
      tags: row.tags?.length ? row.tags : base?.tags || [],
      areaLabel: row.areaLabel ?? base?.areaLabel,
      address: row.address ?? base?.address,
      telephone: row.phone ?? base?.telephone,
      website: row.websiteUrl ?? base?.website,
      reservationUrl: row.reservationUrl ?? base?.reservationUrl,
      operatingHours: row.operatingHours ?? base?.operatingHours,
      closureDays: row.closureDays ?? (base as any)?.closureDays,
      parking: row.parking ?? (base as any)?.parking,
      accessibility: row.accessibility ?? (base as any)?.accessibility,
      walkingAccess: row.walkingAccess ?? (base as any)?.walkingAccess,
      latitude: coordinatesSafe ? row.latitude : undefined,
      longitude: coordinatesSafe ? row.longitude : undefined,
      description: row.shortDescription ?? base?.description,
      operationalTips: row.operationalTips?.length
        ? row.operationalTips
        : base?.operationalTips || [],
      source: row.source,
      lastVerifiedAt: row.lastVerifiedAt,
      actions,
    };
  }
  private operationalCurrent(row: any, field: string) {
    if (field === 'coordinates')
      return Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
        ? { latitude: row.latitude, longitude: row.longitude }
        : undefined;
    if (field === 'hours') return row.operatingHours;
    return row[field];
  }
  private validateOperationalValue(field: string, value: any) {
    if (
      field === 'coordinates' &&
      (!Number.isFinite(value?.latitude) ||
        !Number.isFinite(value?.longitude) ||
        value.latitude < -90 ||
        value.latitude > 90 ||
        value.longitude < -180 ||
        value.longitude > 180)
    )
      throw new BadRequestException('Valid coordinate pair is required');
    if (field === 'phone' && (typeof value !== 'string' || !value.trim()))
      throw new BadRequestException('A non-empty phone value is required');
    if (field === 'hours' && !Array.isArray(value))
      throw new BadRequestException('Hours must be an array');
    if (
      ['parking', 'accessibility'].includes(field) &&
      (!value || typeof value !== 'object' || Array.isArray(value))
    )
      throw new BadRequestException('Structured operational evidence required');
  }
  private applyOperationalValue(row: any, field: string, value: any) {
    if (field === 'coordinates') {
      row.latitude = value.latitude;
      row.longitude = value.longitude;
    } else if (field === 'hours') row.operatingHours = value;
    else row[field] = value;
  }
}
