import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { RegionalDataService } from '../regional-data/regional-data.service';
import {
  CopilotCandidate,
  CopilotCandidateDocument,
} from './copilot-candidate.schema';
import { assertCopilotAccess, CopilotPrincipal } from './copilot-auth';
import {
  CoreDestination,
  CoreDestinationDocument,
} from './core-destination.schema';
import { INITIAL_CORE_DESTINATIONS } from './core-destination.config';
import { isDiscoveryEligible } from '../concierge/discovery-eligibility';

@Injectable()
export class CopilotService implements OnModuleInit {
  constructor(
    @InjectModel(CopilotCandidate.name)
    private model: Model<CopilotCandidateDocument>,
    private regional: RegionalDataService,
    @Optional()
    @InjectModel(CoreDestination.name)
    private cores?: Model<CoreDestinationDocument>,
  ) {}
  async onModuleInit() {
    if (!this.cores) return;
    for (const [regionId, items] of Object.entries(INITIAL_CORE_DESTINATIONS))
      for (const item of items)
        await this.cores.updateOne(
          { regionId, displayName: item.displayName },
          {
            $setOnInsert: {
              id: `core-${regionId}-${this.normalize(item.displayName)}`,
              regionId,
              ...item,
              aliases: item.aliases || [],
              active: true,
              auditTrail: [
                {
                  action: 'CORE_DESTINATION_DESIGNATED',
                  actorId: 'SYSTEM_CONFIG',
                  regionId,
                  previous: false,
                  newValue: true,
                  at: new Date().toISOString(),
                },
              ],
            },
          },
          { upsert: true },
        );
  }
  private normalize(value = '') {
    return value
      .normalize('NFKC')
      .toLocaleLowerCase('ko-KR')
      .replace(/[^0-9a-z가-힣]/g, '');
  }
  async ingestSearchCandidate(input: any) {
    if (
      !input?.regionId ||
      !input?.displayName ||
      !input?.category ||
      !input?.evidence?.sourceType
    )
      throw new BadRequestException('Structured search evidence is required');
    const fingerprint = this.normalize(
        `${input.displayName}:${input.address || ''}:${input.phone || ''}`,
      ),
      now = new Date().toISOString();
    const safe = {
      id: `cop-${randomUUID()}`,
      regionId: input.regionId,
      fingerprint,
      displayName: input.displayName,
      category: input.category,
      entityType: input.entityType || input.category,
      address: input.address,
      phone: input.phone,
      latitude: input.latitude,
      longitude: input.longitude,
      provenance: {
        name: input.evidence,
        address: input.address ? input.evidence : undefined,
        phone: input.phone ? input.evidence : undefined,
        coordinates:
          Number.isFinite(input.latitude) && Number.isFinite(input.longitude)
            ? input.evidence
            : undefined,
      },
      evidence: {
        sourceType: input.evidence.sourceType,
        sourceUrl: input.evidence.sourceUrl,
        providerCategory: input.evidence.providerCategory,
        demandSignal: input.evidence.demandSignal,
        discoveredAt: input.evidence.discoveredAt || now,
      },
      status: 'DISCOVERED' as const,
      auditTrail: [
        {
          action: 'SEARCH_CANDIDATE_INGESTED',
          at: now,
          source: { sourceType: input.evidence.sourceType },
        },
      ],
    };
    const existing: any = await this.model.findOne({
      regionId: input.regionId,
      fingerprint,
    });
    if (existing) return existing.toObject();
    const created: any = await this.model.create(safe);
    return created.toObject();
  }
  async queue(user: CopilotPrincipal, regionId: string) {
    assertCopilotAccess(user, regionId);
    const candidates: any[] = await this.model
        .find({ regionId, status: { $nin: ['ACTIVE', 'REJECTED'] } })
        .lean(),
      rdm: any[] = await this.regional.list({ regionId }),
      health = await this.coreHealth(user, regionId);
    const tasks = [
      ...health.items
        .filter((x: any) => x.health !== 'HEALTHY')
        .map((x: any) => ({
          taskId: `core:${x.core.id}`,
          regionId,
          type: 'CORE_DESTINATION_COVERAGE_GAP',
          priority: x.health === 'CRITICAL' ? 0 : 1,
          core: x.core,
          diagnostic: x,
          reason: x.summary,
          evidence: x.evidence,
          createdAt: x.core.createdAt,
          status: x.health,
        })),
      ...candidates.map((x) => ({
        taskId: `candidate:${x.id}`,
        regionId,
        type: 'SEARCH_DISCOVERED_ENTITY',
        priority: x.status === 'REVIEW' ? 1 : 2,
        candidate: x,
        reason: '관광객 검색에서 발견됐지만 VERIFIED RDM 일치 항목이 없습니다.',
        evidence: x.evidence,
        createdAt: (x as any).createdAt,
        status: x.status,
      })),
      ...rdm
        .filter((x) =>
          ['NEW_CANDIDATE', 'NEEDS_VERIFICATION', 'CHANGE_DETECTED'].includes(
            x.lifecycleStatus,
          ),
        )
        .map((x) => ({
          taskId: `rdm:${x.id}`,
          regionId,
          type:
            x.lifecycleStatus === 'CHANGE_DETECTED'
              ? 'DATA_CHANGE_CANDIDATE'
              : 'UNVERIFIED_ENTITY',
          priority: 1,
          entity: x,
          reason: '운영 데이터 반영 전에 관리자 확인이 필요합니다.',
          evidence: x.source,
          createdAt: (x as any).createdAt,
          status: x.lifecycleStatus,
        })),
    ];
    return [...new Map(tasks.map((x) => [x.taskId, x])).values()].sort(
      (a: any, b: any) => a.priority - b.priority,
    );
  }
  async coreHealth(user: CopilotPrincipal, regionId: string) {
    assertCopilotAccess(user, regionId);
    const cores: any[] = this.cores
        ? await this.cores.find({ regionId, active: true }).lean()
        : [],
      dataset = await this.regional.effectiveDataset(regionId),
      records: any[] = dataset?.records || [],
      rdm: any[] = await this.regional.list({ regionId }),
      search: any[] = await this.model
        .find({ regionId, status: { $nin: ['ACTIVE', 'REJECTED'] } })
        .lean();
    const items = cores.map((core) =>
      this.diagnoseCore(core, records, rdm, search),
    );
    return {
      regionId,
      total: items.length,
      healthy: items.filter((x) => x.health === 'HEALTHY').length,
      warning: items.filter((x) => x.health === 'WARNING').length,
      critical: items.filter((x) => x.health === 'CRITICAL').length,
      items,
    };
  }
  async coreDetail(user: CopilotPrincipal, id: string) {
    const core: any = await this.cores?.findOne({ id });
    if (!core) throw new NotFoundException();
    assertCopilotAccess(user, core.regionId);
    const health = await this.coreHealth(user, core.regionId);
    return health.items.find((x: any) => x.core.id === id);
  }
  async designateCore(user: CopilotPrincipal, input: any, confirmed: boolean) {
    assertCopilotAccess(user, input?.regionId, true);
    if (!confirmed)
      throw new ForbiddenException('Explicit confirmation required');
    if (!this.cores || !input?.displayName || !input?.expectedCategory)
      throw new BadRequestException(
        'Core destination identity and category are required',
      );
    const existing: any = await this.cores.findOne({
      regionId: input.regionId,
      displayName: input.displayName,
    });
    if (existing) {
      const previous = existing.active;
      Object.assign(existing, {
        canonicalEntityId: input.canonicalEntityId,
        expectedCategory: input.expectedCategory,
        aliases: input.aliases || existing.aliases,
        active: true,
      });
      existing.auditTrail.push({
        action: 'CORE_DESTINATION_DESIGNATED',
        actorId: user.sub,
        regionId: input.regionId,
        entityId: input.canonicalEntityId,
        previous,
        newValue: true,
        at: new Date().toISOString(),
      });
      await existing.save();
      return existing.toObject();
    }
    const created: any = await this.cores.create({
      id: `core-${input.regionId}-${this.normalize(input.displayName)}`,
      regionId: input.regionId,
      canonicalEntityId: input.canonicalEntityId,
      displayName: input.displayName,
      expectedCategory: input.expectedCategory,
      aliases: input.aliases || [],
      active: true,
      auditTrail: [
        {
          action: 'CORE_DESTINATION_DESIGNATED',
          actorId: user.sub,
          regionId: input.regionId,
          entityId: input.canonicalEntityId,
          previous: false,
          newValue: true,
          at: new Date().toISOString(),
        },
      ],
    });
    return created.toObject();
  }
  async removeCore(user: CopilotPrincipal, id: string, confirmed: boolean) {
    const row: any = await this.cores?.findOne({ id });
    if (!row) throw new NotFoundException();
    assertCopilotAccess(user, row.regionId, true);
    if (!confirmed)
      throw new ForbiddenException('Explicit confirmation required');
    row.active = false;
    row.auditTrail.push({
      action: 'CORE_DESTINATION_REMOVED',
      actorId: user.sub,
      regionId: row.regionId,
      entityId: row.canonicalEntityId,
      previous: true,
      newValue: false,
      at: new Date().toISOString(),
    });
    await row.save();
    return row.toObject();
  }
  async reviewCoreCoverage(
    user: CopilotPrincipal,
    id: string,
    confirmed: boolean,
  ) {
    const row: any = await this.cores?.findOne({ id });
    if (!row) throw new NotFoundException();
    assertCopilotAccess(user, row.regionId, true);
    if (!confirmed)
      throw new ForbiddenException('Explicit confirmation required');
    const diagnostic = await this.coreDetail(user, id);
    if (!diagnostic) throw new NotFoundException();
    row.auditTrail.push({
      action: 'CORE_COVERAGE_REVIEWED',
      actorId: user.sub,
      regionId: row.regionId,
      entityId: row.canonicalEntityId,
      previous: diagnostic.health,
      newValue: 'REVIEWED',
      at: new Date().toISOString(),
    });
    await row.save();
    return diagnostic;
  }
  async approveCoreFix(
    user: CopilotPrincipal,
    id: string,
    fixType: string,
    confirmed: boolean,
  ) {
    const row: any = await this.cores?.findOne({ id });
    if (!row) throw new NotFoundException();
    assertCopilotAccess(user, row.regionId, true);
    if (!confirmed)
      throw new ForbiddenException('Explicit confirmation required');
    if (!row.canonicalEntityId)
      throw new BadRequestException(
        'Missing destinations must enter the candidate review workflow',
      );
    const diagnostic = await this.coreDetail(user, id);
    if (!diagnostic) throw new NotFoundException();
    let editedFacts: any;
    if (fixType === 'CATEGORY' && !diagnostic.evidence.discoveryEligible)
      editedFacts = { category: row.expectedCategory };
    else if (fixType === 'ALIAS' && !diagnostic.evidence.aliasResolved)
      editedFacts = {
        aliases: [
          ...new Set([
            ...(diagnostic.evidence.aliases || []),
            row.displayName,
            ...(row.aliases || []),
          ]),
        ],
      };
    else
      throw new BadRequestException(
        'The proposed fix is not applicable to the current diagnosis',
      );
    await this.regional.approveCoreCoverageFix(
      row.regionId,
      row.canonicalEntityId,
      editedFacts,
      { actorId: user.sub },
    );
    row.auditTrail.push({
      action: 'CORE_COVERAGE_FIX_APPROVED',
      actorId: user.sub,
      regionId: row.regionId,
      entityId: row.canonicalEntityId,
      previous: diagnostic.evidence,
      newValue: editedFacts,
      at: new Date().toISOString(),
    });
    await row.save();
    return this.coreDetail(user, id);
  }
  async detail(user: CopilotPrincipal, id: string) {
    const row: any = await this.model.findOne({ id });
    if (!row) throw new NotFoundException();
    assertCopilotAccess(user, row.regionId);
    const duplicates = await this.duplicates(row);
    return {
      candidate: row.toObject(),
      duplicateWarning: duplicates.length
        ? '기존 업체와 동일할 가능성이 있습니다.'
        : undefined,
      possibleDuplicates: duplicates,
      why: [
        '관광객 검색에서 발견됨',
        'VERIFIED RDM 일치 항목 없음',
        '지역 운영정보 반영 전 사람의 검토 필요',
      ],
    };
  }
  async review(user: CopilotPrincipal, id: string, edited: any = {}) {
    const row: any = await this.model.findOne({ id });
    if (!row) throw new NotFoundException();
    assertCopilotAccess(user, row.regionId, true);
    if (
      !['DISCOVERED', 'CANDIDATE', 'NEEDS_MORE_EVIDENCE', 'REVIEW'].includes(
        row.status,
      )
    )
      throw new BadRequestException('Candidate cannot be reviewed');
    const allowed = [
      'displayName',
      'category',
      'entityType',
      'address',
      'phone',
      'latitude',
      'longitude',
    ];
    const previous = Object.fromEntries(allowed.map((k) => [k, row[k]]));
    for (const key of allowed)
      if (edited[key] !== undefined) row[key] = edited[key];
    row.status = 'REVIEW';
    row.auditTrail.push({
      action: Object.keys(edited).length
        ? 'CANDIDATE_EDITED'
        : 'CANDIDATE_REVIEWED',
      actorId: user.sub,
      regionId: row.regionId,
      previous,
      newValue: Object.fromEntries(allowed.map((k) => [k, row[k]])),
      at: new Date().toISOString(),
    });
    await row.save();
    return row.toObject();
  }
  async activate(
    user: CopilotPrincipal,
    id: string,
    confirmed: boolean,
    duplicateAcknowledged = false,
  ) {
    const row: any = await this.model.findOne({ id });
    if (!row) throw new NotFoundException();
    assertCopilotAccess(user, row.regionId, true);
    if (!confirmed)
      throw new ForbiddenException('Explicit human confirmation required');
    if (!['REVIEW', 'VERIFIED'].includes(row.status))
      throw new BadRequestException('Candidate must be reviewed first');
    if (!row.displayName || !row.category || !row.evidence?.sourceUrl)
      throw new BadRequestException('Required operational facts are missing');
    const duplicates = await this.duplicates(row);
    if (duplicates.length && !duplicateAcknowledged)
      throw new ConflictException(
        'Potential duplicate requires manager acknowledgement',
      );
    if (row.status === 'REVIEW') {
      row.status = 'VERIFIED';
      row.auditTrail.push({
        action: 'CANDIDATE_VERIFIED',
        actorId: user.sub,
        regionId: row.regionId,
        previous: 'REVIEW',
        newValue: 'VERIFIED',
        at: new Date().toISOString(),
      });
      await row.save();
    }
    const created: any = await this.regional.create({
      regionId: row.regionId,
      source: {
        sourceType: 'OFFICIAL_MAP_LISTING',
        sourceUrl: row.evidence.sourceUrl,
        sourceName: row.evidence.sourceType,
      },
      proposedFacts: {
        displayName: row.displayName,
        entityType: row.entityType,
        category: row.category,
        address: row.address,
        phone: row.phone,
        latitude: row.latitude,
        longitude: row.longitude,
      },
    });
    const active: any = await this.regional.action(
      created.id,
      'APPROVE',
      undefined,
      {
        actorId: user.sub,
        regionId: row.regionId,
        action: 'CANDIDATE_VERIFIED',
      },
    );
    row.status = 'ACTIVE';
    row.activatedEntityId = active.canonicalEntityId;
    row.auditTrail.push({
      action: 'ENTITY_ACTIVATED',
      actorId: user.sub,
      regionId: row.regionId,
      previous: 'VERIFIED',
      newValue: 'ACTIVE',
      at: new Date().toISOString(),
    });
    await row.save();
    return { candidate: row.toObject(), regionalEntity: active };
  }
  async reject(user: CopilotPrincipal, id: string) {
    const row: any = await this.model.findOne({ id });
    if (!row) throw new NotFoundException();
    assertCopilotAccess(user, row.regionId, true);
    if (row.status === 'ACTIVE')
      throw new BadRequestException(
        'Active entity must be managed through RDM',
      );
    row.status = 'REJECTED';
    row.auditTrail.push({
      action: 'ENTITY_REJECTED',
      actorId: user.sub,
      regionId: row.regionId,
      previous: 'REVIEW',
      newValue: 'REJECTED',
      at: new Date().toISOString(),
    });
    await row.save();
    return row.toObject();
  }
  private async duplicates(row: any) {
    const records: any[] = await this.regional.list({ regionId: row.regionId });
    const name = this.normalize(row.displayName);
    return records
      .filter(
        (x) =>
          this.normalize(x.displayName) === name ||
          Boolean(row.phone && x.phone === row.phone) ||
          (Number.isFinite(row.latitude) &&
            Number.isFinite(x.latitude) &&
            Math.hypot(
              (row.latitude - x.latitude) * 111000,
              (row.longitude - x.longitude) * 88000,
            ) < 30),
      )
      .map((x) => ({
        id: x.id,
        displayName: x.displayName,
        canonicalEntityId: x.canonicalEntityId,
      }));
  }
  private diagnoseCore(core: any, records: any[], rdm: any[], search: any[]) {
    const names = [core.displayName, ...(core.aliases || [])].map((x: string) =>
        this.normalize(x),
      ),
      canonical =
        records.find((x) => x.entityUri === core.canonicalEntityId) ||
        records.find((x) =>
          [x.canonicalLabelKo, ...(x.alternateLabels || [])].some((n: string) =>
            names.includes(this.normalize(n)),
          ),
        ),
      row =
        canonical &&
        rdm.find((x) => x.canonicalEntityId === canonical.entityUri),
      searchMatch = search.find((x) =>
        names.includes(this.normalize(x.displayName)),
      ),
      duplicates = canonical
        ? records.filter(
            (x) =>
              x.entityUri !== canonical.entityUri &&
              [x.canonicalLabelKo, ...(x.alternateLabels || [])].some(
                (n: string) => names.includes(this.normalize(n)),
              ),
          )
        : [];
    const verification =
        row?.verificationStatus || canonical?.runtimeDataStatus,
      lifecycle = row?.lifecycleStatus || (canonical ? 'ACTIVE' : undefined),
      category = canonical?.category,
      coordinates = Boolean(
        Number.isFinite(canonical?.latitude) &&
        Number.isFinite(canonical?.longitude),
      ),
      aliasResolved = Boolean(
        canonical &&
        [canonical.canonicalLabelKo, ...(canonical.alternateLabels || [])].some(
          (n: string) => this.normalize(n) === this.normalize(core.displayName),
        ),
      ),
      eligible = Boolean(
        canonical &&
        isDiscoveryEligible(canonical, core.expectedCategory as any),
      ),
      reasons: string[] = [];
    let health: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY',
      recommendedAction = '상태 유지';
    if (!canonical) {
      health = 'CRITICAL';
      reasons.push(
        searchMatch
          ? '외부 검색에서는 발견되지만 VERIFIED RDM canonical entity가 없습니다.'
          : 'canonical RDM entity를 찾지 못했습니다.',
      );
      recommendedAction = searchMatch ? '후보 검토' : '신규 후보 만들기';
    } else {
      if (verification !== 'VERIFIED') {
        health = 'WARNING';
        reasons.push(`검증 상태가 ${verification || 'UNKNOWN'}입니다.`);
        recommendedAction = '검토하기';
      }
      if (lifecycle !== 'ACTIVE') {
        health = lifecycle === 'ARCHIVED' ? 'CRITICAL' : 'WARNING';
        reasons.push(`운영 상태가 ${lifecycle || 'UNKNOWN'}입니다.`);
        recommendedAction = '활성화 검토';
      }
      if (!eligible) {
        health = 'WARNING';
        reasons.push(
          `${category || '미분류'} 카테고리가 ${core.expectedCategory} 탐색 자격과 일치하지 않습니다.`,
        );
        recommendedAction = '카테고리 수정 검토';
      }
      if (!coordinates) {
        health = 'WARNING';
        reasons.push('운영 가능한 좌표가 없습니다.');
        recommendedAction = '좌표 검토';
      }
      if (!aliasResolved) {
        health = 'WARNING';
        reasons.push(
          '대표 이름이 canonical label 또는 alias로 해석되지 않습니다.',
        );
        recommendedAction = '검색 이름 추가';
      }
      if (duplicates.length) {
        health = 'WARNING';
        reasons.push(
          '동일 이름/alias를 공유하는 canonical 후보가 여러 개입니다.',
        );
        recommendedAction = '중복 검토';
      }
    }
    if (!reasons.length)
      reasons.push(
        'VERIFIED/ACTIVE이며 카테고리, 좌표, 이름 해석과 관광지 탐색 자격이 정상입니다.',
      );
    return {
      core,
      health,
      summary:
        health === 'HEALTHY'
          ? `${core.displayName}은 정상적으로 서비스 가능한 핵심 장소입니다.`
          : `${core.displayName}은 핵심 장소지만 현재 정상 노출을 위해 확인이 필요합니다.`,
      reasons,
      recommendedAction,
      evidence: {
        canonicalMatch: canonical
          ? { entityId: canonical.entityUri, label: canonical.canonicalLabelKo }
          : undefined,
        verificationStatus: verification,
        lifecycleStatus: lifecycle,
        category,
        coordinatesAvailable: coordinates,
        aliases: canonical?.alternateLabels || [],
        aliasResolved,
        discoveryEligible: eligible,
        searchOnly: Boolean(!canonical && searchMatch),
        duplicateCount: duplicates.length,
        operationalActionEligible: Boolean(canonical?.actions?.navigate),
      },
    };
  }
}
