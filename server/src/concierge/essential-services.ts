import { DISCOVERY_CATEGORY_MATCH } from './discovery-eligibility';

export const ESSENTIAL_SERVICE_TYPES = [
  'PARKING', 'PUBLIC_TOILET', 'GAS_STATION', 'EV_CHARGER',
  'CONVENIENCE_STORE', 'MART_SUPERMARKET', 'TOURIST_INFORMATION',
] as const;
export type EssentialServiceType = (typeof ESSENTIAL_SERVICE_TYPES)[number];
export type Readiness = 'READY' | 'PARTIAL' | 'SEARCH_ONLY' | 'DATA_REQUIRED';
export type EssentialNavigationMode = 'VERIFIED' | 'OFFICIAL_PREVIEW';
export type RegionBounds = { north:number; south:number; east:number; west:number };
const PREVIEW_COORDINATE_SOURCES = new Set(['MUNICIPAL_OFFICIAL','PUBLIC_DATA']);

export const ESSENTIAL_OPERATIONAL_FIELDS: Record<EssentialServiceType, readonly string[]> = {
  PARKING: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','parkingType?','feeEvidence?','accessibilityParkingEvidence?'],
  PUBLIC_TOILET: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','accessibleToiletEvidence?'],
  GAS_STATION: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','phone?','operatingHours?','fuelTypeEvidence?'],
  EV_CHARGER: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatorEvidence?','chargerEvidence?','liveStatusApiEvidence?'],
  CONVENIENCE_STORE: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','phone?'],
  MART_SUPERMARKET: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','phone?'],
  TOURIST_INFORMATION: ['canonicalIdentity','regionId','coordinates','address','lifecycle','provenance','operatingHours?','phone?'],
};

export function officialCoordinateNavigation(record: any, bounds?: RegionBounds): { mode:EssentialNavigationMode; latitude:number; longitude:number } | undefined {
  const latitude = Number(record?.latitude), longitude = Number(record?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (bounds && (latitude < bounds.south || latitude > bounds.north || longitude < bounds.west || longitude > bounds.east)) return undefined;
  if (record?.runtimeDataStatus === 'VERIFIED') return { mode:'VERIFIED', latitude, longitude };
  if (bounds && record?.runtimeDataStatus === 'PARTIAL' && PREVIEW_COORDINATE_SOURCES.has(record?.coordinateSource?.sourceType))
    return { mode:'OFFICIAL_PREVIEW', latitude, longitude };
  return undefined;
}

export function essentialServiceReadiness(records: readonly any[], searchConfigured = false, bounds?:RegionBounds) {
  return Object.fromEntries(ESSENTIAL_SERVICE_TYPES.map((type) => {
    const matches = records.filter(DISCOVERY_CATEGORY_MATCH[type]);
    const navigationEligible = matches.filter((r) => officialCoordinateNavigation(r,bounds));
    const verified = matches.filter((r) => officialCoordinateNavigation(r,bounds)?.mode === 'VERIFIED');
    const status: Readiness = verified.length ? 'READY' : matches.length ? 'PARTIAL' : searchConfigured ? 'SEARCH_ONLY' : 'DATA_REQUIRED';
    return [type, { status, canonicalCount: matches.length, navigationEligibleCount:navigationEligible.length, previewNavigationCount:navigationEligible.length-verified.length }];
  }));
}

export function safeEssentialActions(record: any, bounds?:RegionBounds) {
  const navigation = officialCoordinateNavigation(record,bounds);
  return { navigate:navigation?{latitude:navigation.latitude,longitude:navigation.longitude,evidenceMode:navigation.mode}:undefined, call:record?.runtimeDataStatus==='VERIFIED'&&record.telephone?record.actions?.call:undefined };
}
