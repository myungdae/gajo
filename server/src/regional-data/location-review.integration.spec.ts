import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { mongo } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { LocationReviewService } from './location-review.service';
import { RegionalDataService } from './regional-data.service';
import { RegionConfigService } from '../region/region-config.service';
import { locationHash } from './location-review.policy';

describe('receipt 34 isolated MongoDB atomic location contract', () => {
  let memory: MongoMemoryServer,
    client: mongo.MongoClient,
    collection: any,
    service: LocationReviewService;
  const actor = {
    actorId: 'FIXTURE_MANAGER',
    allowedRegionIds: ['hapcheon'],
    canWrite: true,
  };
  const proposal = {
    latitude: 35.55,
    longitude: 128.05,
    normalizedAddress: '격리 fixture 주소',
    sourceType: 'FIELD_SURVEY',
    sourceReference: 'fixture evidence 34',
    reason: '격리 fixture 위치 검토',
  };
  const makeService = (store = collection) => {
    const model: any = {
      collection: store,
      find: (q: any) => ({ lean: () => collection.find(q).toArray() }),
    };
    return new LocationReviewService(
      model,
      new RegionalDataService(model),
      new RegionConfigService(),
    );
  };
  beforeAll(async () => {
    memory = await MongoMemoryServer.create();
    client = await new mongo.MongoClient(memory.getUri()).connect();
    collection = client.db('receipt34-isolated-fixture').collection('records');
    await collection.createIndex({ id: 1 }, { unique: true });
    service = makeService();
  }, 30000);
  afterAll(async () => {
    await client?.close();
    await memory?.stop();
  });
  beforeEach(async () => {
    // Temporary fixture database only; never accepts an environment URI.
    await collection.deleteMany({});
    await collection.insertMany(
      ['target', 'neighbor'].map((id) => ({
        id,
        canonicalEntityId: `urn:receipt34:${id}`,
        regionId: 'hapcheon',
        displayName: id,
        category: 'FOOD',
        verificationStatus: 'VERIFIED',
        lifecycleStatus: 'ACTIVE',
        __v: 0,
        updatedAt: new Date('2026-09-01'),
        auditTrail: [],
        source: { sourceUrl: 'https://example.invalid/fixture' },
      })),
    );
  });
  const body = async (extra: any) => ({
    ...extra,
    precondition: {
      ...(await service.detail(actor, 'hapcheon', 'target')).precondition,
      requestId: randomUUID(),
    },
  });
  const act = async (action: string, extra: any) =>
    service.action(actor, 'hapcheon', 'target', action, await body(extra));
  const propose = () => act('PROPOSE', { proposal });
  const approve = () =>
    act('APPROVE', { reason: '위치와 근거 확인 완료', reviewConfirmed: true });
  it('roundtrips approval/restore in real BSON with one audit each and unchanged neighbor', async () => {
    const neighbor = locationHash(await collection.findOne({ id: 'neighbor' }));
    await propose();
    await approve();
    const approved = await collection.findOne({ id: 'target' });
    expect(approved.__v).toBe(2);
    expect(approved.latitude).toBe(proposal.latitude);
    await act('RESTORE', { reason: '오승인 확인 후 복원' });
    const restored = await collection.findOne({ id: 'target' });
    expect(restored.__v).toBe(3);
    expect(restored).not.toHaveProperty('latitude');
    expect(restored.approvedLocation.verificationStatus).toBe('UNVERIFIED');
    expect(restored.auditTrail.map((e) => e.action)).toEqual([
      'LOCATION_PROPOSE',
      'LOCATION_APPROVE',
      'LOCATION_RESTORE',
    ]);
    expect(locationHash(await collection.findOne({ id: 'neighbor' }))).toBe(
      neighbor,
    );
  });
  it('concurrent identical approvals apply exactly once', async () => {
    await propose();
    const request = await body({
      reason: '동일 승인 요청 테스트',
      reviewConfirmed: true,
    });
    await Promise.all(
      [1, 2, 3].map(() =>
        service.action(actor, 'hapcheon', 'target', 'APPROVE', request),
      ),
    );
    const after = await collection.findOne({ id: 'target' });
    expect(after.__v).toBe(2);
    expect(
      after.auditTrail.filter((e) => e.action === 'LOCATION_APPROVE'),
    ).toHaveLength(1);
  });
  it.each(['APPROVE', 'RESTORE'])(
    'whole-document equality prevents a no-version race in %s',
    async (action) => {
      await propose();
      if (action === 'RESTORE') await approve();
      const request = await body({
        reason: '동시 변경 차단 테스트',
        reviewConfirmed: true,
      });
      const before = await collection.findOne({ id: 'target' });
      const racing = makeService({
        find: (q: any) => collection.find(q),
        findOneAndUpdate: async (q: any, update: any, options: any) => {
          await collection.updateOne(
            { id: 'target' },
            { $set: { addedConcurrently: true } },
          );
          return collection.findOneAndUpdate(q, update, options);
        },
      });
      await expect(
        racing.action(actor, 'hapcheon', 'target', action, request),
      ).rejects.toThrow();
      const after = await collection.findOne({ id: 'target' });
      expect(after.__v).toBe(before.__v);
      expect(after.auditTrail).toEqual(before.auditTrail);
      expect(after.addedConcurrently).toBe(true);
    },
  );
});
