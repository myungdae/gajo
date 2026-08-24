import { DISCOVERY_CATEGORY_MATCH } from './discovery-eligibility';

export const ESSENTIAL_SERVICE_TYPES = [
  'PARKING', 'PUBLIC_TOILET', 'HEAT_SHELTER', 'GAS_STATION', 'EV_CHARGER',
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
  HEAT_SHELTER: ['canonicalIdentity','regionId','coordinates','address','lifecycle','authoritativePublicProvenance','operatingHoursEvidence?','currentOperationEvidence?','accessibilityEvidence?'],
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
    const matches = records.filter(DISCOVERY_CATEGORY_MATCH[type]).filter(record=>type!=='HEAT_SHELTER'||authoritativeSafetyEvidence(record));
    const navigationEligible = matches.filter((r) => officialCoordinateNavigation(r,bounds));
    const verified = matches.filter((r) => officialCoordinateNavigation(r,bounds)?.mode === 'VERIFIED');
    const status: Readiness = verified.length ? 'READY' : matches.length ? 'PARTIAL' : searchConfigured ? 'SEARCH_ONLY' : 'DATA_REQUIRED';
    return [type, { status, canonicalCount: matches.length, navigationEligibleCount:navigationEligible.length, previewNavigationCount:navigationEligible.length-verified.length }];
  }));
}

export function safeEssentialActions(record: any, bounds?:RegionBounds) {
  if (DISCOVERY_CATEGORY_MATCH.HEAT_SHELTER(record) && !authoritativeSafetyEvidence(record))
    return { navigate:undefined, call:undefined };
  const navigation = officialCoordinateNavigation(record,bounds);
  return { navigate:navigation?{latitude:navigation.latitude,longitude:navigation.longitude,evidenceMode:navigation.mode}:undefined, call:record?.runtimeDataStatus==='VERIFIED'&&record.telephone?record.actions?.call:undefined };
}

const AUTHORITATIVE_SAFETY_SOURCES = new Set(['MUNICIPAL_OFFICIAL','PUBLIC_DATA','OFFICIAL_LOCAL_GOV']);
export function authoritativeSafetyEvidence(record:any) {
  const sourceType=record?.source?.sourceType||record?.coordinateSource?.sourceType;
  return AUTHORITATIVE_SAFETY_SOURCES.has(sourceType);
}
