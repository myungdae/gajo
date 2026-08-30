/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { createHash } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import mongoose, { Connection, Schema } from 'mongoose';
import { CopilotService } from '../copilot/copilot.service';
import { INITIAL_CORE_DESTINATIONS } from '../copilot/core-destination.config';
import candidates from '../operations/okcheon-essential-shopping.search-candidates.json';

describe('Copilot bootstrap with isolated synthetic MongoDB', () => {
  let mongo: MongoMemoryServer,
    connection: Connection,
    candidateModel: any,
    coreModel: any;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.BOOTSTRAP_SEED_ENTRYPOINT;
    delete process.env.BOOTSTRAP_SEED_APPROVED;
    mongo = await MongoMemoryServer.create();
    connection = await mongoose
      .createConnection(mongo.getUri('bootstrap-fixture'), {
        autoCreate: false,
        autoIndex: false,
      })
      .asPromise();
    const schema = new Schema({}, { strict: false, autoIndex: false });
    candidateModel = connection.model(
      'SyntheticCandidate',
      schema,
      'synthetic_candidates',
    );
    coreModel = connection.model('SyntheticCore', schema, 'synthetic_cores');
    await connection.createCollection('synthetic_candidates');
    await connection.createCollection('synthetic_cores');
    await candidateModel.collection.insertMany(
      candidates.map((item: any, index: number) => ({
        syntheticKey: index,
        regionId: item.regionId,
        fingerprint: normalize(
          `${item.displayName}:${item.address || ''}:${item.phone || ''}`,
        ),
      })),
    );
    await coreModel.collection.insertMany(
      Object.entries(INITIAL_CORE_DESTINATIONS).flatMap(([regionId, items]) =>
        items.map((item, index) => ({
          syntheticKey: `${regionId}-${index}`,
          regionId,
          displayName: item.displayName,
        })),
      ),
    );
  });
  afterAll(async () => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    await connection.close();
    await mongo.stop();
  });

  it('preserves content, indexes, collections and write counters across two starts', async () => {
    const service = new CopilotService(candidateModel, {} as any, coreModel),
      before = await snapshot(connection);
    await service.onModuleInit();
    const first = await snapshot(connection);
    await service.onModuleInit();
    const second = await snapshot(connection);
    expect(first.structure).toEqual(before.structure);
    expect(first.contentFingerprint).toBe(before.contentFingerprint);
    expect(first.writeOps).toEqual(before.writeOps);
    expect(second).toEqual(first);
  });

  it('fails closed on missing production state without repairing it', async () => {
    await candidateModel.deleteOne({ syntheticKey: 0 });
    const before = await snapshot(connection),
      service = new CopilotService(candidateModel, {} as any, coreModel);
    await expect(service.onModuleInit()).rejects.toThrow(
      'Copilot bootstrap validation failed',
    );
    const after = await snapshot(connection);
    expect(after.structure).toEqual(before.structure);
    expect(after.contentFingerprint).toBe(before.contentFingerprint);
    expect(after.writeOps).toEqual(before.writeOps);
  });
});

const normalize = (value = '') =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[^0-9a-z가-힣]/g, '');

async function snapshot(connection: Connection) {
  const database = connection.db!,
    collections = (await database.listCollections().toArray())
      .map((item) => item.name)
      .sort(),
    structure = [] as unknown[],
    content = [] as unknown[];
  for (const name of collections) {
    const collection = database.collection(name),
      documents = await collection.find({}).sort({ syntheticKey: 1 }).toArray(),
      indexes = await collection.listIndexes().toArray();
    structure.push({ name, count: documents.length, indexes });
    content.push(
      documents.map((document) => {
        const normalized = { ...document };
        delete normalized._id;
        return normalized;
      }),
    );
  }
  const status: any = await database.admin().command({ serverStatus: 1 });
  return {
    structure,
    contentFingerprint: createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex'),
    writeOps: {
      insert: status.opcounters.insert,
      update: status.opcounters.update,
      delete: status.opcounters.delete,
    },
  };
}
