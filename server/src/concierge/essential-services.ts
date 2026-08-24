import { DISCOVERY_CATEGORY_MATCH } from './discovery-eligibility';

export const ESSENTIAL_SERVICE_TYPES = [
  'PARKING', 'PUBLIC_TOILET', 'GAS_STATION', 'EV_CHARGER',
  'CONVENIENCE_STORE', 'MART_SUPERMARKET', 'TOURIST_INFORMATION',
] as const;
export type EssentialServiceType = (typeof ESSENTIAL_SERVICE_TYPES)[number];
export type Readiness = 'READY' | 'PARTIAL' | 'SEARCH_ONLY' | 'DATA_REQUIRED';

export const ESSENTIAL_OPERATIONAL_FIELDS: Record<EssentialServiceType, readonly string[]> = {
  PARKING: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','parkingType?','feeEvidence?','accessibilityParkingEvidence?'],
  PUBLIC_TOILET: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','accessibleToiletEvidence?'],
  GAS_STATION: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','phone?','operatingHours?','fuelTypeEvidence?'],
  EV_CHARGER: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatorEvidence?','chargerEvidence?','liveStatusApiEvidence?'],
  CONVENIENCE_STORE: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','phone?'],
  MART_SUPERMARKET: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','phone?'],
  TOURIST_INFORMATION: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','phone?'],
};

export function essentialServiceReadiness(records: readonly any[], searchConfigured = false) {
  return Object.fromEntries(ESSENTIAL_SERVICE_TYPES.map((type) => {
    const matches = records.filter(DISCOVERY_CATEGORY_MATCH[type]);
    const operational = matches.filter((r) => r.runtimeDataStatus === 'VERIFIED' && Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
    const status: Readiness = operational.length ? 'READY' : matches.length ? 'PARTIAL' : searchConfigured ? 'SEARCH_ONLY' : 'DATA_REQUIRED';
    return [type, { status, canonicalCount: matches.length, navigationEligibleCount: operational.length }];
  }));
}

export function safeEssentialActions(record: any) {
  const verified = record?.runtimeDataStatus === 'VERIFIED';
  const coordinates = Number.isFinite(record?.latitude) && Number.isFinite(record?.longitude);
  return { navigate: verified && coordinates ? record.actions?.navigate : undefined, call: verified && record.telephone ? record.actions?.call : undefined };
}

