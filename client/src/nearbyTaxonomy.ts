import type { NearbyCategory } from './api/client';

export type NearbyGroupId = 'TOURISM' | 'FOOD' | 'LODGING' | 'CONVENIENCE';
export type NearbyOption = { id: NearbyCategory; label: string };
export type NearbyGroup = { id: NearbyGroupId; label: string; description: string; options: NearbyOption[] };

export const NEARBY_GROUPS: NearbyGroup[] = [
  { id: 'TOURISM', label: '관광·체험', description: '볼거리와 현장 경험', options: [
    { id: 'TOURIST_ATTRACTION', label: '관광지' }, { id: 'NATURE', label: '자연' },
    { id: 'CULTURE_ART', label: '문화·예술' }, { id: 'EXPERIENCE', label: '체험' },
    { id: 'FESTIVAL_EXHIBITION', label: '축제·전시' },
  ] },
  { id: 'FOOD', label: '음식', description: '식사와 카페', options: [
    { id: 'FOOD', label: '전체 음식점' }, { id: 'FOOD_KOREAN', label: '한식' },
    { id: 'FOOD_WESTERN', label: '양식' }, { id: 'FOOD_CHINESE', label: '중식' },
    { id: 'FOOD_JAPANESE', label: '일식' }, { id: 'CAFE_BAKERY', label: '카페·베이커리' },
  ] },
  { id: 'LODGING', label: '숙소', description: '머물 곳 찾기', options: [
    { id: 'LODGING', label: '전체 숙소' }, { id: 'LODGING_HOTEL_RESORT', label: '호텔·리조트' },
    { id: 'LODGING_PENSION_MINBAK', label: '펜션·민박' }, { id: 'LODGING_CAMPING_GLAMPING', label: '캠핑·글램핑' },
    { id: 'LODGING_MOTEL', label: '모텔' }, { id: 'LODGING_GUESTHOUSE', label: '게스트하우스' },
  ] },
  { id: 'CONVENIENCE', label: '생활편의', description: '여행 중 필요한 곳', options: [
    { id: 'CONVENIENCE_STORE', label: '편의점' }, { id: 'MART_SUPERMARKET', label: '마트' },
    { id: 'GAS_STATION', label: '주유소' }, { id: 'MEDICAL', label: '약국·병원' },
    { id: 'PUBLIC_TOILET', label: '화장실' }, { id: 'PARKING', label: '주차장' }, { id: 'ATM', label: 'ATM' },
  ] },
];

export function nearbyGroupFor(category: NearbyCategory): NearbyGroup {
  return NEARBY_GROUPS.find(group => group.options.some(option => option.id === category)) || NEARBY_GROUPS[0];
}

export function nearbyUiCategory(category?: NearbyCategory): NearbyCategory {
  const aliases: Partial<Record<NearbyCategory, NearbyCategory>> = {
    CAFE: 'CAFE_BAKERY', TOURISM_NATURE: 'TOURIST_ATTRACTION', ACTIVITY: 'EXPERIENCE',
    PHARMACY: 'MEDICAL', HOSPITAL: 'MEDICAL', ESSENTIAL_SHOPPING: 'MART_SUPERMARKET', CONVENIENCE: 'CONVENIENCE_STORE',
  };
  const resolved = category ? aliases[category] || category : 'TOURIST_ATTRACTION';
  return NEARBY_GROUPS.some(group => group.options.some(option => option.id === resolved)) ? resolved : 'TOURIST_ATTRACTION';
}

export function nearbyLabel(category: NearbyCategory): string {
  return nearbyGroupFor(category).options.find(option => option.id === category)?.label || '주변 장소';
}

export function isLodgingCategory(category: NearbyCategory) {
  return nearbyGroupFor(category).id === 'LODGING';
}

export function isFoodCategory(category: NearbyCategory) {
  return nearbyGroupFor(category).id === 'FOOD';
}
