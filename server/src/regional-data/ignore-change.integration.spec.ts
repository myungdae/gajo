import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { mongo } from 'mongoose';
import { atomicIgnoreChange, prepareIgnoreChange } from './ignore-change';

describe('IGNORE_CHANGE atomic BSON contract', () => {
  let memory: MongoMemoryServer, client: mongo.MongoClient, collection: any;
  const audit = jest.fn();
  const fixture = () => ({ _id: new mongo.ObjectId(), id: 'garden', __v: 4,
    canonicalEntityId: 'urn:test:garden', regionId: 'any-region', displayName: '정원',
    aliases: ['승인 별칭'], verificationStatus: 'VERIFIED', lifecycleStatus: 'CHANGE_DETECTED',
    source: { sourceType: 'OFFICIAL_LOCAL_GOV', sourceUrl: 'https://example.test' },
    proposedFacts: { displayName: '잘못된 이름' }, detectedChanges: [{ field: 'displayName' }],
    auditTrail: [], updatedAt: new Date('2026-01-01') });
  beforeAll(async () => {
    memory = await MongoMemoryServer.create();
    client = await new mongo.MongoClient(memory.getUri()).connect();
    collection = client.db('ignore-change-fixture').collection('records');
    await collection.createIndex({ id: 1 }, { unique: true });
  }, 30000);
  afterAll(async () => { await client?.close(); await memory?.stop(); });
  beforeEach(async () => {
    await collection.deleteMany({}); // Isolated temporary fixture database only.
    await collection.insertMany([fixture(), { ...fixture(), _id: new mongo.ObjectId(), id: 'neighbor' }]);
    audit.mockClear();
  });
  const run = (pre: any, store = collection, actor = 'OPS_TEST') =>
    atomicIgnoreChange(store, 'garden', actor, pre, audit);
  it('updates exactly one document, preserves protected fields, increments version and replays without writes or duplicate audit', async () => {
    const before = await collection.findOne({ id: 'garden' }), neighbor = await collection.findOne({ id: 'neighbor' });
    const pre = await prepareIgnoreChange(collection, 'garden');
    const after = await run(pre);
    expect(after).toMatchObject({ __v: 5, lifecycleStatus: 'ACTIVE', verificationStatus: 'VERIFIED', detectedChanges: [] });
    expect(after).not.toHaveProperty('proposedFacts');
    const allowed = ['__v', 'lifecycleStatus', 'detectedChanges', 'proposedFacts', 'auditTrail', 'updatedAt'];
    const protect = (row: any) => Object.fromEntries(Object.entries(row).filter(([key]) => !allowed.includes(key)));
    expect(protect(after)).toEqual(protect(before));
    expect(after.auditTrail).toEqual([expect.objectContaining({ action: 'IGNORE_CHANGE', result: 'APPLIED', conflict: false, requestId: pre.requestId })]);
    expect(await run(pre)).toEqual(after);
    expect(await collection.findOne({ id: 'neighbor' })).toEqual(neighbor);
    expect(audit).toHaveBeenCalledTimes(1);
  });
  it.each(['version', 'new-field', 'proposed', 'lifecycle'])('refuses a %s change after preflight with zero action writes', async (kind) => {
    const pre = await prepareIgnoreChange(collection, 'garden');
    const change = kind === 'version' ? { $inc: { __v: 1 } } : { $set: kind === 'new-field' ? { added: true } : kind === 'proposed' ? { proposedFacts: { changed: true } } : { lifecycleStatus: 'ARCHIVED' } };
    await collection.updateOne({ id: 'garden' }, change);
    const before = await collection.findOne({ id: 'garden' });
    await expect(run(pre)).rejects.toThrow('IGNORE_CHANGE_CONFLICT');
    expect(await collection.findOne({ id: 'garden' })).toEqual(before);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ result: 'CONFLICT', conflict: true }));
  });
  it('refuses a change between read and CAS even when __v does not change', async () => {
    const pre = await prepareIgnoreChange(collection, 'garden');
    const racing = { findOne: (q: any) => collection.findOne(q),
      findOneAndUpdate: async (q: any, update: any, options: any) => {
        await collection.updateOne({ id: 'garden' }, { $set: { concurrentNewField: true } });
        return collection.findOneAndUpdate(q, update, options);
      } };
    await expect(run(pre, racing)).rejects.toThrow('IGNORE_CHANGE_CONFLICT');
    const after = await collection.findOne({ id: 'garden' });
    expect(after).toMatchObject({ __v: 4, lifecycleStatus: 'CHANGE_DETECTED', concurrentNewField: true, auditTrail: [] });
    expect(after.proposedFacts).toBeDefined();
  });
  it('concurrent copies of one request produce one update and one audit event', async () => {
    const pre = await prepareIgnoreChange(collection, 'garden');
    const results = await Promise.all([run(pre), run(pre)]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].auditTrail).toHaveLength(1);
    expect(results[0].__v).toBe(5);
    expect(audit).toHaveBeenCalledTimes(1);
  });
  it('zero matches and replay with another actor are conflicts; missing precondition fails closed', async () => {
    await expect(run(undefined)).rejects.toThrow('REQUIRES_PREFLIGHT');
    const pre = await prepareIgnoreChange(collection, 'garden');
    await run(pre);
    await expect(run(pre, collection, 'OTHER_ACTOR')).rejects.toThrow('CONFLICT');
    await collection.deleteOne({ id: 'garden' });
    await expect(run(pre)).rejects.toThrow('CONFLICT');
  });
});
