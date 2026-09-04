import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID, createHash } from 'node:crypto';
import { RegionalDataRecord } from './regional-data.schema';
import { REGIONAL_CANDIDATE_DATASETS } from '../regions/regional-candidate.registry';
import type { AdminPrincipal } from './admin-token.guard';
import { businessFacts, businessIdentity, businessInput, businessScope } from './business-registration.policy';
const fingerprint = (v: any) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
@Injectable()
export class BusinessRegistrationService {
  constructor(@InjectModel(RegionalDataRecord.name) private rows: Model<RegionalDataRecord>) {}
  async list(principal: AdminPrincipal, regionId: string, search = '') {
    businessScope(principal, regionId);
    const rows = await this.rows.find({ regionId }).lean();
    const needle = search.trim().toLowerCase();
    return rows.filter(r => !needle || r.displayName.toLowerCase().includes(needle)).slice(0,50);
  }
  async duplicates(principal: AdminPrincipal, regionId: string, raw: any, excluding?: string) {
    businessScope(principal,regionId);
    const fields = businessInput(raw), keys = businessIdentity(fields);
    const rows: any[] = await this.rows.find({regionId}).lean();
    const all = [...rows.map(r => ({...r,...r.registration?.input})), ...REGIONAL_CANDIDATE_DATASETS.hapcheon.records.map(r => ({...r,displayName:r.canonicalLabelKo,canonicalEntityId:r.entityUri}))];
    return [...new Map(all.filter(r => (!excluding || r.id !== excluding) && businessIdentity(r).some(k => keys.includes(k))).map(r => [r.canonicalEntityId,{id:r.id,displayName:r.displayName,address:r.address,canonicalEntityId:r.canonicalEntityId}])).values()];
  }
  async create(principal: AdminPrincipal, regionId: string, raw: any) {
    businessScope(principal,regionId); const input = businessInput(raw);
    const duplicates = await this.duplicates(principal,regionId,input);
    if (duplicates.length) throw new ConflictException({message:'중복 후보가 있습니다. 등록된 업소를 확인해 주세요.',duplicates});
    const id = `hapcheon-business-${randomUUID()}`, at = new Date().toISOString();
    try { return await this.rows.create({id,canonicalEntityId:`urn:regional-business:${id}`,regionId,
      displayName:input.displayName, entityType:businessFacts(input).entityType,category:businessFacts(input).category,
      proposedFacts:businessFacts(input),source:{sourceType:'OFFICIAL_BUSINESS',sourceUrl:input.sourceUrl,verifiedAt:input.verifiedOn},
      lifecycleStatus:'NEW_CANDIDATE',verificationStatus:'UNVERIFIED',registration:{revision:1,input},registrationKeys:businessIdentity(input),
      auditTrail:[{action:'BUSINESS_CREATED',actorId:principal.actorId,regionId,at}]});
    } catch (e) { if (e.code === 11000) throw new ConflictException('다른 관리자가 같은 업소를 등록했습니다. 다시 검색해 주세요.'); throw e; }
  }
  async change(principal: AdminPrincipal, regionId: string, id: string, action: string, body: any) {
    businessScope(principal,regionId);
    const row:any = await this.rows.findOne({id,regionId}).lean();
    if (!row?.registration) throw new NotFoundException('신규 등록 절차의 업소가 아닙니다.');
    if (!body || Object.keys(body).some(k => !['revision','input','confirmed'].includes(k)) || body.revision !== row.registration.revision) throw new ConflictException('업소를 다시 불러온 뒤 확인해 주세요.');
    let fields:any = {}, registration = {...row.registration,revision:row.registration.revision+1};
    if (action === 'EDIT') {
      const input = businessInput(body.input);
      if ((await this.duplicates(principal,regionId,input,id)).length) throw new ConflictException('중복 업소를 확인해 주세요.');
      registration = {...registration,input,reviewedFingerprint:null};
      fields = {displayName:input.displayName,proposedFacts:businessFacts(input),registrationKeys:businessIdentity(input),
        source:{sourceType:'OFFICIAL_BUSINESS',sourceUrl:input.sourceUrl,verifiedAt:input.verifiedOn},lifecycleStatus:'NEEDS_VERIFICATION',verificationStatus:'REVERIFY_REQUIRED'};
    } else if (action === 'VERIFY') {
      if (body.confirmed !== true) throw new BadRequestException('공식 근거와 기본정보를 명시적으로 확인해 주세요.');
      businessInput(registration.input);
      registration.reviewedFingerprint = fingerprint(registration.input); registration.reviewedBy = principal.actorId; registration.reviewedAt = new Date().toISOString();
      fields = {lifecycleStatus:'APPROVED',verificationStatus:'VERIFIED'};
    } else if (action === 'PUBLISH') {
      if (row.lifecycleStatus !== 'APPROVED' || row.verificationStatus !== 'VERIFIED' || registration.reviewedFingerprint !== fingerprint(registration.input)) throw new BadRequestException('검수 완료 후 장소를 공개해 주세요.');
      fields = {...businessFacts(registration.input),lifecycleStatus:'ACTIVE',lastVerifiedAt:registration.reviewedAt};
    } else if (action === 'STOP') fields = {lifecycleStatus:'ARCHIVED',verificationStatus:'REVERIFY_REQUIRED'};
    else throw new BadRequestException('지원하지 않는 조치입니다.');
    const updated = await this.rows.findOneAndUpdate({id,regionId,'registration.revision':body.revision},{$set:{...fields,registration},$push:{auditTrail:{action:`BUSINESS_${action}`,actorId:principal.actorId,regionId,at:new Date().toISOString(),changes:{revision:registration.revision,input:registration.input}}}},{new:true}).lean();
    if (!updated) throw new ConflictException('동시에 변경되었습니다. 다시 확인해 주세요.');
    return updated;
  }
}
