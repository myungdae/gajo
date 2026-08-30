import { createHash } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { MongoClient } from 'mongodb';

describe('application production bootstrap with isolated MongoDB', () => {
  const original = {
    nodeEnv: process.env.NODE_ENV,
    mongo: process.env.MONGODB_URI,
    entry: process.env.BOOTSTRAP_SEED_ENTRYPOINT,
    approval: process.env.BOOTSTRAP_SEED_APPROVED,
    rateLimitSecret: process.env.RATE_LIMIT_HASH_SECRET,
  };
  let mongo: MongoMemoryServer,
    client: MongoClient,
    AppModule: typeof import('../app.module').AppModule;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri('application-bootstrap-fixture');
    process.env.NODE_ENV = 'test';
    delete process.env.BOOTSTRAP_SEED_ENTRYPOINT;
    delete process.env.BOOTSTRAP_SEED_APPROVED;
    process.env.RATE_LIMIT_HASH_SECRET = 'synthetic-bootstrap-fixture-secret';
    AppModule =
      jest.requireActual<typeof import('../app.module')>(
        '../app.module',
      ).AppModule;
    const seedApp = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
    await seedApp.close();
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
  });
  afterAll(async () => {
    if (client) await client.close();
    if (mongo) await mongo.stop();
    restore('NODE_ENV', original.nodeEnv);
    restore('MONGODB_URI', original.mongo);
    restore('BOOTSTRAP_SEED_ENTRYPOINT', original.entry);
    restore('BOOTSTRAP_SEED_APPROVED', original.approval);
    restore('RATE_LIMIT_HASH_SECRET', original.rateLimitSecret);
  });

  it('starts twice with zero writes and no collection, content or index change', async () => {
    process.env.NODE_ENV = 'production';
    const before = await snapshot(client);
    const firstApp = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
    await firstApp.close();
    const first = await snapshot(client);
    const secondApp = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
    await secondApp.close();
    const second = await snapshot(client);
    expect(first).toEqual(before);
    expect(second).toEqual(first);
  });
});

function restore(key: string, value?: string) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function snapshot(client: MongoClient) {
  const database = client.db('application-bootstrap-fixture'),
    collections = (await database.listCollections().toArray())
      .map((item) => item.name)
      .sort(),
    structure = [] as unknown[],
    content = [] as unknown[];
  for (const name of collections) {
    const collection = database.collection(name),
      documents = await collection.find({}).sort({ _id: 1 }).toArray(),
      indexes = await collection.listIndexes().toArray();
    structure.push({ name, count: documents.length, indexes });
    content.push(documents);
  }
  const status = (await database.admin().command({ serverStatus: 1 })) as {
    opcounters: { insert: number; update: number; delete: number };
  };
  return {
    structureFingerprint: hash(structure),
    contentFingerprint: hash(content),
    writeOps: {
      insert: status.opcounters.insert,
      update: status.opcounters.update,
      delete: status.opcounters.delete,
    },
  };
}

const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
