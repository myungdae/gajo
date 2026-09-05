import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mongo } from 'mongoose';

const { EJSON } = mongo.BSON;
export const ignoreChangeHash = (row: any) => createHash('sha256')
  .update(EJSON.stringify(row, { relaxed: false })).digest('hex');
export type IgnoreChangePrecondition = {
  requestId: string; expectedVersion: number; expectedHash: string;
};
function eligible(row: any) {
  return row && !row.registration && row.verificationStatus === 'VERIFIED' &&
    row.lifecycleStatus === 'CHANGE_DETECTED' && row.proposedFacts &&
    row.detectedChanges?.length > 0 && Number.isInteger(row.__v);
}
export async function prepareIgnoreChange(collection: any, id: string) {
  const row = await collection.findOne({ id });
  if (!row) throw new NotFoundException();
  if (!eligible(row)) throw new ConflictException('IGNORE_CHANGE_PRECONDITION_FAILED');
  return { requestId: randomUUID(), expectedVersion: row.__v, expectedHash: ignoreChangeHash(row) };
}

// Reads and updates raw BSON so defaults/casting cannot alter the captured image.
// Conflict auditing goes to the application audit log, never the target document.
export async function atomicIgnoreChange(
  collection: any, id: string, actorId: string, precondition: IgnoreChangePrecondition,
  audit: (event: Record<string, unknown>) => void,
) {
  if (!precondition || !/^[a-f0-9-]{36}$/i.test(precondition.requestId || '') ||
      !/^[a-f0-9]{64}$/.test(precondition.expectedHash || '') ||
      !Number.isInteger(precondition.expectedVersion))
    throw new BadRequestException('IGNORE_CHANGE_REQUIRES_PREFLIGHT');
  const { requestId, expectedVersion, expectedHash } = precondition;
  const log = (result: string) => audit({ action: 'IGNORE_CHANGE', id, actorId, requestId,
    result, conflict: result === 'CONFLICT', at: new Date().toISOString() });
  const conflict = () => { log('CONFLICT'); throw new ConflictException('IGNORE_CHANGE_CONFLICT'); };
  const replay = (row: any) => row?.auditTrail?.find((event: any) =>
    event.action === 'IGNORE_CHANGE' && event.requestId === requestId);
  const replayResult = (row: any, event: any) => {
    if (event.actorId !== actorId || event.expectedHash !== expectedHash ||
        event.expectedVersion !== expectedVersion) return conflict();
    return row;
  };
  const row = await collection.findOne({ id });
  if (!row) return conflict();
  const prior = replay(row);
  if (prior) return replayResult(row, prior);
  if (!eligible(row) || row.__v !== expectedVersion || ignoreChangeHash(row) !== expectedHash)
    return conflict();
  const at = new Date().toISOString();
  const after = await collection.findOneAndUpdate({
    _id: row._id, id, __v: expectedVersion, lifecycleStatus: 'CHANGE_DETECTED',
    verificationStatus: 'VERIFIED',
    // Includes fields added by concurrent writers even if they did not bump __v.
    $expr: { $eq: ['$$ROOT', { $literal: row }] },
  }, {
    $set: { lifecycleStatus: 'ACTIVE', detectedChanges: [], updatedAt: new Date(at) },
    $unset: { proposedFacts: '' }, $inc: { __v: 1 },
    $push: { auditTrail: { action: 'IGNORE_CHANGE', at, actorId, regionId: row.regionId,
      source: row.source, changes: row.detectedChanges, requestId, expectedVersion,
      expectedHash, result: 'APPLIED', conflict: false } },
  }, { returnDocument: 'after', includeResultMetadata: false });
  if (!after) {
    const latest = await collection.findOne({ _id: row._id });
    const completed = replay(latest);
    if (completed) return replayResult(latest, completed);
    return conflict();
  }
  log('APPLIED');
  return after;
}
