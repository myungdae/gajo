import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  TARGET,
  NEIGHBORS,
  documentHash,
  runIgnoreChangeDryRun,
  planReceipt32Restore,
} from './receipt32-restore-core.mjs';
const { EJSON, ObjectId } = mongoose.mongo.BSON;
export const MODES = Object.freeze([
  'read',
  'capture',
  'check',
  'preflight',
  'apply',
  'post',
  'restore-dry',
  'restore-apply',
  'public',
]);
export function validateOptions(mode, env) {
  assert(MODES.includes(mode), 'MODE');
  if (mode === 'apply')
    assert.equal(
      env.R32_APPROVED,
      'IGNORE_CHANGE_RECEIPT32',
      'WRITE_NOT_AUTHORIZED',
    );
  if (mode === 'restore-apply')
    assert.equal(
      env.R32_APPROVED,
      'RESTORE_RECEIPT32',
      'RESTORE_NOT_AUTHORIZED',
    );
  assert(/^[a-f0-9]{40}$/.test(env.R32_HEAD || ''), 'HEAD_REQUIRED');
  assert.equal(env.R32_HEAD, env.R32_EXPECTED_HEAD, 'HEAD_MISMATCH');
  assert(/^sha256:[a-f0-9]{64}$/.test(env.R32_IMAGE || ''), 'IMAGE_REQUIRED');
  assert.equal(env.R32_IMAGE, env.R32_EXPECTED_IMAGE, 'IMAGE_MISMATCH');
}
export function parseMode(args) {
  assert(
    args.length === 2 && args[0] === '--mode' && MODES.includes(args[1]),
    'MODE_ARGUMENTS',
  );
  return args[1];
}
// CLI only accepts a mode: no arbitrary DB, target, collection or backup path.
export function privateFiles(
  parent = resolve('.maintenance-private', 'receipt32'),
) {
  const root = join(parent, 'close-c0bf34b');
  async function directory(path) {
    const st = await lstat(path);
    assert(st.isDirectory() && !st.isSymbolicLink(), 'PRIVATE_DIRECTORY');
    if (process.platform !== 'win32')
      assert.equal(st.mode & 0o777, 0o700, 'DIRECTORY_MODE');
  }
  async function checkRoot() {
    await directory(parent);
    await directory(root);
  }
  const pathFor = (name) => {
    assert(
      /^[a-zA-Z0-9.-]+$/.test(name) && name !== '.' && name !== '..',
      'PRIVATE_FILENAME',
    );
    return join(root, name);
  };
  return {
    async create() {
      await directory(parent);
      await mkdir(root, { mode: 0o700 });
    },
    async save(name, value) {
      await checkRoot();
      await writeFile(pathFor(name), value, { flag: 'wx', mode: 0o600 });
    },
    async load(name) {
      await checkRoot();
      const path = pathFor(name),
        st = await lstat(path);
      assert(st.isFile() && !st.isSymbolicLink(), 'PRIVATE_FILE');
      if (process.platform !== 'win32')
        assert.equal(st.mode & 0o777, 0o600, 'FILE_MODE');
      return readFile(path, 'utf8');
    },
  };
}
export async function runCloseOps({
  mode,
  env,
  db,
  files,
  observationPreflight,
  fetchImpl = fetch,
  output = () => {},
}) {
  validateOptions(mode, env);
  const save = (name, value) => files.save(name, value);
  const load = (name) => files.load(name);
  const c =
    mode === 'public' ? undefined : db.collection('regionaldatarecords');
  const encode = (x) => EJSON.stringify(x, { relaxed: false });
  const eq = (a, b) => encode(a) === encode(b);
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const allow = new Set([
    'lifecycleStatus',
    'proposedFacts',
    'detectedChanges',
    'auditTrail',
    'updatedAt',
    '__v',
  ]);
  const protectedHash = (d) =>
    documentHash(
      Object.fromEntries(
        Object.keys(d)
          .sort()
          .filter((k) => !allow.has(k))
          .map((k) => [k, d[k]]),
      ),
    );
  async function one(filter) {
    const rows = await c.find(filter).limit(2).toArray();
    assert.equal(rows.length, 1, 'TARGET_COUNT');
    return rows[0];
  }
  async function documents() {
    const garden = await one({ ...TARGET, _id: new ObjectId(TARGET._id) });
    assert.equal(
      await c.countDocuments({ id: TARGET.id }),
      1,
      'SERVICE_ID_COUNT',
    );
    assert.equal(
      await c.countDocuments({
        regionId: TARGET.regionId,
        canonicalEntityId: TARGET.canonicalEntityId,
      }),
      1,
      'CANONICAL_COUNT',
    );
    const docs = { garden };
    for (const n of NEIGHBORS)
      docs[n.key] = await one({
        regionId: TARGET.regionId,
        canonicalEntityId: n.canonicalEntityId,
      });
    return docs;
  }
  function summary(d) {
    return {
      _id: String(d._id),
      id: d.id,
      canonicalEntityId: d.canonicalEntityId,
      displayName: d.displayName,
      lifecycle: d.lifecycleStatus,
      verification: d.verificationStatus,
      proposedFactsExists: Object.hasOwn(d, 'proposedFacts'),
      detectedChangesExists: Object.hasOwn(d, 'detectedChanges'),
      detectedChangesCount: Array.isArray(d.detectedChanges)
        ? d.detectedChanges.length
        : null,
      __v: Number(d.__v),
      updatedAt: d.updatedAt,
      documentSha256: documentHash(d),
      protectedFactsSha256: protectedHash(d),
    };
  }
  async function invariants() {
    const result = {};
    const names = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((x) => x.name)
      .filter((x) => !x.startsWith('system.'))
      .sort();
    for (const name of names) {
      const entries = [];
      for await (const d of db.collection(name).find({})) {
        if (name === 'regionaldatarecords' && String(d._id) === TARGET._id)
          continue;
        entries.push([sha(encode(d._id)), documentHash(d)]);
      }
      entries.sort(([a], [b]) => a.localeCompare(b));
      result[name] = entries;
    }
    return result;
  }
  async function indexCheck() {
    const p = await observationPreflight(c);
    assert(
      p.indexReady &&
        p.invalidCount === 0 &&
        p.indexConflicts.length === 0 &&
        p.repeatedObservationGroups.length === 0,
      'INDEX_PREFLIGHT',
    );
    output({
      indexReady: p.indexReady,
      invalidCount: p.invalidCount,
      indexConflicts: p.indexConflicts.length,
      repeatedObservationGroups: p.repeatedObservationGroups.length,
    });
  }
  async function backup() {
    const raw = await load('garden-pre-image.ejson');
    const pre = EJSON.parse(raw, { relaxed: false });
    const m = JSON.parse(await load('garden-ignore-manifest.json'));
    assert.equal(sha(raw), m.preImageSha256, 'FILE_HASH');
    assert.equal(documentHash(pre), m.preImageSha256, 'ROUNDTRIP_HASH');
    assert.equal(Number(pre.__v), m.preImageVersion, 'BACKUP_VERSION');
    assert.equal(String(pre._id), TARGET._id, 'BACKUP_ID');
    assert.equal(m.collection, 'regionaldatarecords', 'BACKUP_COLLECTION');
    assert.equal(m.head, env.R32_HEAD, 'BACKUP_HEAD');
    assert.equal(m.image, env.R32_IMAGE, 'BACKUP_IMAGE');
    for (const [k, v] of Object.entries(TARGET))
      assert.equal(String(pre[k]), v, 'BACKUP_IDENTITY');
    for (const line of (await load('SHA256SUMS')).trim().split('\n')) {
      const match = /^([a-f0-9]{64})  ([a-zA-Z0-9.-]+)$/.exec(line);
      assert(match, 'CHECKSUM_FORMAT');
      assert.equal(sha(await load(match[2])), match[1], 'ARTIFACT_HASH');
    }
    const baseline = JSON.parse(await load('other-documents-hashes.json'));
    assert.equal(
      sha(JSON.stringify(baseline)),
      m.otherDocumentsSha256,
      'BASELINE_HASH',
    );
    return { pre, m, baseline };
  }
  async function check() {
    const b = await backup();
    await indexCheck();
    const result = await runIgnoreChangeDryRun({
      collection: c,
      preImage: b.pre,
      manifest: b.m,
    });
    assert.deepEqual(await invariants(), b.baseline, 'OTHER_DOCUMENT_CHANGED');
    output(result);
    return b;
  }
  async function http(path, method = 'GET', body) {
    assert(env.ADMIN_WRITE_TOKEN, 'ADMIN_TOKEN_MISSING');
    const r = await fetchImpl(`http://api:3000${path}`, {
      method,
      headers: {
        'x-admin-token': env.ADMIN_WRITE_TOKEN,
        'content-type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    assert(r.ok, `HTTP_${r.status}_STOP`);
    return r.json();
  }
  const endpoint = `/api/admin/regional-data/${TARGET.id}`;
  if (mode === 'read') {
    const d = await documents();
    output(
      ['garden', 'video', 'festival'].map((k) => ({
        key: k,
        ...summary(d[k]),
      })),
    );
  }
  if (mode === 'capture') {
    await indexCheck();
    const d = await documents(),
      g = d.garden;
    assert(
      !g.registration && Number.isInteger(g.__v) && g.updatedAt instanceof Date,
      'ELIGIBLE',
    );
    const baseline = await invariants();
    const d2 = await documents();
    for (const key of Object.keys(d))
      assert.equal(documentHash(d[key]), documentHash(d2[key]), 'CAPTURE_RACE');
    assert.deepEqual(await invariants(), baseline, 'CAPTURE_OTHER_RACE');
    const m = {
      collection: 'regionaldatarecords',
      head: env.R32_HEAD,
      image: env.R32_IMAGE,
      capturedAt: new Date().toISOString(),
      target: TARGET,
      preImageSha256: documentHash(g),
      preImageVersion: g.__v,
      protectedFactsSha256: protectedHash(g),
      otherDocumentsSha256: sha(JSON.stringify(baseline)),
      ...Object.fromEntries(
        NEIGHBORS.map((n) => [`${n.key}Sha256`, documentHash(d[n.key])]),
      ),
    };
    await runIgnoreChangeDryRun({ collection: c, preImage: g, manifest: m });
    await files.create(); // EEXIST aborts; never overwrite an earlier backup.
    await save('garden-pre-image.ejson', encode(g));
    await save('garden-ignore-manifest.json', JSON.stringify(m, null, 2));
    await save('other-documents-hashes.json', JSON.stringify(baseline));
    await save(
      'three-documents-before.json',
      JSON.stringify(
        ['garden', 'video', 'festival'].map((k) => ({
          key: k,
          ...summary(d[k]),
        })),
        null,
        2,
      ),
    );
    const artifactNames = [
      'garden-pre-image.ejson',
      'garden-ignore-manifest.json',
      'other-documents-hashes.json',
      'three-documents-before.json',
    ];
    await save(
      'SHA256SUMS',
      (
        await Promise.all(
          artifactNames.map(async (n) => `${sha(await load(n))}  ${n}`),
        )
      ).join('\n') + '\n',
    );
    await backup();
    output({
      backupVerified: true,
      files: artifactNames,
      preImageSha256: m.preImageSha256,
      preImageVersion: m.preImageVersion,
    });
  }
  if (mode === 'check') await check();
  if (mode === 'preflight') {
    const b = await check();
    const response = await http(`${endpoint}/ignore-change-preflight`);
    // Never persist or print an arbitrary HTTP body, including future extra fields.
    const p = {
      requestId: response.requestId,
      expectedHash: response.expectedHash,
      expectedVersion: response.expectedVersion,
    };
    assert.equal(p.expectedHash, b.m.preImageSha256, 'PREFLIGHT_HASH');
    assert.equal(p.expectedVersion, b.m.preImageVersion, 'PREFLIGHT_VERSION');
    assert(/^[a-f0-9-]{36}$/i.test(p.requestId), 'REQUEST_ID');
    await save('request.json', JSON.stringify({ precondition: p }, null, 2));
    output({ ready: true, ...p });
  }
  if (mode === 'apply') {
    assert.equal(
      env.R32_APPROVED,
      'IGNORE_CHANGE_RECEIPT32',
      'WRITE_NOT_AUTHORIZED',
    );
    const b = await check();
    const request = JSON.parse(await load('request.json'));
    assert.equal(request.precondition.expectedHash, b.m.preImageSha256);
    assert.equal(request.precondition.expectedVersion, b.m.preImageVersion);
    const result = await http(
      `${endpoint}/actions/IGNORE_CHANGE`,
      'POST',
      request,
    );
    assert.equal(String(result._id), TARGET._id, 'RETURNED_ID');
    const current = (await documents()).garden;
    const events = (current.auditTrail || []).filter(
      (e) =>
        e.action === 'IGNORE_CHANGE' &&
        e.requestId === request.precondition.requestId,
    );
    assert.equal(events.length, 1, 'AUDIT_COUNT');
    assert.equal(current.__v, b.m.preImageVersion + 1, 'POST_VERSION');
    output({
      singleTargetReturned: true,
      targetId: String(current._id),
      requestId: request.precondition.requestId,
      auditCount: events.length,
      nextStep: 'post',
    });
  }
  if (mode === 'post') {
    const { pre, m, baseline } = await backup(),
      d = await documents(),
      g = d.garden;
    const request = JSON.parse(await load('request.json')).precondition;
    assert.equal(g.lifecycleStatus, 'ACTIVE');
    assert.equal(g.verificationStatus, 'VERIFIED');
    assert(!Object.hasOwn(g, 'proposedFacts'));
    assert.deepEqual(g.detectedChanges, []);
    assert.equal(g.__v, m.preImageVersion + 1);
    assert(g.updatedAt instanceof Date);
    assert(
      Number(g.updatedAt) > Number(pre.updatedAt),
      'UPDATED_AT_NOT_ADVANCED',
    );
    assert.equal(protectedHash(g), m.protectedFactsSha256, 'PROTECTED_FACTS');
    assert.equal(
      g.auditTrail.length,
      (pre.auditTrail || []).length + 1,
      'AUDIT_LENGTH',
    );
    assert(eq(g.auditTrail.slice(0, -1), pre.auditTrail || []), 'AUDIT_PREFIX');
    const a = g.auditTrail.at(-1);
    assert.equal(a.action, 'IGNORE_CHANGE');
    assert.equal(a.requestId, request.requestId);
    assert.equal(a.expectedHash, m.preImageSha256);
    assert.equal(a.expectedVersion, m.preImageVersion);
    const token = env.ADMIN_WRITE_TOKEN;
    assert(token, 'ADMIN_TOKEN_MISSING');
    const actor =
      env.ADMIN_ACTOR_ID || `ADMIN_TOKEN:${sha(token).slice(0, 16)}`;
    assert.equal(a.actorId, actor);
    assert.equal(a.result, 'APPLIED');
    assert.equal(a.conflict, false);
    assert.equal(a.regionId, TARGET.regionId);
    assert.equal(a.at, g.updatedAt.toISOString());
    assert(eq(a.changes, pre.detectedChanges));
    assert(eq(a.source, pre.source));
    for (const n of NEIGHBORS)
      assert.equal(
        documentHash(d[n.key]),
        m[`${n.key}Sha256`],
        'NEIGHBOR_HASH',
      );
    assert.deepEqual(await invariants(), baseline, 'OTHER_DOCUMENT_CHANGED');
    const post = {
      ...m,
      expectedPostImageSha256: documentHash(g),
      expectedCurrentVersion: g.__v,
    };
    await save('garden-restore-manifest.json', JSON.stringify(post, null, 2));
    await save(
      'three-documents-after.json',
      JSON.stringify(
        ['garden', 'video', 'festival'].map((k) => ({
          key: k,
          ...summary(d[k]),
        })),
        null,
        2,
      ),
    );
    output({
      verified: true,
      targetCount: 1,
      version: g.__v,
      before: m.preImageSha256,
      after: documentHash(g),
      protectedFactsUnchanged: true,
      allOtherApplicationDocumentsUnchanged: true,
      neighborHashes: Object.fromEntries(
        NEIGHBORS.map((n) => [n.key, documentHash(d[n.key])]),
      ),
    });
  }
  if (mode === 'restore-dry' || mode === 'restore-apply') {
    const { pre, m: beforeManifest, baseline } = await backup();
    const m = JSON.parse(await load('garden-restore-manifest.json'));
    for (const key of Object.keys(beforeManifest))
      assert.deepEqual(m[key], beforeManifest[key], 'RESTORE_MANIFEST_LINEAGE');
    const d = await documents(),
      g = d.garden;
    assert.deepEqual(await invariants(), baseline, 'OTHER_DOCUMENT_CHANGED');
    const plan = planReceipt32Restore({
      preImage: pre,
      current: g,
      neighbors: d,
      manifest: m,
      actorId: 'RECEIPT32_OPERATOR',
      reason: 'receipt 32 approved document recovery',
    });
    assert(plan.protectedFactsUnchanged);
    assert.equal(protectedHash(g), m.protectedFactsSha256);
    if (mode === 'restore-dry')
      output({
        valid: true,
        mode: 'RESTORE_DRY_RUN',
        target: TARGET,
        restoredFields: Object.keys(plan.restored),
        expectedPostImageSha256: m.expectedPostImageSha256,
      });
    else {
      assert.equal(
        env.R32_APPROVED,
        'RESTORE_RECEIPT32',
        'RESTORE_NOT_AUTHORIZED',
      );
      const after = await c.findOneAndUpdate(
        {
          _id: g._id,
          id: TARGET.id,
          __v: g.__v,
          $expr: { $eq: ['$$ROOT', { $literal: g }] },
        },
        {
          $set: { ...plan.restored, updatedAt: new Date() },
          $push: { auditTrail: plan.audit },
          $inc: { __v: 1 },
        },
        {
          returnDocument: 'after',
          includeResultMetadata: false,
          upsert: false,
        },
      );
      assert(after, 'RESTORE_MATCHED_ZERO');
      for (const f of Object.keys(plan.restored))
        assert(eq(after[f], pre[f]), 'RESTORED_FIELD');
      assert.equal(protectedHash(after), m.protectedFactsSha256);
      assert.equal(after.__v, g.__v + 1);
      assert.equal(after.auditTrail.length, g.auditTrail.length + 1);
      assert(eq(after.auditTrail.slice(0, -1), g.auditTrail));
      assert(eq(after.auditTrail.at(-1), plan.audit));
      assert.deepEqual(await invariants(), baseline, 'OTHER_DOCUMENT_CHANGED');
      output({
        mode: 'RESTORED',
        singleTargetReturned: true,
        targetId: String(after._id),
        postRestoreSha256: documentHash(after),
      });
    }
  }
  if (mode === 'public') {
    const r = await fetchImpl(
      'http://client/api/facilities?regionId=hapcheon',
      { signal: AbortSignal.timeout(20000) },
    );
    assert(r.ok, `PUBLIC_HTTP_${r.status}`);
    const rows = await r.json();
    assert(Array.isArray(rows));
    const expected = [
      ['hapcheonVideoThemePark', '합천 영상테마파크'],
      ['hapcheonGardenThemePark', '합천 정원테마파크'],
      ['cPark', '씨파크'],
    ];
    for (const [id, label] of expected) {
      const found = rows.filter(
        (x) => x.uri === `https://hapcheon.example/ontology#${id}`,
      );
      assert.equal(found.length, 1);
      assert.equal(found[0].label, label);
      output({
        canonicalId: found[0].uri,
        displayName: found[0].label,
        publicCount: 1,
      });
    }
  }
}

export async function main(
  args = process.argv.slice(2),
  {
    env = process.env,
    output = (value) => process.stdout.write(JSON.stringify(value) + '\n'),
    connect = async () => {
      assert(
        process.platform === 'linux' && process.cwd() === '/app',
        'APP_RUNTIME_REQUIRED',
      );
      assert(env.MONGODB_URI, 'DB_CONFIGURATION');
      await mongoose.connect(env.MONGODB_URI, {
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 10000,
      });
      return mongoose.connection.db;
    },
    disconnect = () => mongoose.disconnect(),
    files = privateFiles(),
    fetchImpl = fetch,
    indexLoader = () =>
      createRequire(import.meta.url)(
        '../dist/regional-data/candidate-observation.js',
      ).observationPreflight,
  } = {},
) {
  let opened = false,
    status = 0;
  try {
    const mode = parseMode(args);
    validateOptions(mode, env);
    // Public mode performs HTTP GET only, without opening Mongo or loading index code.
    let db, observationPreflight;
    if (mode !== 'public') {
      opened = true;
      db = await connect();
      observationPreflight = indexLoader();
    }
    await runCloseOps({
      mode,
      env,
      db,
      files,
      fetchImpl,
      observationPreflight,
      output,
    });
  } catch {
    output({
      ok: false,
      action: 'STOP',
      message:
        'Receipt 32 validation failed. No automatic retry or restore. Inspect private evidence; never refresh a stale precondition blindly.',
    });
    status = 1;
  } finally {
    if (opened)
      try {
        await disconnect();
      } catch {
        status = 1;
        output({
          ok: false,
          action: 'STOP',
          message: 'Database disconnect failed.',
        });
      }
  }
  return status;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.exitCode = await main();
}
