import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { mongo } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { LocationReviewService } from './location-review.service';
import {
  AdminLocationReviewController,
  CopilotLocationReviewController,
} from './location-review.controller';
import { CopilotAuthService } from '../copilot/copilot-auth';
import { RegionalDataService } from './regional-data.service';
import { RegionConfigService } from '../region/region-config.service';
import { FacilityService } from '../facility/facility.service';
import { FacilityController } from '../facility/facility.controller';
import { PlaceDiscoveryService } from '../concierge/place-discovery.service';
import { REGIONAL_CANDIDATE_DATASETS } from '../regions/regional-candidate.registry';
import { MasterDataService } from '../master-data/master-data.service';
import {
  currentLocation,
  locationHash,
  locationProposal,
  validLocation,
  approvedLocationUsable,
  locationWarnings,
} from './location-review.policy';

const { ObjectId, EJSON, serialize, deserialize } = mongo.BSON;
const clone = (v: any) => deserialize(serialize({ v })).v;
const same = (a: any, b: any) =>
  EJSON.stringify(a, { relaxed: false }) ===
  EJSON.stringify(b, { relaxed: false });
function fixture(regionId = 'hapcheon') {
  const regions = new RegionConfigService(),
    center = regions.get(regionId).center || { latitude: 35, longitude: 126 };
  const target: any = {
    _id: new ObjectId(),
    id: `fixture-receipt34-${regionId}`,
    regionId,
    canonicalEntityId:
      regionId === 'hapcheon'
        ? 'https://hapcheon.example/ontology#yuseongGardenRestaurant'
        : `urn:receipt34:${regionId}:restaurant`,
    displayName: '유성가든식당',
    aliases: [],
    address: '경남 합천군 대병면 서부로 2081',
    phone: '055-933-7055',
    category: 'FOOD',
    entityType: 'RESTAURANT',
    lifecycleStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    proposedFacts: { displayName: '유성가든' },
    source: {
      sourceType: 'OFFICIAL_BUSINESS',
      sourceUrl: 'https://example.invalid/fixture',
    },
    auditTrail: [],
    detectedChanges: [],
    __v: 0,
    updatedAt: new Date('2026-09-01'),
  };
  const rows = [
    target,
    {
      ...clone(target),
      _id: new ObjectId(),
      id: 'other-place',
      canonicalEntityId: 'urn:receipt34:other',
      displayName: '다른 장소',
      proposedFacts: undefined,
    },
    {
      ...clone(target),
      _id: new ObjectId(),
      id: 'other-region',
      regionId: 'outside',
      canonicalEntityId: 'urn:receipt34:outside',
    },
  ];
  const f: any = { rows, writes: 0, beforeCas: undefined, filters: [] };
  const matches = (row: any, query: any) =>
    Object.entries(query).every(([key, value]: any) =>
      key === '$expr'
        ? same(row, value.$eq[1].$literal)
        : same(row[key], value),
    );
  const collection: any = {
    find(query: any) {
      let limit = Infinity;
      return {
        limit(n: number) {
          limit = n;
          return this;
        },
        toArray: async () =>
          rows
            .filter((r) => matches(r, query))
            .slice(0, limit)
            .map(clone),
      };
    },
    async findOneAndUpdate(filter: any, update: any, options: any) {
      expect(options.upsert).toBe(false);
      expect(options.includeResultMetadata).toBe(false);
      expect(filter.$expr.$eq[0]).toBe('$$ROOT');
      f.filters.push(filter);
      f.beforeCas?.();
      const row = rows.find((r) => matches(r, filter));
      if (!row) return null;
      Object.assign(row, clone(update.$set));
      for (const k of Object.keys(update.$unset || {})) delete row[k];
      row.__v += update.$inc.__v;
      row.auditTrail.push(clone(update.$push.auditTrail));
      f.writes++;
      return clone(row);
    },
  };
  const model: any = {
    collection,
    find: (q: any = {}) => {
      const query = {
        lean: async () => rows.filter((r) => matches(r, q)).map(clone),
        sort: () => query,
      };
      return query;
    },
    create: () => {
      throw Error('NO_CREATE');
    },
    updateMany: () => {
      throw Error('NO_MULTI');
    },
  };
  const regional = new RegionalDataService(model),
    service = new LocationReviewService(model, regional, regions);
  const facility = new FacilityService(
    {
      find: () => ({ sort: () => ({ lean: async () => [] }) }),
      findOne: () => ({ lean: async () => null }),
    } as any,
    {} as any,
    { mapEligiblePlaces: () => [], place: () => undefined } as any,
    regional,
  );
  const actor = {
    actorId: 'MANAGER_34',
    allowedRegionIds: [regionId],
    canWrite: true,
  };
  const proposal = {
    ...center,
    normalizedAddress: target.address,
    sourceType: 'OFFICIAL_MAP_LISTING',
    sourceReference: 'https://example.invalid/fixture-map',
    reason: '테스트 fixture 위치 확인',
  };
  const detail = () => service.detail(actor, regionId, target.id);
  const body = async (values: any = {}) => ({
    ...values,
    precondition: { ...(await detail()).precondition, requestId: randomUUID() },
  });
  const act = async (action: string, values: any = {}) =>
    service.action(actor, regionId, target.id, action, await body(values));
  const propose = () => act('PROPOSE', { proposal });
  const approve = () =>
    act('APPROVE', {
      reason: '지도와 근거를 확인했습니다',
      reviewConfirmed: true,
    });
  return Object.assign(f, {
    target,
    regionId,
    model,
    regional,
    service,
    facility,
    actor,
    proposal,
    regions,
    detail,
    body,
    act,
    propose,
    approve,
  });
}

describe('receipt 34 location contracts', () => {
  it.each([undefined, null, '', ' ', NaN, Infinity, '35.5', 91, -91])(
    'rejects invalid latitude %p without coercion',
    (latitude) => {
      expect(validLocation({ latitude, longitude: 128 })).toBe(false);
    },
  );
  it.each([181, -181, NaN, '', null])(
    'rejects invalid longitude %p',
    (longitude) =>
      expect(validLocation({ latitude: 35, longitude })).toBe(false),
  );
  it('rejects zero-zero and requires source/reason, forbidding identity and actor injection', () => {
    expect(validLocation({ latitude: 0, longitude: 0 })).toBe(false);
    const f = fixture();
    for (const patch of [
      { sourceReference: '' },
      { reason: '' },
      { displayName: '유성가든' },
      { proposedBy: 'FORGED' },
      { verificationStatus: 'APPROVED' },
    ])
      expect(() =>
        locationProposal(
          { ...f.proposal, ...patch },
          f.actor.actorId,
          new Date().toISOString(),
        ),
      ).toThrow();
  });
  it.each(['gajo', 'hapcheon', 'okcheon'])(
    'keeps search/call and hides proposed map coordinates, then publishes same canonical in %s',
    async (regionId) => {
      const f = fixture(regionId),
        otherHashes = f.rows.slice(1).map(locationHash),
        id = f.target.canonicalEntityId;
      const search = new PlaceDiscoveryService(f.regional);
      expect(
        (await search.resolveExactPlaceIntent(regionId, '유성가든식당'))
          ?.entityId,
      ).toBe(id);
      let candidate = (
        await f.regional.effectiveDataset(regionId)
      ).records.find((p) => p.entityUri === id);
      expect(candidate.actions.call.phone).toBe('055-933-7055');
      expect(candidate.latitude).toBeUndefined();
      expect(candidate.actions.navigate).toBeUndefined();
      expect(
        (await f.facility.operationalPlaces(regionId)).some(
          (p) => p.uri === id,
        ),
      ).toBe(false);
      expect(
        (await f.service.list(f.actor, regionId, true)).records.map(
          (r) => r.id,
        ),
      ).toContain(f.target.id);
      await f.propose();
      expect((await f.detail()).proposal.verificationStatus).toBe('PROPOSED');
      const pendingDetail = await f.facility.getFacility(id);
      expect(pendingDetail.literalProps.telephone).toBe('055-933-7055');
      expect(pendingDetail.literalProps.latitude).toBeUndefined();
      expect(pendingDetail.literalProps.actions.navigate).toBeUndefined();
      candidate = (await f.regional.effectiveDataset(regionId)).records.find(
        (p) => p.entityUri === id,
      );
      expect(candidate.latitude).toBeUndefined();
      expect(JSON.stringify(candidate)).not.toContain('proposedBy');
      expect(
        (await f.facility.operationalPlaces(regionId)).some(
          (p) => p.uri === id,
        ),
      ).toBe(false);
      await f.approve();
      candidate = (await f.regional.effectiveDataset(regionId)).records.find(
        (p) => p.entityUri === id,
      );
      expect(candidate.actions.navigate).toEqual({
        latitude: f.proposal.latitude,
        longitude: f.proposal.longitude,
      });
      expect(
        (await f.facility.getFacility(id)).literalProps.actions.navigate,
      ).toEqual(candidate.actions.navigate);
      expect(candidate.canonicalLabelKo).toBe('유성가든식당');
      expect(f.target.proposedFacts.displayName).toBe('유성가든');
      expect(f.target.canonicalEntityId).toBe(id);
      expect(f.target.verificationStatus).toBe('VERIFIED');
      expect(
        (await f.facility.operationalPlaces(regionId)).some(
          (p) => p.uri === id,
        ),
      ).toBe(true);
      const facilities = await f.facility.listFacilities(regionId);
      expect(facilities.find((p) => p.uri === id).literalProps.latitude).toBe(
        f.proposal.latitude,
      );
      const discovery = await search.discover(
        regionId,
        'FOOD',
        '유성가든식당',
        {
          latitude: f.proposal.latitude + 0.001,
          longitude: f.proposal.longitude,
        },
      );
      expect(discovery.entities[0].entityId).toBe(id);
      expect(discovery.entities[0].actions.navigate).toBeDefined();
      expect(f.rows.slice(1).map(locationHash)).toEqual(otherHashes);
      expect(f.writes).toBe(2);
    },
  );
  it('blocks region-outside and unconfigured bounds without ordinary approval override', async () => {
    for (const region of ['hapcheon', 'muan']) {
      const f = fixture(region);
      f.proposal.latitude = 0.1;
      f.proposal.longitude = 0.1;
      await f.propose();
      expect((await f.detail()).warnings.approvalBlocked).toBe(true);
      await expect(f.approve()).rejects.toThrow();
      expect(f.writes).toBe(1);
      expect(f.target.latitude).toBeUndefined();
    }
  });
  it('warns on a large move and duplicate location; requires explicit review', async () => {
    const f = fixture();
    f.target.latitude = 35.65;
    f.target.longitude = 128.05;
    f.rows[1].latitude = f.proposal.latitude;
    f.rows[1].longitude = f.proposal.longitude;
    await f.propose();
    const warnings = (await f.detail()).warnings;
    expect(warnings.largeMove).toBe(true);
    expect(warnings.duplicates).toHaveLength(1);
    await expect(
      f.act('APPROVE', { reason: '확인 미완료 테스트' }),
    ).rejects.toThrow();
    await f.approve();
    expect(f.writes).toBe(2);
    expect(f.rows).toHaveLength(3);
  });
  it('rejects only the proposal and retains approved coordinates, name, facts and neighbors', async () => {
    const f = fixture();
    f.target.latitude = f.proposal.latitude;
    f.target.longitude = f.proposal.longitude;
    const before = currentLocation(f.target);
    await f.propose();
    await f.act('REJECT', { reason: '주소와 위치가 달라 반려' });
    expect(currentLocation(f.target)).toEqual(before);
    expect(f.target.locationReview.verificationStatus).toBe('REJECTED');
    await expect(f.approve()).rejects.toThrow();
    expect(f.target.displayName).toBe('유성가든식당');
  });
  it('binds idempotency to actor, payload and action for simultaneous and later retries', async () => {
    const f = fixture(),
      proposalBody = await f.body({ proposal: f.proposal });
    await Promise.all(
      [1, 2].map(() =>
        f.service.action(
          f.actor,
          f.regionId,
          f.target.id,
          'PROPOSE',
          proposalBody,
        ),
      ),
    );
    expect(f.writes).toBe(1);
    await f.service.action(
      f.actor,
      f.regionId,
      f.target.id,
      'PROPOSE',
      proposalBody,
    );
    expect(f.writes).toBe(1);
    await expect(
      f.service.action(
        { ...f.actor, actorId: 'OTHER' },
        f.regionId,
        f.target.id,
        'PROPOSE',
        proposalBody,
      ),
    ).rejects.toThrow();
    await expect(
      f.service.action(f.actor, f.regionId, f.target.id, 'PROPOSE', {
        ...proposalBody,
        proposal: { ...f.proposal, reason: '다른 요청 내용' },
      }),
    ).rejects.toThrow();
    const approveBody = await f.body({
      reason: '승인 근거와 지도 확인',
      reviewConfirmed: true,
    });
    await Promise.all(
      [1, 2].map(() =>
        f.service.action(
          f.actor,
          f.regionId,
          f.target.id,
          'APPROVE',
          approveBody,
        ),
      ),
    );
    expect(f.writes).toBe(2);
    expect(
      f.target.auditTrail.filter((e) => e.action === 'LOCATION_APPROVE'),
    ).toHaveLength(1);
  });
  it('rejects stale preconditions and full BSON races including fields added without version bump', async () => {
    const f = fixture();
    await f.propose();
    const stale = await f.body({
      reason: '조건부 승인 테스트',
      reviewConfirmed: true,
    });
    f.target.extraField = 'concurrent';
    await expect(
      f.service.action(f.actor, f.regionId, f.target.id, 'APPROVE', stale),
    ).rejects.toThrow();
    f.beforeCas = () => {
      f.target.otherField = 'raced';
    };
    await expect(f.approve()).rejects.toThrow();
    expect(f.writes).toBe(1);
    expect(f.target.latitude).toBeUndefined();
  });
  it('restores a mistaken approval atomically without rewinding audit, canonical or version', async () => {
    const f = fixture(),
      others = f.rows.slice(1).map(locationHash);
    await f.propose();
    await f.approve();
    const restoreBody = await f.body({ reason: '위치 오승인 확인 후 복원' });
    await f.service.action(
      f.actor,
      f.regionId,
      f.target.id,
      'RESTORE',
      restoreBody,
    );
    expect(f.target.latitude).toBeUndefined();
    expect(f.target.longitude).toBeUndefined();
    expect(f.target.approvedLocation.verificationStatus).toBe('UNVERIFIED');
    expect(f.target.locationReview.verificationStatus).toBe('RESTORED');
    expect(f.target.__v).toBe(3);
    expect(f.target.auditTrail.map((e) => e.action)).toEqual([
      'LOCATION_PROPOSE',
      'LOCATION_APPROVE',
      'LOCATION_RESTORE',
    ]);
    expect(f.rows.slice(1).map(locationHash)).toEqual(others);
    await f.service.action(
      f.actor,
      f.regionId,
      f.target.id,
      'RESTORE',
      restoreBody,
    );
    expect(f.writes).toBe(3);
    expect(
      (await f.facility.operationalPlaces(f.regionId)).some(
        (p) => p.uri === f.target.canonicalEntityId,
      ),
    ).toBe(false);
  });
  it('restore refuses later modifications even with refreshed preflight, and CAS races', async () => {
    const f = fixture();
    await f.propose();
    await f.approve();
    f.target.phone = 'changed';
    await expect(
      f.act('RESTORE', { reason: '이후 변경이 있는 복원' }),
    ).rejects.toThrow();
    expect(f.writes).toBe(2);
    const g = fixture();
    await g.propose();
    await g.approve();
    g.beforeCas = () => {
      g.target.extra = 'concurrent';
    };
    await expect(
      g.act('RESTORE', { reason: '동시 변경이 있는 복원' }),
    ).rejects.toThrow();
    expect(g.writes).toBe(2);
  });
  it('approved snapshot is not overwritten by later unapproved flat coordinate or name proposals', async () => {
    const f = fixture();
    await f.propose();
    await f.approve();
    f.target.latitude = 1;
    f.target.longitude = 2;
    const record = (await f.regional.effectiveDataset(f.regionId)).records.find(
      (p) => p.entityUri === f.target.canonicalEntityId,
    );
    expect(record.latitude).toBe(f.proposal.latitude);
    expect(record.canonicalLabelKo).toBe('유성가든식당');
  });
  it('first proposal freezes absent/current public location against legacy flat-field edits', async () => {
    const f = fixture();
    await f.propose();
    f.target.latitude = 35.6;
    f.target.longitude = 128.1;
    const record = (await f.regional.effectiveDataset(f.regionId)).records.find(
      (p) => p.entityUri === f.target.canonicalEntityId,
    );
    expect(record.latitude).toBeUndefined();
    expect(record.actions.navigate).toBeUndefined();
    expect(record.canonicalLabelKo).toBe('유성가든식당');
    const g = fixture();
    g.target.latitude = 35.6;
    g.target.longitude = 128.1;
    await g.propose();
    g.target.latitude = 35.7;
    expect(currentLocation(g.target)).toEqual({
      latitude: 35.6,
      longitude: 128.1,
    });
  });
  it('legacy unscoped review responses do not expose scoped location proposal or audit payload', async () => {
    const f = fixture();
    await f.propose();
    const legacy = (await f.regional.list({ regionId: f.regionId })).find(
      (r) => r.id === f.target.id,
    );
    expect(legacy).not.toHaveProperty('locationReview');
    expect(legacy).not.toHaveProperty('locationRollback');
    expect(JSON.stringify(legacy)).not.toContain('fixture-map');
    expect(legacy.auditTrail).toEqual([]);
    expect((await f.detail()).proposal.sourceReference).toBe(
      f.proposal.sourceReference,
    );
  });
  it('returns safe geocoding failure, empty, multiple and low-confidence candidates without writes', async () => {
    const key = process.env.KAKAO_REST_API_KEY,
      original = global.fetch;
    process.env.KAKAO_REST_API_KEY = 'fixture-secret';
    const f = fixture();
    try {
      global.fetch = jest
        .fn()
        .mockRejectedValue(Error('secret-provider-error'));
      expect(
        await f.service.candidates(
          f.actor,
          f.regionId,
          f.target.id,
          f.target.address,
        ),
      ).toEqual({ status: 'UNAVAILABLE', candidates: [] });
      for (const [documents, status] of [
        [[], 'EMPTY'],
        [
          [
            {
              y: '35.55',
              x: '128.05',
              address_name: '광역 주소',
              address_type: 'REGION',
            },
          ],
          'LOW_CONFIDENCE',
        ],
        [
          [1, 2].map(() => ({
            y: '35.55',
            x: '128.05',
            address_name: '상세 주소',
            address_type: 'ROAD_ADDR',
          })),
          'MULTIPLE',
        ],
      ] as any) {
        global.fetch = jest
          .fn()
          .mockResolvedValue({ ok: true, json: async () => ({ documents }) });
        const result = await f.service.candidates(
          f.actor,
          f.regionId,
          f.target.id,
          f.target.address,
        );
        expect(result.status).toBe(status);
        expect(
          result.candidates.every((c) => c.verificationStatus === 'UNVERIFIED'),
        ).toBe(true);
      }
      expect(f.writes).toBe(0);
      expect(f.target.locationReview).toBeUndefined();
    } finally {
      global.fetch = original;
      if (key === undefined) delete process.env.KAKAO_REST_API_KEY;
      else process.env.KAKAO_REST_API_KEY = key;
    }
  });
});

describe('receipt 34 strict compatibility review', () => {
  it('deduplicates the same proposal request, blocks a new request while pending, and allows a new reviewed cycle', async () => {
    const f = fixture(),
      body = await f.body({ proposal: f.proposal });
    await f.service.action(f.actor, f.regionId, f.target.id, 'PROPOSE', body);
    const at = f.target.locationReview.proposedAt;
    await f.service.action(f.actor, f.regionId, f.target.id, 'PROPOSE', body);
    expect(f.writes).toBe(1);
    expect(f.target.locationReview.proposedAt).toBe(at);
    await expect(f.propose()).rejects.toThrow();
    expect(f.writes).toBe(1);
    await f.act('REJECT', { reason: '추가 확인이 필요한 위치' });
    await f.propose();
    expect(f.writes).toBe(3);
    expect(f.target.locationReview.verificationStatus).toBe('PROPOSED');
    expect(
      f.rows.filter((r) => r.canonicalEntityId === f.target.canonicalEntityId),
    ).toHaveLength(1);
  });
  it.each(['gajo', 'hapcheon', 'okcheon'])(
    'first review keeps curated public coordinates separate from unverified stored facts in %s',
    async (regionId) => {
      const f = fixture(regionId),
        baseline = REGIONAL_CANDIDATE_DATASETS[regionId].records.find((p) =>
          validLocation(p.actions?.navigate),
        )!;
      Object.assign(f.target, {
        canonicalEntityId: baseline.entityUri,
        verificationStatus: 'PARTIAL',
        aliases: ['미승인 별칭'],
        displayName: '미승인 대표명',
      });
      const read = async () =>
        (await f.regional.effectiveDataset(regionId)).records.find(
          (p) => p.entityUri === baseline.entityUri,
        );
      const before = await read();
      expect(before.actions.navigate).toEqual(baseline.actions.navigate);
      await f.propose();
      expect(f.target.approvedLocation.compatibilityRule).toBe(
        'CURATED_PUBLIC_LOCATION',
      );
      expect((await read()).actions.navigate).toEqual(before.actions.navigate);
      await f.act('REJECT', { reason: '기존 공인 위치 유지' });
      expect((await read()).actions.navigate).toEqual(before.actions.navigate);
      expect((await read()).canonicalLabelKo).toBe(baseline.canonicalLabelKo);
      expect((await read()).alternateLabels).not.toContain('미승인 별칭');
      await f.propose();
      await f.approve();
      expect((await read()).canonicalLabelKo).toBe(baseline.canonicalLabelKo);
      expect((await read()).alternateLabels).not.toContain('미승인 별칭');
      expect(f.target.canonicalEntityId).toBe(baseline.entityUri);
      await f.act('RESTORE', { reason: '이전 공인 위치 복원' });
      expect((await read()).actions.navigate).toEqual(before.actions.navigate);
    },
  );
  it('warns about a curated neighbor even when it has no mutable review document', async () => {
    const f = fixture(),
      baseline = REGIONAL_CANDIDATE_DATASETS.hapcheon.records.find((p) =>
        validLocation(p.actions?.navigate),
      )!;
    const result = await f.service.preview(f.actor, f.regionId, f.target.id, {
      ...f.proposal,
      ...(baseline.actions.navigate as any),
    });
    expect(
      result.warnings.duplicates.some(
        (p) => p.canonicalEntityId === baseline.entityUri,
      ),
    ).toBe(true);
    expect(f.writes).toBe(0);
  });
  it('uses explicit historical approval, never bare coordinates or pending evidence', () => {
    const pair = { latitude: 35.5, longitude: 128 };
    for (const verificationStatus of ['UNVERIFIED', 'PARTIAL', undefined]) {
      expect(approvedLocationUsable({ ...pair, verificationStatus })).toBe(
        false,
      );
      expect(
        approvedLocationUsable({
          ...pair,
          verificationStatus,
          fieldEvidence: {
            coordinates: { status: 'PROPOSED', proposed: pair },
          },
        }),
      ).toBe(false);
    }
    expect(
      approvedLocationUsable({ ...pair, verificationStatus: 'VERIFIED' }),
    ).toBe(true);
    expect(
      approvedLocationUsable({
        ...pair,
        verificationStatus: 'PARTIAL',
        fieldEvidence: { coordinates: { status: 'APPROVED' } },
      }),
    ).toBe(true);
    expect(
      approvedLocationUsable({
        ...pair,
        verificationStatus: 'VERIFIED',
        approvedLocation: { verificationStatus: 'UNVERIFIED' },
      }),
    ).toBe(false);
  });
  it('preserves coordinate-specific provenance and does not replace it with general place provenance', async () => {
    const f = fixture();
    Object.assign(f.target, f.proposal, { verificationStatus: 'PARTIAL' });
    f.target.fieldEvidence = {
      coordinates: {
        status: 'APPROVED',
        proposed: {
          latitude: f.proposal.latitude,
          longitude: f.proposal.longitude,
        },
        source: {
          sourceType: 'FIELD_SURVEY',
          sourceUrl: 'https://example.invalid/coordinate-evidence',
        },
        observedAt: '2026-09-01',
      },
    };
    const evidence = clone(f.target.fieldEvidence.coordinates);
    await f.propose();
    expect(f.target.approvedLocation.sourceReference).toBe(
      evidence.source.sourceUrl,
    );
    expect(f.target.approvedLocation.legacyEvidence).toEqual(evidence);
    expect(f.target.approvedLocation.compatibilityRule).toBe(
      'APPROVED_COORDINATE_FIELD',
    );
  });
  it.each(['gajo', 'hapcheon', 'okcheon'])(
    'retains every curated map identity before adoption, during proposals and after rejection in %s',
    async (regionId) => {
      const f = fixture(regionId),
        base = REGIONAL_CANDIDATE_DATASETS[regionId];
      f.rows.splice(0);
      const master = new MasterDataService({} as any);
      const facility = new FacilityService(
        {
          find: () => ({ sort: () => ({ lean: async () => [] }) }),
          findOne: () => ({ lean: async () => null }),
        } as any,
        {} as any,
        master,
        f.regional,
      );
      const map = async () =>
        (await facility.operationalPlaces(regionId))
          .map((p) => ({
            uri: p.uri,
            latitude: p.latitude,
            longitude: p.longitude,
          }))
          .sort((a, b) => a.uri.localeCompare(b.uri));
      const baseline = await map();
      expect(baseline.length).toBeGreaterThan(0);
      // In-memory representation of the existing bootstrap contract, no reseed/DB writes.
      for (const [index, p] of base.records.entries())
        f.rows.push(
          clone({
            _id: new ObjectId(),
            id: `compat-${index}`,
            regionId,
            canonicalEntityId: p.entityUri,
            displayName: p.canonicalLabelKo,
            aliases: [...p.alternateLabels],
            latitude: p.latitude,
            longitude: p.longitude,
            address: p.address,
            phone: p.telephone,
            category: p.category,
            source: p.source,
            verificationStatus:
              p.runtimeDataStatus === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
            lifecycleStatus: 'ACTIVE',
            __v: 0,
            updatedAt: new Date('2026-09-01'),
            auditTrail: [],
          }),
        );
      const rowsBefore = f.rows.map(locationHash);
      expect(await map()).toEqual(baseline);
      await f.service.list(f.actor, regionId);
      expect(f.rows.map(locationHash)).toEqual(rowsBefore);
      for (const existing of baseline) {
        const row = f.rows.find((r) => r.canonicalEntityId === existing.uri);
        const detail = await f.service.detail(f.actor, regionId, row.id);
        expect(detail.needsLocationReview).toBe(false);
        const proposal = {
          ...f.proposal,
          latitude: existing.latitude + 0.001,
          longitude: existing.longitude,
          normalizedAddress: row.address || 'fixture 주소 확인',
        };
        await f.service.action(f.actor, regionId, row.id, 'PROPOSE', {
          proposal,
          precondition: { ...detail.precondition, requestId: randomUUID() },
        });
        expect(await map()).toEqual(baseline);
        expect(
          (await facility.getFacility(existing.uri)).literalProps.actions
            .navigate,
        ).toEqual({
          latitude: existing.latitude,
          longitude: existing.longitude,
        });
        const pending = await f.service.detail(f.actor, regionId, row.id);
        await f.service.action(f.actor, regionId, row.id, 'REJECT', {
          reason: '기존 위치 유지 검토',
          precondition: { ...pending.precondition, requestId: randomUUID() },
        });
        expect(await map()).toEqual(baseline);
      }
      expect(f.rows).toHaveLength(base.records.length);
      console.log(
        `R34 compatibility ${regionId}: ${baseline.length} -> ${(await map()).length}`,
      );
    },
  );
  it.each([
    {},
    { north: 36 },
    { north: 35, south: 36, east: 129, west: 127 },
    { north: 91, south: 33, east: 129, west: 127 },
  ])('blocks malformed regional bounds %j', (bounds) => {
    expect(
      locationWarnings(
        {},
        { latitude: 35.5, longitude: 128 },
        { bounds } as any,
        [],
      ).approvalBlocked,
    ).toBe(true);
  });
  it('reports stale restoration as unavailable and retains complete decision audit', async () => {
    const f = fixture();
    await f.propose();
    const proposed = clone(f.target.locationReview);
    await f.approve();
    expect((await f.detail()).canRestore).toBe(true);
    await f.act('RESTORE', { reason: '오승인 확인 후 원복' });
    await f.propose();
    await f.act('REJECT', { reason: '근거 부족으로 반려' });
    for (const action of ['APPROVE', 'RESTORE', 'REJECT']) {
      const event = f.target.auditTrail.find(
        (e) => e.action === `LOCATION_${action}`,
      );
      expect(event.actorId).toBe(f.actor.actorId);
      expect(event.reason.length).toBeGreaterThanOrEqual(5);
      expect(event.locationRequestId).toMatch(/^[\da-f-]{36}$/);
      expect(Number.isFinite(Date.parse(event.at))).toBe(true);
      expect(event).toHaveProperty('before');
      expect(event).toHaveProperty('after');
      expect(event.reviewedLocation).toMatchObject({
        latitude: proposed.latitude,
        longitude: proposed.longitude,
        sourceReference: proposed.sourceReference,
        proposedBy: proposed.proposedBy,
        reason: proposed.reason,
      });
    }
    const g = fixture();
    await g.propose();
    await g.approve();
    g.target.phone = 'other change';
    expect((await g.detail()).canRestore).toBe(false);
    expect((await g.detail()).restoreBlocked).toBe(true);
  });
});

describe('location HTTP authentication and region scope', () => {
  let app: any, f: any;
  const saved = {
    token: process.env.ADMIN_WRITE_TOKEN,
    regions: process.env.ADMIN_REGION_IDS,
    jwt: process.env.COPILOT_JWT_SECRET,
  };
  const bearer = (role: string, regions: string[]) =>
    jwt.sign(
      { sub: 'fixture-manager', username: 'fixture', role, regions },
      'fixture-jwt-secret',
    );
  beforeAll(async () => {
    process.env.ADMIN_WRITE_TOKEN = 'fixture-admin';
    process.env.ADMIN_REGION_IDS = 'hapcheon';
    process.env.COPILOT_JWT_SECRET = 'fixture-jwt-secret';
    f = fixture();
    const module = await Test.createTestingModule({
      controllers: [
        AdminLocationReviewController,
        CopilotLocationReviewController,
        FacilityController,
      ],
      providers: [
        { provide: LocationReviewService, useValue: f.service },
        { provide: FacilityService, useValue: f.facility },
        { provide: CopilotAuthService, useValue: new CopilotAuthService() },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    for (const [key, value] of [
      ['ADMIN_WRITE_TOKEN', saved.token],
      ['ADMIN_REGION_IDS', saved.regions],
      ['COPILOT_JWT_SECRET', saved.jwt],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  });
  it('blocks anonymous and invalid credentials on reads and writes', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/locations?regionId=hapcheon')
      .expect(403);
    for (const mode of ['APPROVE', 'REJECT', 'RESTORE']) {
      await request(app.getHttpServer())
        .post(
          `/api/admin/locations/${f.target.id}/actions/${mode}?regionId=hapcheon`,
        )
        .set('x-admin-token', 'wrong')
        .send({})
        .expect(403);
      await request(app.getHttpServer())
        .post(
          `/api/copilot/locations/${f.target.id}/actions/${mode}?regionId=hapcheon`,
        )
        .set('Authorization', 'Bearer invalid')
        .send({})
        .expect(401);
      await request(app.getHttpServer())
        .post(
          `/api/copilot/locations/${f.target.id}/actions/${mode}?regionId=hapcheon`,
        )
        .set(
          'Authorization',
          `Bearer ${bearer('REGIONAL_MANAGER', ['okcheon'])}`,
        )
        .send({})
        .expect(403);
      await request(app.getHttpServer())
        .post(
          `/api/copilot/locations/${f.target.id}/actions/${mode}?regionId=hapcheon`,
        )
        .set('Authorization', `Bearer ${bearer('VIEWER', ['hapcheon'])}`)
        .send({})
        .expect(403);
    }
    await request(app.getHttpServer())
      .get('/api/copilot/locations?regionId=hapcheon')
      .expect(401);
    await request(app.getHttpServer())
      .post(
        `/api/admin/locations/${f.target.id}/actions/APPROVE?regionId=hapcheon`,
      )
      .send({})
      .expect(403);
  });
  it('admin scope cannot read or change another region even by guessing an ID', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/locations?regionId=okcheon')
      .set('x-admin-token', 'fixture-admin')
      .expect(403);
    await request(app.getHttpServer())
      .post(
        `/api/admin/locations/${f.target.id}/actions/PROPOSE?regionId=okcheon`,
      )
      .set('x-admin-token', 'fixture-admin')
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/admin/locations/other-region?regionId=hapcheon`)
      .set('x-admin-token', 'fixture-admin')
      .expect(404);
  });
  it('JWT region assignment and write roles remain enforced', async () => {
    await request(app.getHttpServer())
      .get('/api/copilot/locations?regionId=hapcheon')
      .set('Authorization', `Bearer ${bearer('REGIONAL_MANAGER', ['okcheon'])}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/copilot/locations/${f.target.id}/preview?regionId=hapcheon`)
      .set('Authorization', `Bearer ${bearer('VIEWER', ['hapcheon'])}`)
      .send(f.proposal)
      .expect(403);
    const response = await request(app.getHttpServer())
      .get('/api/copilot/locations?regionId=hapcheon')
      .set(
        'Authorization',
        `Bearer ${bearer('REGIONAL_MANAGER', ['hapcheon'])}`,
      )
      .expect(200);
    expect(response.body.records[0].canWrite).toBe(true);
    await request(app.getHttpServer())
      .get('/api/admin/locations?regionId=hapcheon')
      .set('x-admin-token', 'fixture-admin')
      .expect(200);
    expect(f.writes).toBe(0);
  });
  it('public HTTP detail/call survive all states and scoped manager approval alone changes map inclusion', async () => {
    const server = app.getHttpServer(),
      canonical = f.target.canonicalEntityId;
    const read = async (mapped: boolean) => {
      const detail = await request(server)
        .get(`/api/facilities/${encodeURIComponent(canonical)}`)
        .expect(200);
      expect(detail.body.uri).toBe(canonical);
      expect(detail.body.label).toBe('유성가든식당');
      expect(detail.body.literalProps.telephone).toBe('055-933-7055');
      expect(Boolean(detail.body.literalProps.actions.navigate)).toBe(mapped);
      const list = await request(server)
        .get('/api/facilities?regionId=hapcheon')
        .expect(200);
      expect(list.body.filter((p) => p.uri === canonical)).toHaveLength(1);
      const map = await request(server)
        .get('/api/operational-places?regionId=hapcheon')
        .expect(200);
      expect(map.body.filter((p) => p.uri === canonical)).toHaveLength(
        mapped ? 1 : 0,
      );
      for (const response of [detail, list, map]) {
        expect(JSON.stringify(response.body)).not.toMatch(
          /locationReview|proposedBy|locationRollback|locationRequestId/,
        );
      }
      const search = new PlaceDiscoveryService(f.regional);
      const result = await search.discover('hapcheon', 'FOOD', '유성가든식당', {
        latitude: f.proposal.latitude + 0.001,
        longitude: f.proposal.longitude,
      });
      const found = result.entities.find((e) => e.entityId === canonical);
      expect(found).toBeDefined();
      expect(found.distanceMeters !== undefined).toBe(mapped);
      return map.body.length;
    };
    const before = await read(false);
    await f.propose();
    expect(await read(false)).toBe(before);
    const approval = await f.body({
      reason: '담당 지역 위치 최종 검토',
      reviewConfirmed: true,
    });
    await request(server)
      .post(
        `/api/copilot/locations/${f.target.id}/actions/APPROVE?regionId=hapcheon`,
      )
      .set(
        'Authorization',
        `Bearer ${bearer('REGIONAL_MANAGER', ['hapcheon'])}`,
      )
      .send(approval)
      .expect(201);
    expect(await read(true)).toBe(before + 1);
    await f.act('RESTORE', { reason: '위치 오승인 확인 후 복원' });
    expect(await read(false)).toBe(before);
    await f.propose();
    await f.act('REJECT', { reason: '근거 부족으로 위치 반려' });
    expect(await read(false)).toBe(before);
    expect(
      f.rows.filter((r) => r.canonicalEntityId === canonical),
    ).toHaveLength(1);
  });
});
