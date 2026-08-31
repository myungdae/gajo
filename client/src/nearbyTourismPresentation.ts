import type { NearbyCategory, NearbyPlace } from './api/client';

const TOURISM = new Set<NearbyCategory>([
  'TOURIST_ATTRACTION', 'NATURE', 'CULTURE_ART', 'EXPERIENCE',
  'FESTIVAL_EXHIBITION', 'ACTIVITY', 'TOURISM_NATURE',
]);

export function isTourismSearch(category: NearbyCategory) {
  return TOURISM.has(category);
}

export function tourismRepresentativeTitle(regionName?: string) {
  return regionName ? `${regionName}에서 먼저 가볼 만한 곳` : '지역에서 먼저 가볼 만한 곳';
}

export function tourismResultSections(category: NearbyCategory, places: NearbyPlace[]) {
  if (!isTourismSearch(category)) return undefined;
  return {
    representative: places.filter((place) => place.tourismTrustLevel === 'REGIONAL_VERIFIED'),
    nearby: places.filter((place) => place.tourismTrustLevel !== 'REGIONAL_VERIFIED'),
  };
}
