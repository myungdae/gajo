import { RegionalDataService } from './regional-data.service';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlaceDiscoveryService } from '../concierge/place-discovery.service';
import { OKCHEON_MASTER_DATA } from '../regions/okcheon/master-data';
import { REGIONAL_CANDIDATE_DATASETS } from '../regions/regional-candidate.registry';
import { FacilityService } from '../facility/facility.service';
import { FacilityController } from '../facility/facility.controller';
import { MasterDataService } from '../master-data/master-data.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { DecisionPipelineService } from '../recommendation/decision-pipeline.service';
import { DISCOVERY_CATEGORY_MATCH } from '../concierge/discovery-eligibility';
function model() {
  const rows: any[] = [];
  const document = (value: any) => ({
    _id: value.id,
    __v: 0,
    ...value,
    toObject() {
      const { save, toObject, markModified, ...plain } = this;
      return structuredClone(plain);
    },
    markModified() {},
    async save() {
      return this;
    },
  });
  const match = (row: any, q: any) =>
    Object.entries(q || {}).every(([k, v]) => row[k] === v);
  const wrap = (items: any[]) => ({
    sort: () => ({ lean: async () => items }),
    lean: async () => items,
  });
  return {
    rows,
    collection: {
      async findOne(q: any) { return rows.find(row => match(row, q))?.toObject(); },
      async findOneAndUpdate(q: any, update: any) {
        const row = rows.find(row => row._id === q._id);
        if (!row || JSON.stringify(row.toObject()) !== JSON.stringify(q.$expr.$eq[1].$literal)) return null;
        Object.assign(row, update.$set);
        delete row.proposedFacts;
        row.__v += update.$inc.__v;
        row.auditTrail.push(update.$push.auditTrail);
        return row.toObject();
      },
    },
    find: jest.fn((q: any) => wrap(rows.filter((r) => match(r, q)))),
    findOne: jest.fn(async (q: any) => rows.find((r) => match(r, q))),
    create: jest.fn(async (v: any) => {
      const row = document(v);
      rows.push(row);
      return row;
    }),
    updateOne: jest.fn(async (q: any, u: any) => {
      const row = rows.find((r) => match(r, q));
      if (!row && u.$setOnInsert) rows.push(document(u.$setOnInsert));
      else if (row && u.$push)
        for (const [key, value] of Object.entries(u.$push))
          (row[key] ||= []).push(value);
      return {};
    }),
  };
}
const source = {
  sourceType: 'OFFICIAL_BUSINESS',
  sourceUrl: 'https://official.example/place',
};
describe('RegionalDataService', () => {
  describe.each(['gajo', 'hapcheon', 'okcheon', 'muan'])('public identity boundary: %s', (regionId) => {
    const base = REGIONAL_CANDIDATE_DATASETS[regionId].records.find(row => Object.values(DISCOVERY_CATEGORY_MATCH).some(matches => matches(row)))!;
    const proposed = { displayName: '미승인 후보명 전용', aliases: ['미승인 별칭 전용'], entityType: 'ATTRACTION', category: 'TOURISM_NATURE' };
    const publicViews = async (service: RegionalDataService) => {
      const master = new MasterDataService({} as any);
      const facilityModel = { find: () => ({ sort: () => ({ lean: async () => master.places().map(row => ({ uri: row.entityUri, label: row.canonicalLabelKo })) }) }) };
      const api = new FacilityController(new FacilityService(facilityModel as any, {} as any, master, service));
      const stored = { create: async (value: any) => ({ toObject: () => value }) };
      const recommendation = new RecommendationService(stored as any, stored as any,
        { findSuitablePrograms: () => [], findEnvironmentAffected: () => [], findRiskMitigations: () => [] } as any,
        new DecisionPipelineService(), {} as any, master, service);
      return [await service.effectiveDataset(regionId),
        await new PlaceDiscoveryService(service).discover(regionId, 'TOURISM_NATURE', '관광지 추천', {}),
        await api.listFacilities(regionId), await api.operationalPlaces(regionId),
        await recommendation.buildRecommendation({ regionId, contextNo: 'PUBLIC_TEST', currentTime: '10:00', stayUntil: '18:00' })];
    };
    it('approving only coordinates preserves the baseline name across public APIs, search and recommendation while review retains proposals', async () => {
      const db = model(), service = new RegionalDataService(db as any);
      const row: any = await service.create({ regionId, canonicalEntityId: base.entityUri, source, proposedFacts: proposed });
      await service.proposeOperationalEvidence(regionId, base.entityUri, 'coordinates', {
        proposed: { latitude: 36, longitude: 128 }, source, observedAt: '2026-09-06T00:00:00Z',
      }, 'OPS_TEST');
      await service.decideOperationalEvidence(regionId, base.entityUri, 'coordinates', 'APPROVE', 'OPS_TEST', true);
      const resolver = new PlaceDiscoveryService(service);
      await expect(resolver.resolveExactPlaceIntent(regionId, proposed.displayName)).resolves.toBeUndefined();
      await expect(resolver.resolveExactPlaceIntent(regionId, proposed.aliases[0])).resolves.toBeUndefined();
      await expect(resolver.resolveExactPlaceIntent(regionId, base.canonicalLabelKo)).resolves.toMatchObject({ entityId: base.entityUri, label: base.canonicalLabelKo });
      const views = JSON.stringify(await publicViews(service));
      expect(views).not.toContain(proposed.displayName);
      expect(views).not.toContain(proposed.aliases[0]);
      expect((await service.list({ regionId })).find(item => item.id === row.id).proposedFacts).toEqual(proposed);
    });
    it('keeps a partial candidate without an approved or baseline name entirely out of public datasets', async () => {
      const db = model(), service = new RegionalDataService(db as any);
      const row: any = await service.create({ regionId, source, proposedFacts: proposed });
      db.rows[0].aliases = proposed.aliases;
      await service.proposeOperationalEvidence(regionId, row.canonicalEntityId, 'coordinates', {
        proposed: { latitude: 36, longitude: 128 }, source, observedAt: '2026-09-06T00:00:00Z',
      }, 'OPS_TEST');
      await expect(service.decideOperationalEvidence(regionId, row.canonicalEntityId, 'coordinates', 'APPROVE', 'OPS_TEST', true))
        .resolves.toMatchObject({ entity: { identityApprovalRequired: true, navigationEligible: false, proposedFacts: proposed } });
      const views = JSON.stringify(await publicViews(service));
      expect(views).not.toContain(row.canonicalEntityId);
      expect(views).not.toContain(proposed.displayName);
      expect(views).not.toContain(proposed.aliases[0]);
      await expect(new PlaceDiscoveryService(service).resolveExactPlaceIntent(regionId, proposed.displayName)).resolves.toBeUndefined();
    });
    it('preserves approved current identity and resolves only the official canonical when a proposal uses its name', async () => {
      const db = model(), service = new RegionalDataService(db as any);
      const current: any = await service.create({ regionId, canonicalEntityId: 'urn:test:approved-current', source,
        proposedFacts: { ...proposed, displayName: '승인된 현재명', aliases: ['승인된 현재별칭'] } });
      await service.action(current.id, 'APPROVE');
      await service.create({ regionId, canonicalEntityId: current.canonicalEntityId, source,
        proposedFacts: { ...proposed, displayName: base.canonicalLabelKo } });
      const resolver = new PlaceDiscoveryService(service);
      await expect(resolver.resolveExactPlaceIntent(regionId, '승인된 현재명')).resolves.toMatchObject({ entityId: current.canonicalEntityId });
      await expect(resolver.resolveExactPlaceIntent(regionId, base.canonicalLabelKo)).resolves.toMatchObject({ entityId: base.entityUri });
      await expect(resolver.resolveExactPlaceIntent(regionId, proposed.aliases[0])).resolves.toBeUndefined();
      expect(JSON.stringify(await publicViews(service))).not.toContain(proposed.aliases[0]);
    });
  });
  it('applies the same public name boundary to a newly registered region', async () => {
    const regionId = 'future-public-region';
    const base = { ...REGIONAL_CANDIDATE_DATASETS.hapcheon.records[0], entityUri: 'urn:future:base', regionId,
      canonicalLabelKo: '미래 승인 공원', alternateLabels: ['미래 승인 별칭'], entityType: 'ATTRACTION', category: 'TOURISM_NATURE' };
    REGIONAL_CANDIDATE_DATASETS[regionId] = { ...REGIONAL_CANDIDATE_DATASETS.hapcheon, regionId, records: [base] };
    try {
      const db = model(), service = new RegionalDataService(db as any);
      await service.create({ regionId, canonicalEntityId: base.entityUri, source, proposedFacts: { displayName: '미래 미승인 이름' } });
      Object.assign(db.rows[0], { lifecycleStatus: 'ACTIVE', verificationStatus: 'PARTIAL', aliases: ['미래 미승인 별칭'],
        fieldEvidence: { coordinates: { status: 'APPROVED' } }, latitude: 36, longitude: 128 });
      const resolver = new PlaceDiscoveryService(service);
      await expect(resolver.resolveExactPlaceIntent(regionId, base.canonicalLabelKo)).resolves.toMatchObject({ entityId: base.entityUri });
      await expect(resolver.resolveExactPlaceIntent(regionId, '미래 미승인 이름')).resolves.toBeUndefined();
      await expect(resolver.resolveExactPlaceIntent(regionId, '미래 미승인 별칭')).resolves.toBeUndefined();
      const facilities = new FacilityService({} as any, {} as any, {} as any, service);
      expect(JSON.stringify([await facilities.listFacilities(regionId), await facilities.operationalPlaces(regionId),
        await resolver.discover(regionId, 'TOURISM_NATURE', '관광지 추천', {})])).not.toContain('미승인');
    } finally { delete REGIONAL_CANDIDATE_DATASETS[regionId]; }
  });
  it.each(['OFFICIAL_LOCAL_GOV', 'OFFICIAL_BUSINESS', 'KTO', 'OFFICIAL_MAP_LISTING', 'OTHER_VERIFIED_SOURCE'])('treats %s observations as review suggestions, never an implicit canonical assignment', async (sourceType) => {
    const db = model(), service = new RegionalDataService(db as any);
    const facts = { displayName: '독립 검토 공원', address: '검토로 101', phone: '01012345678', latitude: 36, longitude: 128, entityType: 'ATTRACTION', category: 'TOURISM_NATURE' };
    const reviewed: any = await service.create({ regionId: 'future-region', canonicalEntityId: 'urn:test:reviewed', source: { ...source, sourceType }, proposedFacts: facts });
    await service.action(reviewed.id, 'APPROVE');
    const before = db.rows[0].toObject();
    for (const proposedFacts of [{ displayName: facts.displayName }, facts]) {
      const candidate: any = await service.create({ regionId: 'future-region', source: { ...source, sourceType }, proposedFacts });
      expect(candidate.canonicalEntityId).not.toBe(reviewed.canonicalEntityId);
      expect(candidate.identityCandidates).toEqual([reviewed.canonicalEntityId]);
      expect(candidate.verificationStatus).toBe('UNVERIFIED');
      expect(db.rows[0].toObject()).toEqual(before);
    }
    await expect(service.create({ regionId: 'future-region', canonicalEntityId: reviewed.canonicalEntityId, source: { ...source, sourceType }, proposedFacts: facts })).resolves.toMatchObject({ canonicalEntityId: reviewed.canonicalEntityId, ingestionOutcome: 'UNCHANGED' });
  });
  it('refuses multiple corroborated canonicals without modifying any document', async () => {
    const db = model(), service = new RegionalDataService(db as any);
    const facts = { displayName: '같은 시설명', address: '동일 주소', phone: '01012345678', latitude: 36, longitude: 128, entityType: 'ATTRACTION', category: 'TOURISM_NATURE' };
    for (const canonicalEntityId of ['urn:test:one', 'urn:test:two']) {
      const row: any = await service.create({ regionId: 'future-region', canonicalEntityId, source, proposedFacts: facts });
      await service.action(row.id, 'APPROVE');
    }
    const before = db.rows.map(row => row.toObject());
    await expect(service.create({ regionId: 'future-region', source, proposedFacts: facts })).rejects.toThrow('AMBIGUOUS_CANONICAL_IDENTITY');
    expect(db.rows.map(row => row.toObject())).toEqual(before);
  });
  describe.each(['gajo', 'hapcheon', 'okcheon', 'future-region'])('common identity contract: %s', (regionId) => {
    const facts = { entityType: 'ATTRACTION', category: 'TOURISM_NATURE' };
    it.each(['NEW_CANDIDATE', 'PROPOSED', 'CHANGE_DETECTED'])('does not match unapproved %s display names or aliases', async (lifecycleStatus) => {
      const db = model(), service = new RegionalDataService(db as any);
      const a: any = await service.create({ regionId, canonicalEntityId: 'urn:test:a', source,
        proposedFacts: { ...facts, displayName: '미승인 공원', aliases: ['후보 공원'] } });
      Object.assign(db.rows[0], { lifecycleStatus, aliases: ['후보 공원'] });
      for (const displayName of ['미승인 공원', '후보 공원']) {
        const b: any = await service.create({ regionId, source, proposedFacts: { ...facts, displayName } });
        expect(b.canonicalEntityId).not.toBe(a.canonicalEntityId);
      }
    });
    it('rejects alias collisions without writes, regardless of row order, and isolates regions', async () => {
      const db = model(), service = new RegionalDataService(db as any);
      for (const canonicalEntityId of ['urn:test:a', 'urn:test:b']) {
        const row: any = await service.create({ regionId, canonicalEntityId, source,
          proposedFacts: { ...facts, displayName: canonicalEntityId, aliases: ['공통 공원'] } });
        await service.action(row.id, 'APPROVE');
      }
      for (let index = 0; index < 2; index++) {
        const before = db.rows.map(row => row.toObject());
        await expect(service.create({ regionId, source, proposedFacts: { ...facts, displayName: '공통 공원' } }))
          .rejects.toThrow('AMBIGUOUS_CANONICAL_IDENTITY');
        expect(db.rows.map(row => row.toObject())).toEqual(before);
        db.rows.reverse();
      }
      const other: any = await service.create({ regionId: 'separate-region', source,
        proposedFacts: { ...facts, displayName: '공통 공원' } });
      expect(['urn:test:a', 'urn:test:b']).not.toContain(other.canonicalEntityId);
    });
    it('does not use incoming proposed aliases as identity evidence', async () => {
      const db = model(), service = new RegionalDataService(db as any);
      const a: any = await service.create({ regionId, canonicalEntityId: 'urn:test:a', source,
        proposedFacts: { ...facts, displayName: '승인 공원' } });
      await service.action(a.id, 'APPROVE');
      const b: any = await service.create({ regionId, source,
        proposedFacts: { ...facts, displayName: '별개 공원', aliases: ['승인 공원'] } });
      expect(b.canonicalEntityId).not.toBe(a.canonicalEntityId);
    });
  });
  it('detects collisions across the static baseline and approved database records', async () => {
    const db = model(), service = new RegionalDataService(db as any);
    const row: any = await service.create({ regionId: 'hapcheon', canonicalEntityId: 'urn:test:collision', source,
      proposedFacts: { displayName: '별도 촬영공원', aliases: ['영상테마파크'], entityType: 'ATTRACTION', category: 'TOURISM_NATURE' } });
    await service.action(row.id, 'APPROVE');
    await expect(service.create({ regionId: 'hapcheon', source, proposedFacts: { displayName: '영상테마파크' } }))
      .rejects.toThrow('AMBIGUOUS_CANONICAL_IDENTITY');
  });
  it('moves Busodamak from evidence review to navigation only after explicit field approval and recomputes readiness without cross-region writes', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    await service.onModuleInit();
    const busodamak = OKCHEON_MASTER_DATA.find(
      (x) => x.canonicalLabelKo === '부소담악',
    )!;
    const gajoBefore = JSON.stringify(
        db.rows.filter((x) => x.regionId === 'gajo'),
      ),
      hapcheonBefore = JSON.stringify(
        db.rows.filter((x) => x.regionId === 'hapcheon'),
      ),
      before: any = await service.operationalReadiness('okcheon');
    expect(
      before.matrix.find(
        (x: any) => x.canonicalEntityId === busodamak.entityUri,
      ),
    ).toMatchObject({
      classification: 'NEEDS_COORDINATES',
      navigationEligible: false,
    });
    await service.proposeOperationalEvidence(
      'okcheon',
      busodamak.entityUri,
      'coordinates',
      {
        proposed: { latitude: 36.3522824857, longitude: 127.5637131168 },
        source: {
          sourceType: 'KTO_LINKED_DATA',
          sourceName: '한국관광공사 관광정보 Linked Open Data',
          sourceUrl: 'https://data.visitkorea.or.kr/linkedview/1940660',
        },
        observedAt: '2026-08-22T00:00:00.000Z',
        confidence: 'MATCHED_OFFICIAL_ADDRESS',
        evidenceStatus: 'EVIDENCE_ONLY',
        whyReviewNeeded:
          '공식 주소와 후보 지점이 일치하는지 길찾기 활성화 전에 확인해야 합니다.',
      },
      'manager-okcheon',
    );
    expect(
      (await service.effectiveDataset('okcheon'))!.records.find(
        (x) => x.entityUri === busodamak.entityUri,
      )!.actions,
    ).not.toHaveProperty('navigate');
    await expect(
      service.decideOperationalEvidence(
        'okcheon',
        busodamak.entityUri,
        'coordinates',
        'APPROVE',
        'manager-okcheon',
        false,
      ),
    ).rejects.toThrow('confirmation');
    const approved: any = await service.decideOperationalEvidence(
      'okcheon',
      busodamak.entityUri,
      'coordinates',
      'APPROVE',
      'manager-okcheon',
      true,
    );
    expect(approved.entity).toMatchObject({
      classification: 'ACTION_READY',
      navigationEligible: true,
      coordinates: { latitude: 36.3522824857, longitude: 127.5637131168 },
    });
    expect(approved.readiness.summary.navigationReady).toBe(
      before.summary.navigationReady + 1,
    );
    const effective = (await service.effectiveDataset('okcheon'))!.records.find(
      (x) => x.entityUri === busodamak.entityUri,
    )!;
    expect(effective.actions).toMatchObject({
      navigate: { latitude: 36.3522824857, longitude: 127.5637131168 },
    });
    const conciergeDiscovery = new PlaceDiscoveryService(service as any),
      visitorStops: any[] = await conciergeDiscovery.resolveRequestedDestinations(
        'okcheon',
        ['부소담악'],
      ),
      visitorDiscovery: any = await conciergeDiscovery.discover(
        'okcheon',
        'TOURISM_NATURE',
        '옥천 경치 좋은 곳',
        {},
      );
    expect(visitorStops[0]).toMatchObject({
      label: '부소담악',
      latitude: 36.3522824857,
      longitude: 127.5637131168,
    });
    expect(
      visitorDiscovery.entities.find((x: any) => x.programLabel === '부소담악'),
    ).toMatchObject({
      actions: {
        navigate: { latitude: 36.3522824857, longitude: 127.5637131168 },
      },
    });
    const row = db.rows.find(
      (x) => x.canonicalEntityId === busodamak.entityUri,
    );
    expect(row.verificationStatus).toBe('PARTIAL');
    expect(row.auditTrail.map((x: any) => x.action)).toEqual(
      expect.arrayContaining([
        'OPERATIONAL_EVIDENCE_REVIEWED',
        'COORDINATE_APPROVED',
      ]),
    );
    expect(JSON.stringify(db.rows.filter((x) => x.regionId === 'gajo'))).toBe(
      gajoBefore,
    );
    expect(
      JSON.stringify(db.rows.filter((x) => x.regionId === 'hapcheon')),
    ).toBe(hapcheonBefore);
  });
  it('ingests the curated Hapcheon batch idempotently and keeps review metadata visitor-invisible until individual approval', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    const batch = JSON.parse(
      readFileSync(
        join(
          __dirname,
          '../../operations/hapcheon-first-batch.candidates.json',
        ),
        'utf8',
      ),
    );
    const first = [] as any[];
    for (const item of batch) first.push(await service.create(item));
    expect(first).toHaveLength(9);
    expect(
      first.find((x) => x.displayName === '합천 영상테마파크'),
    ).toMatchObject({
      canonicalEntityId: 'urn:regional:hapcheon:hapcheon-video-theme-park',
      lifecycleStatus: 'NEW_CANDIDATE',
    });
    expect(db.rows).toHaveLength(9);
    const second = [] as any[];
    for (const item of batch) second.push(await service.create(item));
    expect(db.rows).toHaveLength(9);
    expect(second.every((x) => x.ingestionOutcome === 'UNCHANGED')).toBe(true);
    const before = (await service.effectiveDataset('hapcheon'))!.records;
    for (const name of [
      '대장경테마파크',
      '해인사소리길',
      '고바우식당',
      '오도산자연휴양림',
      '합천박물관',
    ])
      expect(before.some((x) => x.canonicalLabelKo === name)).toBe(false);
    const odosan = db.rows.find((x) => x.displayName === '오도산자연휴양림');
    await service.action(odosan.id, 'APPROVE');
    const effective = (await service.effectiveDataset(
      'hapcheon',
    ))!.records.find((x) => x.canonicalLabelKo === '오도산자연휴양림')!;
    expect(effective).toMatchObject({
      tags: ['ACCOMMODATION', 'NATURE', 'REST', 'FAMILY'],
      latitude: 35.66525101,
      longitude: 128.0528925,
      parking: { available: true },
      walkingAccess: { upperDeckAccess: expect.stringContaining('20~50m') },
    });
    expect(effective.actions).toMatchObject({
      call: { phone: '055-930-3742' },
      website: { url: expect.stringContaining('foresttrip') },
      navigate: { latitude: 35.66525101, longitude: 128.0528925 },
    });
    expect(effective.actions).not.toHaveProperty('reserve');
    const discovery: any = await new PlaceDiscoveryService(
      service as any,
    ).discover('hapcheon', 'LODGING', '오도산자연휴양림 근처 숙소', {});
    expect(discovery).toMatchObject({
      anchorEntityId: odosan.canonicalEntityId,
      anchorLabel: '오도산자연휴양림',
    });
    expect(
      discovery.entities.some(
        (item: any) => item.entityId === odosan.canonicalEntityId,
      ),
    ).toBe(false);
    expect(
      (await service.effectiveDataset('okcheon'))!.records.some(
        (x) => x.entityUri === odosan.canonicalEntityId,
      ),
    ).toBe(false);
  });
  it('keeps proposed identity evidence out of matching and public search',async()=>{
    const db=model(),service=new RegionalDataService(db as any),facts={entityType:'ATTRACTION',category:'TOURISM_NATURE'};
    const a:any=await service.create({regionId:'hapcheon',canonicalEntityId:'urn:test:a',source,proposedFacts:{displayName:'A 문화공원',aliases:['A 공원'],...facts}});await service.action(a.id,'APPROVE');
    await service.create({regionId:'hapcheon',canonicalEntityId:'urn:test:a',source,proposedFacts:{displayName:'A 문화공원',aliases:['B 문화공원'],...facts}});
    const b:any=await service.create({regionId:'hapcheon',source,proposedFacts:{displayName:'B 문화공원',...facts}});
    expect(b.canonicalEntityId).not.toBe('urn:test:a');expect(db.rows).toHaveLength(2);
    await expect(new PlaceDiscoveryService(service as any).resolveExactPlaceIntent('hapcheon','B 문화공원 찾아줘')).resolves.toBeUndefined();
  });
  it('never merges different explicit canonical identities by similar name and category',async()=>{
    const db=model(),service=new RegionalDataService(db as any);
    for(const [canonicalEntityId,displayName]of[['urn:test:garden','정원 테마파크'],['urn:test:video','영상 테마파크']])await service.create({regionId:'hapcheon',canonicalEntityId,source,proposedFacts:{displayName,aliases:['테마파크'],entityType:'ATTRACTION',category:'TOURISM_NATURE'}});
    expect(db.rows.map(row=>row.canonicalEntityId)).toEqual(['urn:test:garden','urn:test:video']);
  });
  it('IGNORE_CHANGE retains current facts, clears review evidence and leaves other canonicals unchanged',async()=>{
    const db=model(),service=new RegionalDataService(db as any),common={entityType:'ATTRACTION',category:'TOURISM_NATURE'};
    const garden:any=await service.create({regionId:'hapcheon',canonicalEntityId:'urn:test:garden',source,proposedFacts:{displayName:'정원테마파크',aliases:['정원공원'],address:'정원로 1',...common}}),video:any=await service.create({regionId:'hapcheon',canonicalEntityId:'urn:test:video',source,proposedFacts:{displayName:'영상테마파크',aliases:['영상공원'],...common}});
    await service.action(garden.id,'APPROVE');await service.action(video.id,'APPROVE');
    await service.create({regionId:'hapcheon',canonicalEntityId:'urn:test:garden',source,proposedFacts:{displayName:'영상테마파크',aliases:['영상공원'],address:'영상로 2',...common}});
    const current=db.rows.find(row=>row.id===garden.id).toObject(),other=JSON.stringify(db.rows.find(row=>row.id===video.id).toObject());await service.action(garden.id,'IGNORE_CHANGE',undefined,undefined,await service.ignoreChangePreflight(garden.id));const after=db.rows.find(row=>row.id===garden.id);
    expect(after).toMatchObject({displayName:current.displayName,aliases:current.aliases,address:current.address,lifecycleStatus:'ACTIVE',detectedChanges:[]});expect(after).not.toHaveProperty('proposedFacts');expect(after.auditTrail.at(-1).actorId).toBe('SYSTEM_INTERNAL');expect(JSON.stringify(db.rows.find(row=>row.id===video.id).toObject())).toBe(other);
    const resolver=new PlaceDiscoveryService(service as any);await expect(resolver.resolveExactPlaceIntent('hapcheon','정원공원 찾아줘')).resolves.toMatchObject({entityId:'urn:test:garden'});await expect(resolver.resolveExactPlaceIntent('hapcheon','영상공원 찾아줘')).resolves.toMatchObject({entityId:'urn:test:video'});
  });
  it('IGNORE_CHANGE changes only allowlisted fields and preserves both neighboring documents', async () => {
    const db = model(), service = new RegionalDataService(db as any);
    await service.onModuleInit();
    const garden = db.rows.find(row => row.canonicalEntityId === 'https://hapcheon.example/ontology#hapcheonGardenThemePark');
    const neighbors = db.rows.filter(row => [
      'https://hapcheon.example/ontology#hapcheonVideoThemePark',
      'https://hapcheon.example/ontology#hwangmaesanSilverGrassFestival',
    ].includes(row.canonicalEntityId));
    expect(neighbors).toHaveLength(2);
    await service.create({ regionId: garden.regionId, canonicalEntityId: garden.canonicalEntityId, source,
      proposedFacts: { displayName: '합천 영상테마파크', aliases: ['영상테마파크'] } });
    const pre = garden.toObject(), others = neighbors.map(row => row.toObject());
    expect(pre).toMatchObject({ verificationStatus: 'VERIFIED', lifecycleStatus: 'CHANGE_DETECTED' });
    const after = await service.action(garden.id, 'IGNORE_CHANGE', undefined, { actorId: 'RECEIPT32_TEST' }, await service.ignoreChangePreflight(garden.id));
    const allowlist = new Set(['lifecycleStatus', 'detectedChanges', 'proposedFacts', 'auditTrail', 'updatedAt', '__v']);
    const protectedFacts = (row: any) => Object.fromEntries(Object.entries(row).filter(([key]) => !allowlist.has(key)));
    expect(protectedFacts(after)).toEqual(protectedFacts(pre));
    expect(after).toMatchObject({ canonicalEntityId: pre.canonicalEntityId, displayName: pre.displayName,
      verificationStatus: 'VERIFIED', lifecycleStatus: 'ACTIVE', detectedChanges: [] });
    expect(after.proposedFacts).toBeUndefined();
    expect(after.auditTrail.slice(0, -1)).toEqual(pre.auditTrail);
    expect(after.auditTrail).toHaveLength(pre.auditTrail.length + 1);
    expect(after.auditTrail.at(-1)).toMatchObject({ action: 'IGNORE_CHANGE', actorId: 'RECEIPT32_TEST', changes: pre.detectedChanges });
    expect(neighbors.map(row => row.toObject())).toEqual(others);
  });
  it('keeps unapproved candidates out, promotes explicitly approved records, and isolates regions', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    const candidate: any = await service.create({
      regionId: 'hapcheon',
      source,
      proposedFacts: {
        displayName: '검증 후보',
        entityType: 'CAFE',
        category: 'CAFE',
        websiteUrl: 'https://official.example',
      },
    });
    expect(
      (await service.effectiveDataset('hapcheon'))!.records.some(
        (x) => x.canonicalLabelKo === '검증 후보',
      ),
    ).toBe(false);
    await service.action(candidate.id, 'APPROVE');
    const effective = (await service.effectiveDataset('hapcheon'))!;
    expect(
      effective.records.find((x) => x.canonicalLabelKo === '검증 후보')
        ?.actions,
    ).toHaveProperty('website');
    expect(
      (await service.effectiveDataset('okcheon'))!.records.some(
        (x) => x.canonicalLabelKo === '검증 후보',
      ),
    ).toBe(false);
  });
  it('does not overwrite static baseline for a detected change before approval', async () => {
    const db = model(),
      service = new RegionalDataService(db as any),
      id = 'https://hapcheon.example/ontology#hapcheonLakeSmilePension';
    await service.create({
      regionId: 'hapcheon',
      canonicalEntityId: id,
      source,
      proposedFacts: { displayName: '합천호 스마일펜션', phone: '000' },
    });
    expect(
      (await service.effectiveDataset('hapcheon'))!.records.find(
        (x) => x.entityUri === id,
      )?.telephone,
    ).toBe('055-931-1638');
  });
  it('suppresses navigation while an unsafe coordinate change awaits review', async () => {
    const db = model(),
      service = new RegionalDataService(db as any),
      id = 'https://hapcheon.example/ontology#hapcheonLakeSmilePension';
    await service.create({
      regionId: 'hapcheon',
      canonicalEntityId: id,
      source,
      proposedFacts: {
        displayName: '합천호 스마일펜션',
        latitude: 35.6,
        longitude: 128.2,
      },
    });
    const pension = (await service.effectiveDataset('hapcheon'))!.records.find(
      (x) => x.entityUri === id,
    )!;
    expect(pension.actions).not.toHaveProperty('navigate');
    expect(pension.latitude).toBeUndefined();
  });
  it('requires authoritative provenance and verified coordinates enable navigation after approval', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    await expect(
      service.create({
        regionId: 'hapcheon',
        source: { sourceType: 'AI', sourceUrl: '' },
        proposedFacts: { displayName: '가짜' },
      }),
    ).rejects.toBeDefined();
    const row: any = await service.create({
      regionId: 'hapcheon',
      source,
      proposedFacts: {
        displayName: '좌표 장소',
        entityType: 'ATTRACTION',
        category: 'TOURISM_NATURE',
        latitude: 35.5,
        longitude: 128.1,
      },
    });
    await service.action(row.id, 'APPROVE');
    expect(
      (await service.effectiveDataset('hapcheon'))!.records.find(
        (x) => x.canonicalLabelKo === '좌표 장소',
      )?.actions,
    ).toHaveProperty('navigate');
  });
  it('seeds Hapcheon baseline idempotently without duplicate keys', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    await service.onModuleInit();
    await service.onModuleInit();
    expect(
      new Set(db.rows.map((x) => `${x.regionId}:${x.canonicalEntityId}`)).size,
    ).toBe(db.rows.length);
    expect(
      db.rows
        .filter((x) => x.regionId === 'hapcheon')
        .every((x) => x.lifecycleStatus === 'ACTIVE'),
    ).toBe(true);
    expect(db.rows.filter((x) => x.regionId === 'okcheon')).toHaveLength(
      OKCHEON_MASTER_DATA.length,
    );
  });
  it('CROSS_REGION_NON_INTERFERENCE keeps existing regional RDM snapshots unchanged during Okcheon onboarding', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    await service.onModuleInit();
    const snapshot = (regionId: string) =>
      JSON.stringify(
        db.rows
          .filter((x) => x.regionId === regionId)
          .map(({ auditTrail, ...x }) => x),
      );
    const gajoBefore = snapshot('gajo'),
      hapcheonBefore = snapshot('hapcheon');
    const candidate: any = await service.create({
      regionId: 'okcheon',
      source,
      proposedFacts: {
        displayName: '옥천 검색 검토 후보',
        entityType: 'CAFE',
        category: 'CAFE',
      },
    });
    expect(candidate).toMatchObject({
      regionId: 'okcheon',
      verificationStatus: 'UNVERIFIED',
      lifecycleStatus: 'NEW_CANDIDATE',
    });
    expect(snapshot('gajo')).toBe(gajoBefore);
    expect(snapshot('hapcheon')).toBe(hapcheonBefore);
    expect(
      (await service.effectiveDataset('gajo'))!.records.every(
        (x) => !x.entityUri.includes('okcheon'),
      ),
    ).toBe(true);
    expect(
      (await service.effectiveDataset('hapcheon'))!.records.every(
        (x) => !x.entityUri.includes('okcheon'),
      ),
    ).toBe(true);
  });
  it('returns the complete Okcheon operational matrix and deduplicated manager tasks', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    await service.onModuleInit();
    const readiness: any = await service.operationalReadiness('okcheon');
    expect(readiness).toMatchObject({
      regionId: 'okcheon',
      summary: {
        total: 49,
        actionReady: 1,
        navigationReady: 1,
        callReady: 14,
        coordinateCoverage: 17,
      },
      matrix: expect.any(Array),
      tasks: expect.any(Array),
    });
    expect(readiness.matrix).toHaveLength(49);
    expect(
      readiness.matrix.every(
        (x: any) =>
          x.currentRdmStatus === 'UNVERIFIED' && x.lifecycleStatus === 'ACTIVE',
      ),
    ).toBe(true);
    expect(readiness.tasks.map((x: any) => x.type)).toContain(
      'MISSING_COORDINATES',
    );
  });
  it('runs Lowful from external candidate through review, ACTIVE, safe change review, and region isolation without a static record', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    const canonical = 'urn:regional:hapcheon:lowful';
    const proposedFacts = {
      displayName: '로우풀',
      entityType: 'CAFE',
      category: 'CAFE',
      tags: ['CAFE', 'REST', 'HAPCHEON_LAKE'],
      areaLabel: '합천호 권역 · 대병면 · 회양관광단지권',
      address: '경상남도 합천군 대병면 회양관광단지길 28-10',
      latitude: 35.525488,
      longitude: 128.018877,
      phone: '0507-1333-2434',
      operatingHours: '10:30~19:00 (마지막 주문 18:30)',
      shortDescription: '합천호를 조망할 수 있고 전용 주차장이 확인된 카페',
    };
    const evidence = {
      sourceType: 'KTO',
      sourceName: '한국관광공사 관광정보',
      sourceUrl: 'https://www.ktriptips.com/kor/food/2901756',
      corroboratingSources: [
        {
          sourceType: 'OFFICIAL_LOCAL_GOV',
          sourceName: '합천군 문화관광',
          sourceUrl:
            'https://www.hc.go.kr/06574/06591/06610.web?amode=view&idx=33',
        },
        {
          sourceType: 'OFFICIAL_MAP_LISTING',
          sourceName: '지도/사업자 좌표 확인',
          sourceUrl: 'https://www.tabling.co.kr/place/677cd13566de5f0698877d84',
        },
      ],
    };
    const candidate: any = await service.create({
      regionId: 'hapcheon',
      canonicalEntityId: canonical,
      source: evidence,
      proposedFacts,
    });
    expect(candidate.lifecycleStatus).toBe('NEW_CANDIDATE');
    expect(
      (await service.effectiveDataset('hapcheon'))!.records.some(
        (x) => x.entityUri === canonical,
      ),
    ).toBe(false);
    await service.action(candidate.id, 'HOLD');
    expect(
      (await service.effectiveDataset('hapcheon'))!.records.some(
        (x) => x.entityUri === canonical,
      ),
    ).toBe(false);
    const active: any = await service.action(candidate.id, 'APPROVE');
    expect(active).toMatchObject({
      lifecycleStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    });
    const effective = (await service.effectiveDataset(
      'hapcheon',
    ))!.records.find((x) => x.entityUri === canonical)!;
    expect(effective).toMatchObject({
      canonicalLabelKo: '로우풀',
      tags: ['CAFE', 'REST', 'HAPCHEON_LAKE'],
      latitude: 35.525488,
      longitude: 128.018877,
    });
    expect(effective.actions).toHaveProperty('navigate');
    expect(effective.actions).not.toHaveProperty('reserve');
    expect(
      (await service.effectiveDataset('okcheon'))!.records.some(
        (x) => x.entityUri === canonical,
      ),
    ).toBe(false);
    const changed: any = await service.create({
      regionId: 'hapcheon',
      canonicalEntityId: canonical,
      source: evidence,
      proposedFacts: {
        ...proposedFacts,
        shortDescription: '검토 전 설명 변경',
      },
    });
    expect(changed.lifecycleStatus).toBe('CHANGE_DETECTED');
    expect(
      (await service.effectiveDataset('hapcheon'))!.records.find(
        (x) => x.entityUri === canonical,
      )?.description,
    ).toBe(proposedFacts.shortDescription);
    await service.action(candidate.id, 'IGNORE_CHANGE', undefined, undefined, await service.ignoreChangePreflight(candidate.id));
    expect(
      db.rows.filter(
        (x) => x.canonicalEntityId === canonical && x.regionId === 'hapcheon',
      ),
    ).toHaveLength(1);
    expect(db.rows[0].auditTrail.map((x: any) => x.action)).toEqual(
      expect.arrayContaining([
        'CANDIDATE_CREATED',
        'HOLD',
        'APPROVE',
        'CHANGE_DETECTED',
        'IGNORE_CHANGE',
      ]),
    );
    expect((await service.quality()).totalActive).toBe(1);
  });
  it('exports only ACTIVE VERIFIED operational facts in a versioned package without unrelated data', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    const active: any = await service.create({
      regionId: 'hapcheon',
      canonicalEntityId: 'urn:regional:hapcheon:lowful',
      source,
      proposedFacts: {
        displayName: '로우풀',
        entityType: 'CAFE',
        category: 'CAFE',
        tags: ['CAFE', 'REST'],
        latitude: 35.525488,
        longitude: 128.018877,
        phone: '0507-1333-2434',
        operatingHours: '10:30~19:00',
      },
    });
    await service.action(active.id, 'APPROVE');
    await service.create({
      regionId: 'hapcheon',
      source,
      proposedFacts: {
        displayName: '미검증 후보',
        entityType: 'CAFE',
        category: 'CAFE',
      },
    });
    const pkg: any = await service.exportPackage('hapcheon');
    expect(pkg).toMatchObject({
      packageType: 'REGIONAL_OPERATIONAL_DATA',
      schemaVersion: '1.0',
      regionId: 'hapcheon',
      mode: 'ACTIVE_VERIFIED',
    });
    expect(pkg.records).toHaveLength(1);
    expect(pkg.records[0]).toMatchObject({
      canonicalEntityId: 'urn:regional:hapcheon:lowful',
      latitude: 35.525488,
      longitude: 128.018877,
      phone: '0507-1333-2434',
      operatingHours: '10:30~19:00',
      verificationStatus: 'VERIFIED',
      lifecycleStatus: 'ACTIVE',
      source,
    });
    const serialized = JSON.stringify(pkg);
    for (const forbidden of [
      '_id',
      'admin-write-token',
      'TripSession',
      'visitorNo',
      'rawMessage',
      'analytics',
    ])
      expect(serialized).not.toContain(forbidden);
    expect(db.rows[0].auditTrail.at(-1).action).toBe('DATA_EXPORT_CREATED');
  });
  it('stages a Lowful package invisibly, imports idempotently, then approval enables effective actions', async () => {
    const sourceDb = model(),
      sourceService = new RegionalDataService(sourceDb as any),
      candidate: any = await sourceService.create({
        regionId: 'hapcheon',
        canonicalEntityId: 'urn:regional:hapcheon:lowful',
        source,
        proposedFacts: {
          displayName: '로우풀',
          entityType: 'CAFE',
          category: 'CAFE',
          tags: ['CAFE', 'REST', 'HAPCHEON_LAKE'],
          latitude: 35.525488,
          longitude: 128.018877,
          phone: '0507-1333-2434',
          operatingHours: '10:30~19:00',
        },
      });
    await sourceService.action(candidate.id, 'APPROVE');
    const pkg: any = await sourceService.exportPackage('hapcheon');
    const targetDb = model(),
      target = new RegionalDataService(targetDb as any);
    const preview = await target.previewImport(pkg);
    expect(preview).toMatchObject({
      newRecords: 1,
      stagedRecords: 1,
      dryRun: true,
    });
    expect(targetDb.rows).toHaveLength(0);
    const imported = await target.importPackage(pkg);
    expect(imported).toMatchObject({ stagedRecords: 1, activatedRecords: 0 });
    expect(targetDb.rows[0]).toMatchObject({
      lifecycleStatus: 'NEEDS_VERIFICATION',
      verificationStatus: 'REVERIFY_REQUIRED',
    });
    expect(
      (await target.effectiveDataset('hapcheon'))!.records.some(
        (x) => x.entityUri === 'urn:regional:hapcheon:lowful',
      ),
    ).toBe(false);
    const repeated = await target.importPackage(pkg);
    expect(repeated.unchangedRecords).toBe(1);
    expect(targetDb.rows).toHaveLength(1);
    await target.action(targetDb.rows[0].id, 'APPROVE');
    const effective = (await target.effectiveDataset('hapcheon'))!.records.find(
      (x) => x.entityUri === 'urn:regional:hapcheon:lowful',
    )!;
    expect(effective.actions).toMatchObject({
      call: { phone: '0507-1333-2434' },
      navigate: { latitude: 35.525488, longitude: 128.018877 },
    });
    expect(effective.source).toEqual(source);
  });
  it('allows explicit trusted activation but turns differences into review conflicts without overwrite', async () => {
    const db = model(),
      service = new RegionalDataService(db as any);
    const pkg: any = {
      packageType: 'REGIONAL_OPERATIONAL_DATA',
      schemaVersion: '1.0',
      exportId: 'trusted-1',
      exportedAt: new Date().toISOString(),
      sourceEnvironment: 'staging',
      regionId: 'hapcheon',
      records: [
        {
          canonicalEntityId: 'urn:regional:hapcheon:lowful',
          regionId: 'hapcheon',
          displayName: '로우풀',
          entityType: 'CAFE',
          category: 'CAFE',
          tags: ['CAFE'],
          phone: '0507-1333-2434',
          latitude: 35.525488,
          longitude: 128.018877,
          source,
          verifiedAt: '2026-08-19',
          verificationStatus: 'VERIFIED',
          lifecycleStatus: 'ACTIVE',
        },
      ],
    };
    const activated = await service.importPackage(pkg, {
      trustedVerified: true,
    });
    expect(activated.activatedRecords).toBe(1);
    expect(db.rows[0].auditTrail[0].action).toBe('DATA_IMPORT_ACTIVATED');
    const changed = structuredClone(pkg);
    changed.exportId = 'trusted-2';
    changed.records[0].phone = '0507-0000-0000';
    const conflict = await service.importPackage(changed, {
      trustedVerified: true,
    });
    expect(conflict.conflicts).toBe(1);
    expect(db.rows[0].lifecycleStatus).toBe('CHANGE_DETECTED');
    expect(db.rows[0].phone).toBe('0507-1333-2434');
    expect(db.rows[0].proposedFacts.phone).toBe('0507-0000-0000');
    expect(db.rows[0].auditTrail.at(-1).action).toBe('DATA_IMPORT_CONFLICT');
  });
  it('rejects bad versions, cross-region rows, duplicate ids, malformed coordinates, and executable content', async () => {
    const service = new RegionalDataService(model() as any);
    const base: any = {
      packageType: 'REGIONAL_OPERATIONAL_DATA',
      schemaVersion: '1.0',
      exportId: 'x',
      exportedAt: new Date().toISOString(),
      sourceEnvironment: 'development',
      regionId: 'hapcheon',
      records: [
        {
          canonicalEntityId: 'urn:regional:hapcheon:lowful',
          regionId: 'hapcheon',
          displayName: '로우풀',
          entityType: 'CAFE',
          category: 'CAFE',
          source,
          verificationStatus: 'VERIFIED',
          lifecycleStatus: 'ACTIVE',
        },
      ],
    };
    for (const mutate of [
      (x: any) => (x.schemaVersion = '2.0'),
      (x: any) => (x.records[0].regionId = 'okcheon'),
      (x: any) => x.records.push({ ...x.records[0] }),
      (x: any) => (x.records[0].latitude = 35.5),
      (x: any) => (x.records[0].shortDescription = '<script>alert(1)</script>'),
    ]) {
      const value = structuredClone(base);
      mutate(value);
      await expect(service.previewImport(value)).rejects.toBeDefined();
    }
  });
});
