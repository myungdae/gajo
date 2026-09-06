import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { createRequire, Module } from 'node:module';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  main,
  runCloseOps,
  privateFiles,
  parseMode,
} from './receipt32-close-ops.mjs';
import { TARGET, NEIGHBORS, documentHash } from './receipt32-restore-core.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
// Compile the current domain source in memory; never import stale dist or start Nest/Mongo.
function sourceModule(relative) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const result = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
    },
  });
  const module = new Module(filename);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(dirname(filename));
  module._compile(result.outputText, filename);
  return module.exports;
}
const { atomicIgnoreChange, prepareIgnoreChange } = sourceModule(
  '../src/regional-data/ignore-change.ts',
);
const {
  observationPreflight,
  OBSERVATION_INDEX_KEY,
  OBSERVATION_INDEX_OPTIONS,
} = sourceModule('../src/regional-data/candidate-observation.ts');
const { ObjectId, EJSON, Decimal128, serialize, deserialize } =
  mongoose.mongo.BSON;
const clone = (x) => deserialize(serialize({ x })).x;
const eq = (a, b) =>
  EJSON.stringify(a, { relaxed: false }) ===
  EJSON.stringify(b, { relaxed: false });
const secret = 'DO_NOT_PRINT_SECRET_32';
function collection(rows) {
  return {
    rows,
    writes: 0,
    casCalls: [],
    beforeCas: undefined,
    indexes: [{ key: OBSERVATION_INDEX_KEY, ...OBSERVATION_INDEX_OPTIONS }],
    listIndexes() {
      return { toArray: async () => this.indexes };
    },
    match(row, q) {
      return Object.entries(q).every(([k, v]) =>
        k === '$expr' ? eq(row, v.$eq[1].$literal) : eq(row[k], v),
      );
    },
    find(q = {}) {
      const matches = this.rows.filter((row) => this.match(row, q)).map(clone);
      let limit = Infinity;
      return {
        limit(n) {
          limit = n;
          return this;
        },
        toArray: async () => matches.slice(0, limit),
        async *[Symbol.asyncIterator]() {
          yield* matches.slice(0, limit);
        },
      };
    },
    async findOne(q) {
      return (await this.find(q).limit(1).toArray())[0] || null;
    },
    async countDocuments(q) {
      return this.rows.filter((row) => this.match(row, q)).length;
    },
    async findOneAndUpdate(q, update, options) {
      assert.equal(q.$expr.$eq[0], '$$ROOT');
      assert(q.$expr.$eq[1].$literal);
      assert.notEqual(options.upsert, true);
      assert.notEqual(options.multi, true);
      assert.equal(options.includeResultMetadata, false);
      this.casCalls.push({ q: clone(q), update: clone(update), options });
      this.beforeCas?.(this.rows);
      const hits = this.rows.filter((row) => this.match(row, q));
      if (hits.length !== 1) return null;
      const row = hits[0];
      Object.assign(row, clone(update.$set));
      for (const key of Object.keys(update.$unset || {})) delete row[key];
      for (const [key, value] of Object.entries(update.$inc || {}))
        row[key] += value;
      for (const [key, value] of Object.entries(update.$push || {}))
        (row[key] ||= []).push(clone(value));
      this.writes++;
      return clone(row);
    },
    insertOne() {
      throw Error('UNEXPECTED_INSERT');
    },
    deleteMany() {
      throw Error('UNEXPECTED_DELETE');
    },
    updateMany() {
      throw Error('UNEXPECTED_MULTI');
    },
  };
}
function fixture() {
  const garden = {
    ...TARGET,
    _id: new ObjectId(TARGET._id),
    displayName: '합천 정원테마파크',
    lifecycleStatus: 'CHANGE_DETECTED',
    verificationStatus: 'VERIFIED',
    proposedFacts: { displayName: secret },
    detectedChanges: [{ field: 'displayName', value: secret }],
    source: {
      sourceUrl: `https://example.invalid/${secret}`,
      sourceType: 'OTHER_VERIFIED_SOURCE',
    },
    phone: secret,
    precision: Decimal128.fromString('123.4500'),
    auditTrail: [{ action: 'CHANGE_DETECTED', privateNote: secret }],
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    __v: 4,
  };
  const neighbors = NEIGHBORS.map((n) => ({
    _id: new ObjectId(),
    id: n.key,
    regionId: 'hapcheon',
    canonicalEntityId: n.canonicalEntityId,
    displayName: n.key,
    __v: 1,
  }));
  const c = collection([garden, ...neighbors]);
  const other = collection([{ _id: new ObjectId(), privateData: secret }]);
  const db = {
    collection(name) {
      assert(['regionaldatarecords', 'unrelated'].includes(name));
      return name === 'regionaldatarecords' ? c : other;
    },
    listCollections() {
      return {
        toArray: async () => [
          { name: 'regionaldatarecords' },
          { name: 'unrelated' },
        ],
      };
    },
  };
  const artifacts = new Map();
  let created = false;
  const files = {
    async create() {
      assert(!created, 'OUTPUT_EXISTS');
      created = true;
    },
    async save(name, value) {
      assert(created && !artifacts.has(name), 'OUTPUT_EXISTS');
      artifacts.set(name, value);
    },
    async load(name) {
      assert(artifacts.has(name), 'INPUT_MISSING');
      return artifacts.get(name);
    },
  };
  const env = {
    R32_HEAD: 'a'.repeat(40),
    R32_EXPECTED_HEAD: 'a'.repeat(40),
    R32_IMAGE: `sha256:${'b'.repeat(64)}`,
    R32_EXPECTED_IMAGE: `sha256:${'b'.repeat(64)}`,
    ADMIN_WRITE_TOKEN: secret,
  };
  const actor = `ADMIN_TOKEN:${createHash('sha256').update(secret).digest('hex').slice(0, 16)}`;
  const requests = [],
    outputs = [];
  const f = {
    c,
    other,
    db,
    files,
    artifacts,
    env,
    requests,
    outputs,
    connectCount: 0,
  };
  f.fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === 'http://client/api/facilities?regionId=hapcheon') {
      assert.equal(options.method || 'GET', 'GET');
      return {
        ok: true,
        json: async () =>
          [
            ['hapcheonVideoThemePark', '합천 영상테마파크'],
            ['hapcheonGardenThemePark', '합천 정원테마파크'],
            ['cPark', '씨파크'],
          ].map(([id, label]) => ({
            uri: `https://hapcheon.example/ontology#${id}`,
            label,
            hidden: secret,
          })),
      };
    }
    assert.equal(options.headers['x-admin-token'], secret);
    if (url.endsWith('/ignore-change-preflight')) {
      assert.equal(options.method, 'GET');
      return { ok: true, json: async () => prepareIgnoreChange(c, TARGET.id) };
    }
    assert.equal(
      url,
      `http://api:3000/api/admin/regional-data/${TARGET.id}/actions/IGNORE_CHANGE`,
    );
    assert.equal(options.method, 'POST');
    try {
      const result = await atomicIgnoreChange(
        c,
        TARGET.id,
        actor,
        JSON.parse(options.body).precondition,
        () => {},
      );
      return { ok: true, json: async () => result };
    } catch {
      return {
        ok: false,
        status: 409,
        json: async () => {
          throw Error(`RESPONSE_BODY_${secret}`);
        },
      };
    }
  };
  f.run = (mode) =>
    runCloseOps({
      ...f,
      mode,
      observationPreflight,
      output: (value) => outputs.push(value),
    });
  f.cli = (args) =>
    main(args, {
      ...f,
      connect: async () => {
        f.connectCount++;
        return db;
      },
      disconnect: async () => {},
      indexLoader: () => observationPreflight,
      output: (value) => outputs.push(value),
    });
  f.before = async () => {
    await f.run('capture');
    await f.run('preflight');
  };
  f.applied = async () => {
    await f.before();
    env.R32_APPROVED = 'IGNORE_CHANGE_RECEIPT32';
    await f.run('apply');
  };
  f.snapshot = () => [c, other].flatMap((x) => x.rows.map(documentHash));
  return f;
}

test('every read mode leaves fixture DB untouched, public performs GET without connecting', async () => {
  const f = fixture();
  for (const mode of ['read', 'capture', 'check', 'preflight', 'public']) {
    const before = f.snapshot();
    await f.run(mode);
    assert.deepEqual(f.snapshot(), before);
    assert.equal(f.c.writes, 0);
  }
  f.env.R32_APPROVED = 'IGNORE_CHANGE_RECEIPT32';
  await f.run('apply');
  for (const mode of ['post', 'restore-dry']) {
    const before = f.snapshot();
    await f.run(mode);
    assert.deepEqual(f.snapshot(), before);
    assert.equal(f.c.writes, 1);
  }
  assert.equal(await f.cli(['--mode', 'public']), 0);
  assert.equal(f.connectCount, 0);
  assert.equal(f.other.writes, 0);
});

test('missing/wrong/cross-mode approvals stop before connection or HTTP', async () => {
  for (const mode of ['apply', 'restore-apply'])
    for (const approval of [
      undefined,
      '',
      'true',
      mode === 'apply' ? 'RESTORE_RECEIPT32' : 'IGNORE_CHANGE_RECEIPT32',
    ]) {
      const f = fixture();
      f.env.R32_APPROVED = approval;
      assert.equal(await f.cli(['--mode', mode]), 1);
      assert.equal(f.connectCount, 0);
      assert.equal(f.requests.length, 0);
      assert.equal(f.c.writes, 0);
      assert.equal(f.outputs.at(-1).action, 'STOP');
    }
});

test('bad modes/arguments and provenance mismatch stop before connection', async () => {
  for (const args of [
    [],
    ['--mode', 'delete'],
    ['--mode', secret],
    ['--mode', 'read', '--mode', 'apply'],
    ['--target', TARGET._id],
  ]) {
    const f = fixture();
    assert.equal(await f.cli(args), 1);
    assert.equal(f.connectCount, 0);
    assert(!JSON.stringify(f.outputs).includes(secret));
  }
  for (const key of [
    'R32_HEAD',
    'R32_EXPECTED_HEAD',
    'R32_IMAGE',
    'R32_EXPECTED_IMAGE',
  ]) {
    const f = fixture();
    f.env[key] = 'wrong';
    assert.equal(await f.cli(['--mode', 'read']), 1);
    assert.equal(f.connectCount, 0);
  }
  assert.equal(parseMode(['--mode', 'restore-dry']), 'restore-dry');
});

test('capture rejects zero/two targets, service/canonical duplicates and wrong identity before files', async () => {
  const mutations = [
    (f) => f.c.rows.shift(),
    (f) => f.c.rows.push(clone(f.c.rows[0])),
    (f) => f.c.rows.push({ ...clone(f.c.rows[0]), _id: new ObjectId() }),
    (f) => (f.c.rows[0].canonicalEntityId = NEIGHBORS[0].canonicalEntityId),
    (f) =>
      f.c.rows.push({
        ...clone(f.c.rows[0]),
        _id: new ObjectId(),
        id: 'duplicate-canonical',
      }),
  ];
  for (const mutate of mutations) {
    const f = fixture();
    mutate(f);
    await assert.rejects(f.run('capture'));
    assert.equal(f.artifacts.size, 0);
    assert.equal(f.c.writes, 0);
  }
});

test('capture validates state and unique index before files', async () => {
  for (const mutate of [
    (f) => (f.c.rows[0].lifecycleStatus = 'ACTIVE'),
    (f) => (f.c.rows[0].verificationStatus = 'UNVERIFIED'),
    (f) => (f.c.rows[0].registration = {}),
    (f) => (f.c.rows[0].detectedChanges = []),
    (f) => (f.c.indexes = []),
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(f.run('capture'));
    assert.equal(f.artifacts.size, 0);
    assert.equal(f.c.writes, 0);
  }
});

test('typed backup roundtrips and refuses overwrite or corrupted bytes', async () => {
  const f = fixture();
  await f.run('capture');
  const raw = f.artifacts.get('garden-pre-image.ejson');
  assert(
    raw.includes('$oid') &&
      raw.includes('$date') &&
      raw.includes('$numberDecimal'),
  );
  assert.equal(
    documentHash(EJSON.parse(raw, { relaxed: false })),
    documentHash(f.c.rows[0]),
  );
  const saved = new Map(f.artifacts);
  await assert.rejects(f.run('capture'));
  assert.deepEqual(f.artifacts, saved);
  f.artifacts.set('garden-pre-image.ejson', raw + ' ');
  await assert.rejects(f.run('check'));
  assert.equal(f.c.writes, 0);
});

test('real private writer refuses overwrite/traversal and uses POSIX permissions', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'receipt32-close-fixture-'));
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const parent = join(root, 'private');
  await mkdir(parent, { mode: 0o700 });
  const files = privateFiles(parent);
  await files.create();
  await files.save('sample.ejson', 'first');
  await assert.rejects(files.create());
  await assert.rejects(files.save('sample.ejson', 'second'));
  await assert.rejects(files.save('../escape', 'bad'));
  assert.equal(await files.load('sample.ejson'), 'first');
  assert.equal(
    await readFile(join(parent, 'close-c0bf34b', 'sample.ejson'), 'utf8'),
    'first',
  );
  if (process.platform !== 'win32')
    assert.equal(
      (await stat(join(parent, 'close-c0bf34b', 'sample.ejson'))).mode & 0o777,
      0o600,
    );
});

test('apply checks retained preflight against current document; never silently refreshes', async () => {
  const f = fixture();
  await f.before();
  const request = f.artifacts.get('request.json');
  f.c.rows[0].newFieldWithoutVersion = 'concurrent';
  f.env.R32_APPROVED = 'IGNORE_CHANGE_RECEIPT32';
  await assert.rejects(f.run('apply'));
  assert.equal(f.c.writes, 0);
  assert.equal(f.requests.filter((x) => x.options.method === 'POST').length, 0);
  assert.equal(f.artifacts.get('request.json'), request);
  const g = fixture();
  await g.before();
  const p = JSON.parse(g.artifacts.get('request.json'));
  p.precondition.expectedVersion++;
  g.artifacts.set('request.json', JSON.stringify(p));
  g.env.R32_APPROVED = 'IGNORE_CHANGE_RECEIPT32';
  await assert.rejects(g.run('apply'));
  assert.equal(g.c.writes, 0);
});

test('full BSON equality blocks no-version added-field races in apply and restore', async () => {
  const f = fixture();
  await f.before();
  f.env.R32_APPROVED = 'IGNORE_CHANGE_RECEIPT32';
  f.c.beforeCas = (rows) => {
    rows[0].unexpected = secret;
  };
  await assert.rejects(f.run('apply'));
  assert.equal(f.c.writes, 0);
  assert.equal(f.c.casCalls.length, 1);
  const g = fixture();
  await g.applied();
  await g.run('post');
  g.env.R32_APPROVED = 'RESTORE_RECEIPT32';
  g.c.beforeCas = (rows) => {
    rows[0].unexpected = secret;
  };
  await assert.rejects(g.run('restore-apply'));
  assert.equal(g.c.writes, 1);
  assert.equal(g.c.casCalls.length, 2);
  assert.equal(g.c.rows[0].lifecycleStatus, 'ACTIVE');
});

test('apply changes exactly one document and post verifies audit/protected facts/neighbors', async () => {
  const f = fixture(),
    before = f.snapshot();
  await f.applied();
  await f.run('post');
  const after = f.snapshot();
  assert.notEqual(after[0], before[0]);
  assert.deepEqual(after.slice(1), before.slice(1));
  assert.equal(f.c.writes, 1);
  assert.equal(f.other.writes, 0);
  assert.equal(
    f.c.rows[0].auditTrail.filter((x) => x.action === 'IGNORE_CHANGE').length,
    1,
  );
  assert.equal(f.c.rows[0].phone, secret);
  assert.equal(f.c.rows[0].__v, 5);
  const m = JSON.parse(f.artifacts.get('garden-restore-manifest.json'));
  assert.equal(m.expectedPostImageSha256, documentHash(f.c.rows[0]));
  assert.equal(m.expectedCurrentVersion, 5);
  await assert.rejects(f.run('apply'));
  assert.equal(f.c.writes, 1);
});

test('post rejects protected/neighbor/other DB mutations, duplicate audit and wrong version', async () => {
  for (const mutate of [
    (f) => (f.c.rows[0].phone = 'changed'),
    (f) => (f.c.rows[0].newProtected = true),
    (f) => (f.c.rows[1].displayName = 'changed'),
    (f) => (f.c.rows[2].displayName = 'changed'),
    (f) => f.other.rows.push({ _id: new ObjectId() }),
    (f) => f.c.rows[0].auditTrail.push(clone(f.c.rows[0].auditTrail.at(-1))),
    (f) => f.c.rows[0].__v++,
  ]) {
    const f = fixture();
    await f.applied();
    mutate(f);
    await assert.rejects(f.run('post'));
    assert(!f.artifacts.has('garden-restore-manifest.json'));
    assert.equal(f.c.writes, 1);
  }
});

test('unrelated normal writes STOP check/apply/restore without retry or automatic recovery', async () => {
  const f = fixture();
  await f.before();
  f.other.rows[0].normalWrite = true;
  f.env.R32_APPROVED = 'IGNORE_CHANGE_RECEIPT32';
  for (const mode of ['check', 'apply'])
    assert.equal(await f.cli(['--mode', mode]), 1);
  assert.equal(f.c.writes, 0);
  assert.equal(f.requests.filter((x) => x.options.method === 'POST').length, 0);
  const g = fixture();
  await g.applied();
  await g.run('post');
  g.other.rows[0].normalWrite = true;
  g.env.R32_APPROVED = 'RESTORE_RECEIPT32';
  assert.equal(await g.cli(['--mode', 'restore-apply']), 1);
  assert.equal(g.c.writes, 1);
});

test('restore is one-document CAS, retains audit and restores only review fields', async () => {
  const f = fixture();
  const pre = clone(f.c.rows[0]),
    neighbors = f.snapshot().slice(1);
  await f.applied();
  await f.run('post');
  f.env.R32_APPROVED = 'RESTORE_RECEIPT32';
  await f.run('restore-apply');
  const after = f.c.rows[0];
  for (const k of ['lifecycleStatus', 'proposedFacts', 'detectedChanges'])
    assert(eq(after[k], pre[k]));
  assert.equal(after.__v, 6);
  assert.equal(after.auditTrail.length, pre.auditTrail.length + 2);
  assert.equal(after.auditTrail.at(-1).action, 'RESTORE_IGNORE_CHANGE');
  assert.equal(after.phone, pre.phone);
  assert.deepEqual(f.snapshot().slice(1), neighbors);
  assert.equal(f.c.writes, 2);
  await assert.rejects(f.run('restore-apply'));
  assert.equal(f.c.writes, 2);
});

test('success and error output never includes secrets, proposed document or HTTP body', async () => {
  const f = fixture();
  await f.run('read');
  await f.applied();
  await f.run('post');
  await f.run('restore-dry');
  await f.run('public');
  assert(!JSON.stringify(f.outputs).includes(secret));
  f.fetchImpl = async () => {
    throw new Error(
      `mongodb://user:${secret}@invalid PRIVATE_DOCUMENT RESPONSE_BODY`,
    );
  };
  assert.equal(await f.cli(['--mode', 'public']), 1);
  assert(!JSON.stringify(f.outputs).includes(secret));
  assert.equal(f.outputs.at(-1).action, 'STOP');
});

test('HTTP conflict and uncertain timeout never retry, read error bodies or create new preflight', async () => {
  for (const failure of ['conflict', 'timeout']) {
    const f = fixture();
    await f.before();
    f.env.R32_APPROVED = 'IGNORE_CHANGE_RECEIPT32';
    const retained = f.artifacts.get('request.json');
    let calls = 0;
    f.fetchImpl = async () => {
      calls++;
      if (failure === 'timeout') throw Error(secret);
      return {
        ok: false,
        status: 409,
        json: () => {
          throw Error('MUST_NOT_READ');
        },
      };
    };
    assert.equal(await f.cli(['--mode', 'apply']), 1);
    assert.equal(calls, 1);
    assert.equal(f.artifacts.get('request.json'), retained);
    assert.equal(f.c.writes, 0);
    assert(!JSON.stringify(f.outputs).includes(secret));
  }
});

test('backup provenance cannot be silently changed for subsequent modes', async () => {
  for (const kind of ['HEAD', 'IMAGE']) {
    const f = fixture();
    await f.run('capture');
    f.env[`R32_${kind}`] =
      kind === 'HEAD' ? 'c'.repeat(40) : `sha256:${'c'.repeat(64)}`;
    f.env[`R32_EXPECTED_${kind}`] = f.env[`R32_${kind}`];
    await assert.rejects(f.run('check'));
    assert.equal(f.c.writes, 0);
  }
});

test('stored preflight and post manifests are never overwritten', async () => {
  const f = fixture();
  await f.before();
  const request = f.artifacts.get('request.json');
  await assert.rejects(f.run('preflight'));
  assert.equal(f.artifacts.get('request.json'), request);
  f.env.R32_APPROVED = 'IGNORE_CHANGE_RECEIPT32';
  await f.run('apply');
  await f.run('post');
  const manifest = f.artifacts.get('garden-restore-manifest.json');
  await assert.rejects(f.run('post'));
  assert.equal(f.artifacts.get('garden-restore-manifest.json'), manifest);
  assert.equal(f.c.writes, 1);
});

test('invalid observation values and capture-time unrelated writes stop before files', async () => {
  const invalid = fixture();
  invalid.c.rows[0].candidateObservationKey = 32;
  await assert.rejects(invalid.run('capture'));
  assert.equal(invalid.artifacts.size, 0);
  const race = fixture(),
    originalFind = race.other.find.bind(race.other);
  let scans = 0;
  race.other.find = (...args) => {
    if (++scans === 2) race.other.rows[0].concurrentWrite = true;
    return originalFind(...args);
  };
  await assert.rejects(race.run('capture'));
  assert.equal(race.artifacts.size, 0);
  assert.equal(race.c.writes, 0);
});

test('preflight whitelists response fields and restore requires original manifest lineage', async () => {
  const f = fixture();
  await f.run('capture');
  const originalFetch = f.fetchImpl;
  f.fetchImpl = async (...args) => {
    const response = await originalFetch(...args);
    return {
      ...response,
      json: async () => ({
        ...(await response.json()),
        unexpectedSecret: secret,
      }),
    };
  };
  await f.run('preflight');
  assert(!f.artifacts.get('request.json').includes(secret));
  assert(!JSON.stringify(f.outputs).includes(secret));
  f.env.R32_APPROVED = 'IGNORE_CHANGE_RECEIPT32';
  await f.run('apply');
  await f.run('post');
  const restore = JSON.parse(f.artifacts.get('garden-restore-manifest.json'));
  restore.head = 'f'.repeat(40);
  f.artifacts.set('garden-restore-manifest.json', JSON.stringify(restore));
  f.env.R32_APPROVED = 'RESTORE_RECEIPT32';
  await assert.rejects(f.run('restore-apply'));
  assert.equal(f.c.writes, 1);
});
