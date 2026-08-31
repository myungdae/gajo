import { RegionalDataService } from './regional-data.service';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlaceDiscoveryService } from '../concierge/place-discovery.service';
import { OKCHEON_MASTER_DATA } from '../regions/okcheon/master-data';
function model() {
  const rows: any[] = [];
  const document = (value: any) => ({
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
    const current=db.rows.find(row=>row.id===garden.id).toObject(),other=JSON.stringify(db.rows.find(row=>row.id===video.id).toObject());await service.action(garden.id,'IGNORE_CHANGE');const after=db.rows.find(row=>row.id===garden.id);
    expect(after).toMatchObject({displayName:current.displayName,aliases:current.aliases,address:current.address,lifecycleStatus:'ACTIVE',detectedChanges:[],proposedFacts:undefined});expect(after.auditTrail.at(-1).actorId).toBe('SYSTEM_INTERNAL');expect(JSON.stringify(db.rows.find(row=>row.id===video.id).toObject())).toBe(other);
    const resolver=new PlaceDiscoveryService(service as any);await expect(resolver.resolveExactPlaceIntent('hapcheon','정원공원 찾아줘')).resolves.toMatchObject({entityId:'urn:test:garden'});await expect(resolver.resolveExactPlaceIntent('hapcheon','영상공원 찾아줘')).resolves.toMatchObject({entityId:'urn:test:video'});
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
    await service.action(candidate.id, 'IGNORE_CHANGE');
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
