import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mongo } from 'mongoose';
import type { RegionConfig } from '../region/region-config.service';

export interface LocationActor {
  actorId: string;
  allowedRegionIds: string[];
  canWrite: boolean;
}
export interface ProposedLocation {
  latitude: number;
  longitude: number;
  normalizedAddress: string;
  sourceType: string;
  sourceReference: string;
  proposedBy: string;
  proposedAt: string;
  reason: string;
  verificationStatus: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'RESTORED';
  reviewedBy?: string;
  reviewedAt?: string;
}
export const LOCATION_SOURCES = [
  'OFFICIAL_LOCAL_GOV',
  'OFFICIAL_BUSINESS',
  'OFFICIAL_MAP_LISTING',
  'KTO',
  'FIELD_SURVEY',
  'OTHER_VERIFIED_SOURCE',
];
export function locationScope(
  actor: LocationActor,
  regionId: string,
  write = false,
) {
  if (
    !regionId ||
    !actor?.actorId ||
    !Array.isArray(actor.allowedRegionIds) ||
    !actor.allowedRegionIds.some((r) => r === '*' || r === regionId) ||
    (write && !actor.canWrite)
  )
    throw new ForbiddenException('이 지역의 위치정보 관리 권한이 필요합니다.');
}
export function validLocation(value: any): boolean {
  return (
    typeof value?.latitude === 'number' &&
    typeof value?.longitude === 'number' &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180 &&
    !(value.latitude === 0 && value.longitude === 0)
  );
}
export function currentLocation(row: any) {
  // Once managed, the approved snapshot is authoritative even if a legacy action edits flat fields.
  const value = row.approvedLocation !== undefined ? row.approvedLocation : row;
  return validLocation(value)
    ? { latitude: value.latitude, longitude: value.longitude }
    : undefined;
}
export function approvedLocationUsable(row: any) {
  // Historical RDM contract: an approved coordinate field or VERIFIED current
  // facts, never a bare numeric pair, establish approval. Curated baselines keep
  // their own provenance contract and are handled through their public projection.
  return (
    Boolean(currentLocation(row)) &&
    (row.approvedLocation !== undefined
      ? row.approvedLocation?.verificationStatus === 'APPROVED'
      : row.verificationStatus === 'VERIFIED' ||
        row.fieldEvidence?.coordinates?.status === 'APPROVED')
  );
}
export function locationSnapshot(row: any, publicPlace?: any): any {
  if (row.approvedLocation !== undefined) return row.approvedLocation;
  const field = row.fieldEvidence?.coordinates;
  const currentApproved = approvedLocationUsable(row);
  const curated =
    publicPlace?.entityUri === row.canonicalEntityId &&
    validLocation(publicPlace?.actions?.navigate);
  if (!currentApproved && !curated) return { verificationStatus: 'UNVERIFIED' };
  const source = currentApproved
    ? field?.status === 'APPROVED'
      ? field.source
      : row.source
    : publicPlace.coordinateSource || publicPlace.source;
  return {
    ...(currentApproved ? currentLocation(row) : publicPlace.actions.navigate),
    verificationStatus: 'APPROVED',
    legacy: true,
    compatibilityRule: currentApproved
      ? field?.status === 'APPROVED'
        ? 'APPROVED_COORDINATE_FIELD'
        : 'VERIFIED_CURRENT_FACTS'
      : 'CURATED_PUBLIC_LOCATION',
    sourceType: source?.sourceType || null,
    sourceReference: source?.sourceUrl || null,
    legacyEvidence:
      currentApproved && field?.status === 'APPROVED' ? field : source || null,
  };
}
export function canRestoreLocation(row: any) {
  const withoutRollback = { ...row };
  delete withoutRollback.locationRollback;
  return Boolean(
    row.locationRollback &&
    row.__v === row.locationRollback.approvedVersion &&
    stableLocationHash(withoutRollback) === row.locationRollback.postHash,
  );
}
function requiredText(value: unknown, name: string, min = 1, max = 500) {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.length > max
  )
    throw new BadRequestException(`${name}을(를) 입력해 주세요.`);
  return value.trim();
}
export function locationProposal(
  raw: any,
  actorId: string,
  at: string,
): ProposedLocation {
  if (
    !raw ||
    Object.keys(raw).some(
      (k) =>
        ![
          'latitude',
          'longitude',
          'normalizedAddress',
          'sourceType',
          'sourceReference',
          'reason',
        ].includes(k),
    ) ||
    !validLocation(raw)
  )
    throw new BadRequestException(
      '유효한 위도·경도와 위치 검토 항목만 입력해 주세요.',
    );
  if (!LOCATION_SOURCES.includes(raw.sourceType))
    throw new BadRequestException('위치 출처 유형을 선택해 주세요.');
  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    normalizedAddress: requiredText(raw.normalizedAddress, '확인 주소'),
    sourceType: raw.sourceType,
    sourceReference: requiredText(raw.sourceReference, '출처 근거', 3, 1000),
    reason: requiredText(raw.reason, '변경 사유', 5),
    proposedBy: actorId,
    proposedAt: at,
    verificationStatus: 'PROPOSED',
  };
}
export function locationReason(value: unknown) {
  return requiredText(value, '검토 사유', 5);
}
export function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
}
export function locationWarnings(
  row: any,
  candidate: any,
  config: RegionConfig,
  others: any[],
) {
  const bounds = config.bounds;
  const boundaryKnown = Boolean(
    bounds &&
    [bounds.north, bounds.south, bounds.east, bounds.west].every(
      Number.isFinite,
    ) &&
    bounds.north > bounds.south &&
    bounds.east > bounds.west &&
    bounds.north <= 90 &&
    bounds.south >= -90 &&
    bounds.east <= 180 &&
    bounds.west >= -180,
  );
  const outside =
    validLocation(candidate) &&
    bounds &&
    boundaryKnown &&
    (candidate.latitude > bounds.north ||
      candidate.latitude < bounds.south ||
      candidate.longitude > bounds.east ||
      candidate.longitude < bounds.west);
  const current = currentLocation(row);
  const movedMeters =
    current && validLocation(candidate)
      ? metersBetween(current, candidate)
      : undefined;
  const duplicates = validLocation(candidate)
    ? others
        .filter(
          (r) =>
            r.canonicalEntityId !== row.canonicalEntityId &&
            approvedLocationUsable(r) &&
            metersBetween(currentLocation(r)!, candidate) <= 5,
        )
        .map((r) => ({
          id: r.id,
          canonicalEntityId: r.canonicalEntityId,
          displayName: r.displayName,
        }))
    : [];
  return {
    boundaryKnown: Boolean(boundaryKnown),
    outsideRegion: Boolean(outside),
    movedMeters,
    largeMove: movedMeters !== undefined && movedMeters > 1000,
    duplicates,
    approvalBlocked:
      !validLocation(candidate) || !boundaryKnown || Boolean(outside),
  };
}
export const locationHash = (row: any) =>
  createHash('sha256')
    .update(mongo.BSON.EJSON.stringify(row, { relaxed: false }))
    .digest('hex');
export function stableLocationHash(row: any): string {
  const order = (value: any): any =>
    Array.isArray(value)
      ? value.map(order)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, order(value[k])]),
          )
        : value;
  return createHash('sha256')
    .update(
      JSON.stringify(
        order(mongo.BSON.EJSON.serialize(row, { relaxed: false })),
      ),
    )
    .digest('hex');
}
