import { createHash } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';

export const OBSERVATION_INDEX = 'candidate_observation_v1_unique';
export const OBSERVATION_INDEX_KEY = { regionId: 1, candidateObservationKey: 1 } as const;
export const OBSERVATION_INDEX_OPTIONS = { name: OBSERVATION_INDEX, unique: true,
  partialFilterExpression: { candidateObservationKey: { $type: 'string' } } };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ');
// Only collection/request metadata is ignored; all other supplied facts are versioned.
const transient = new Set(['collectedAt', 'fetchedAt', 'ingestedAt', 'requestedAt', 'observedAt',
  'requestId', 'temporaryDocumentId', '_id', 'id', 'createdAt', 'updatedAt']);
function normalize(value: any, key = ''): any {
  if (Array.isArray(value)) return value.map(item => normalize(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(k => !transient.has(k) && value[k] !== undefined).map(k => [k, normalize(value[k], k)]));
  if (typeof value === 'string') {
    if (key === 'phone') return value.replace(/[^0-9+]/g, '');
    if (['latitude', 'longitude'].includes(key) && value.trim() && Number.isFinite(Number(value))) return Number(value);
    return text(value);
  }
  return value;
}
function stableUrl(raw: string) {
  const url = new URL(raw);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString();
}
export function candidateObservation(input: any) {
  const regionId = input.regionId;
  const sourceSystem = text(input.source.sourceSystem || stableUrl(input.source.sourceUrl));
  const sourceRecordId = input.source.sourceRecordId == null ? '' : text(String(input.source.sourceRecordId));
  const facts = normalize(input.proposedFacts);
  const sourceKey = hash([regionId, input.source.sourceType, sourceSystem, sourceRecordId || facts]);
  const fingerprint = hash(facts);
  return { candidateSourceKey: `v1:${sourceKey}`, candidateFingerprint: `v1:${fingerprint}`,
    candidateObservationKey: `v1:${hash([sourceKey, fingerprint])}` };
}
export async function requireObservationIndex(collection: any) {
  const indexes = await collection.listIndexes().toArray();
  if (!indexes.some((index: any) => index.name === OBSERVATION_INDEX && index.unique === true &&
    JSON.stringify(index.key) === JSON.stringify(OBSERVATION_INDEX_KEY) &&
    JSON.stringify(index.partialFilterExpression) === JSON.stringify(OBSERVATION_INDEX_OPTIONS.partialFilterExpression) &&
    (!index.collation || index.collation.locale === 'simple')))
    throw new ServiceUnavailableException('CANDIDATE_OBSERVATION_INDEX_REQUIRED');
}
export async function upsertObservation(model: any, regionId: string, keys: ReturnType<typeof candidateObservation>, insert?: any) {
  const filter = { regionId, candidateObservationKey: keys.candidateObservationKey };
  const update: any = { $max: { lastSeenAt: new Date() }, $inc: { seenCount: 1, __v: 1 } };
  if (insert) update.$setOnInsert = { ...insert, ...keys, createdAt: new Date() };
  const options = { upsert: !!insert, returnDocument: 'after' as const, timestamps: false, setDefaultsOnInsert: false };
  try { return await model.findOneAndUpdate(filter, update, options); }
  catch (error) {
    // A concurrent insert may win the unique index race. Retry only this exact key.
    if (error?.code !== 11000 || !insert) throw error;
    const existing = await model.findOneAndUpdate(filter,
      { $max: update.$max, $inc: update.$inc }, { ...options, upsert: false });
    if (!existing) throw error;
    return existing;
  }
}

// Read-only inspection. Reports hashes/IDs only; never picks a survivor or writes keys.
export async function observationPreflight(collection: any) {
  const stored = new Map<string, string[]>(), derived = new Map<string, string[]>();
  let legacyCount = 0, invalidCount = 0, scanned = 0;
  const add = (map: Map<string, string[]>, key: string, id: string) => map.set(key, [...(map.get(key) || []), id]);
  for await (const row of collection.find({})) {
    scanned++;
    const id = String(row._id);
    if (typeof row.candidateObservationKey === 'string') {
      add(stored, JSON.stringify([row.regionId, row.candidateObservationKey]), id);
    } else if (row.candidateObservationKey != null) invalidCount++;
    else legacyCount++;
    if (!row.registration && row.proposedFacts?.displayName && row.source?.sourceUrl && row.regionId) {
      try {
        const key = candidateObservation(row).candidateObservationKey;
        add(derived, JSON.stringify([row.regionId, key]), id);
      } catch { invalidCount++; }
    }
  }
  const groups = (map: Map<string, string[]>) => [...map].filter(([, ids]) => ids.length > 1)
    .map(([key, documentIds]) => ({ key, documentIds }));
  let indexReady = true;
  try { await requireObservationIndex(collection); } catch { indexReady = false; }
  return { readOnly: true, scanned, legacyCount, invalidCount, indexReady,
    indexConflicts: groups(stored), repeatedObservationGroups: groups(derived),
    proposedIndex: { key: OBSERVATION_INDEX_KEY, ...OBSERVATION_INDEX_OPTIONS },
    cleanup: 'MANUAL_REVIEW_ONLY_NO_DELETE_NO_MERGE_NO_BACKFILL' };
}
