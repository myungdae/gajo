import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { Mongoose } from 'mongoose';
import { RegionalDataRecordSchema } from './regional-data.schema';
import { RegionalDataService } from './regional-data.service';
import { candidateObservation, observationPreflight, OBSERVATION_INDEX } from './candidate-observation';
import { PlaceDiscoveryService } from '../concierge/place-discovery.service';

describe('atomic review observation reuse', () => {
  let memory: MongoMemoryServer, mongoose: Mongoose, model: any, service: RegionalDataService;
  const input = (external = false): any => ({ regionId: 'hapcheon',
    source: { sourceType: 'OFFICIAL_BUSINESS', sourceSystem: 'test-business-registry', sourceUrl: 'https://example.test/places',
      ...(external ? { sourceRecordId: 'record-42' } : {}) },
    proposedFacts: { displayName: '검토 전용 테스트 시설', address: '테스트로 100', phone: '010-1234-5678',
      latitude: 36, longitude: 128, entityType: 'ATTRACTION', category: 'TOURISM_NATURE' } });
  beforeAll(async () => {
    memory = await MongoMemoryServer.create();
    mongoose = new Mongoose();
    await mongoose.connect(memory.getUri(), { autoIndex: false, autoCreate: false });
    model = mongoose.model('ObservationFixture', RegionalDataRecordSchema);
    await model.createCollection();
    await model.createIndexes(); // Isolated fixture only; never an application startup operation.
    service = new RegionalDataService(model);
  }, 30000);
  afterAll(async () => { await mongoose?.disconnect(); await memory?.stop(); });
  beforeEach(async () => { await model.deleteMany({}); });
  it.each([false, true])('reuses three identical observations with external ID=%s', async external => {
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await service.create(input(external)));
    expect(new Set(results.map(row => row.id)).size).toBe(1);
    expect(await model.countDocuments()).toBe(1);
    expect(results[2]).toMatchObject({ seenCount: 3, lifecycleStatus: 'NEW_CANDIDATE', verificationStatus: 'UNVERIFIED' });
    expect(results[2].lastSeenAt.getTime()).toBeGreaterThanOrEqual(results[0].lastSeenAt.getTime());
    expect(results[2].auditTrail).toHaveLength(1);
  });
  it('concurrent identical requests create one candidate and count every observation', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => service.create(input(true))));
    expect(new Set(results.map(row => row.id)).size).toBe(1);
    expect(await model.countDocuments()).toBe(1);
    expect((await model.findOne()).seenCount).toBe(12);
  });
  it('keeps same-name places with different addresses and phones separate', async () => {
    const first = input(), second = input();
    second.proposedFacts.address = '다른로 200'; second.proposedFacts.phone = '01099999999';
    expect((await service.create(first)).id).not.toBe((await service.create(second)).id);
  });
  it.each([false, true])('versions material facts including hours with external ID=%s', async external => {
    const first = input(external), second = input(external);
    second.proposedFacts.operatingHours = '10:00-17:00';
    const a = await service.create(first), b = await service.create(second);
    expect(a.id).not.toBe(b.id);
    expect(a.candidateFingerprint).not.toBe(b.candidateFingerprint);
    if (external) expect(a.candidateSourceKey).toBe(b.candidateSourceKey);
    expect((await service.create(second)).id).toBe(b.id);
    expect(await model.countDocuments()).toBe(2);
  });
  it('isolates regions and source systems', async () => {
    const a = input(true), b = input(true), c = input(true);
    b.regionId = 'okcheon'; c.source.sourceSystem = 'another-registry';
    const rows = await Promise.all([a, b, c].map(value => service.create(value)));
    expect(new Set(rows.map(row => row.id)).size).toBe(3);
  });
  it('preserves an existing canonical and keeps all proposed identities out of exact/public data', async () => {
    const canonical: any = await service.create({ ...input(), canonicalEntityId: 'urn:test:existing-approved' });
    await service.action(canonical.id, 'APPROVE');
    const before = await model.findOne({ id: canonical.id }).lean();
    const observation = input(); observation.proposedFacts.displayName = '미승인 관측명';
    for (let i = 0; i < 3; i++) await service.create(observation);
    expect(await model.findOne({ id: canonical.id }).lean()).toEqual(before);
    expect(JSON.stringify(await service.effectiveDataset('hapcheon'))).not.toContain('미승인 관측명');
    await expect(new PlaceDiscoveryService(service).resolveExactPlaceIntent('hapcheon', '미승인 관측명')).resolves.toBeUndefined();
  });
  it.each(['APPROVE', 'REJECT'])('reuses a %s-reviewed candidate without changing its facts, state or audit', async action => {
    const candidate: any = await service.create(input());
    await service.action(candidate.id, action);
    const before = await model.findOne({ id: candidate.id }).lean();
    for (let i = 0; i < 3; i++) expect((await service.create(input())).id).toBe(candidate.id);
    const after = await model.findOne({ id: candidate.id }).lean();
    const protectedFields = (row: any) => Object.fromEntries(Object.entries(row).filter(([key]) => !['seenCount', 'lastSeenAt', '__v'].includes(key)));
    expect(protectedFields(after)).toEqual(protectedFields(before));
    expect(after.seenCount).toBe(4);
    expect(await model.countDocuments()).toBe(1);
  });
  it('loads multiple legacy documents without a fingerprint under the partial unique index', async () => {
    for (const id of ['legacy-a', 'legacy-b']) await model.collection.insertOne({ id, canonicalEntityId: id, regionId: 'hapcheon', displayName: id });
    expect(await service.list({ regionId: 'hapcheon' })).toHaveLength(2);
    expect((await model.findOne({ id: 'legacy-a' })).candidateObservationKey).toBeUndefined();
    await service.create(input());
    expect(await model.countDocuments()).toBe(3);
  });
  it('normalizes object order/format and excludes collection times, but keeps material URL query identity', () => {
    const a = input(), b = input();
    b.proposedFacts.phone = '01012345678'; b.proposedFacts.latitude = '36.0';
    b.proposedFacts.displayName = '  검토 전용 테스트 시설  ';
    b.proposedFacts.collectedAt = 'tomorrow'; b.requestId = 'random';
    b.proposedFacts._id = 'temporary-document'; b.proposedFacts.updatedAt = 'tomorrow';
    expect(candidateObservation(a)).toEqual(candidateObservation(b));
    delete a.source.sourceSystem; delete b.source.sourceSystem;
    a.source.sourceUrl = 'https://example.test/place?id=1&utm_source=a';
    b.source.sourceUrl = 'https://example.test/place?utm_source=b&id=1#section';
    expect(candidateObservation(a)).toEqual(candidateObservation(b));
    b.source.sourceUrl = 'https://example.test/place?id=2';
    expect(candidateObservation(a)).not.toEqual(candidateObservation(b));
  });
  it('fails closed without the unique index, with zero candidate writes', async () => {
    await model.collection.dropIndex(OBSERVATION_INDEX);
    try {
      await expect(service.create(input())).rejects.toThrow('CANDIDATE_OBSERVATION_INDEX_REQUIRED');
      expect(await model.countDocuments()).toBe(0);
    } finally { await model.createIndexes(); }
  });
  it('preflight reports existing duplicate keys and legacy observations without any mutation', async () => {
    await model.collection.dropIndex(OBSERVATION_INDEX);
    try {
      const observation = input(), keys = candidateObservation(observation);
      for (const id of ['duplicate-a', 'duplicate-b', 'legacy']) await model.collection.insertOne({
        ...observation, id, canonicalEntityId: id, ...(id === 'legacy' ? {} : keys),
      });
      const before = await model.collection.find({}).toArray();
      const report = await observationPreflight(model.collection);
      expect(report.indexReady).toBe(false);
      expect(report.indexConflicts).toHaveLength(1);
      expect(report.repeatedObservationGroups[0].documentIds).toHaveLength(3);
      expect(report.legacyCount).toBe(1);
      expect(await model.collection.find({}).toArray()).toEqual(before);
    } finally { await model.deleteMany({}); await model.createIndexes(); }
  });
});
