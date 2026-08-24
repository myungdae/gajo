import type { DiscoveryCategory } from './intent-routing';
export const DISCOVERY_CATEGORY_MATCH: Record<
  DiscoveryCategory,
  (record: any) => boolean
> = {
  CAFE: (r) => r.entityType === 'CAFE' || r.category === 'CAFE',
  FOOD: (r) => r.entityType === 'RESTAURANT' || r.category === 'FOOD',
  LODGING: (r) =>
    r.entityType === 'ACCOMMODATION' ||
    /LODGING|ACCOMMODATION/.test(r.category),
  ACTIVITY: (r) => /EXPERIENCE|ACTIVITY/.test(`${r.entityType} ${r.category}`),
  TOURISM_NATURE: (r) =>
    /ATTRACTION|TOURISM/.test(`${r.entityType} ${r.category}`),
  CONVENIENCE: (r) => /CONVENIENCE/.test(`${r.entityType} ${r.category}`),
  CONVENIENCE_STORE: (r) =>
    /CONVENIENCE_STORE/.test(`${r.entityType} ${r.category}`) ||
    /편의점|(?:^|\s)(?:CU|GS25)(?:\s|$)|세븐일레븐|이마트24|미니스톱/i.test(
      r.canonicalLabelKo || '',
    ),
  MART_SUPERMARKET: (r) =>
    /MART|SUPERMARKET|GROCERY/.test(`${r.entityType} ${r.category}`) ||
    /마트|슈퍼마켓|슈퍼(?!맨)|식료품점/.test(r.canonicalLabelKo || ''),
  ESSENTIAL_SHOPPING: (r) =>
    DISCOVERY_CATEGORY_MATCH.CONVENIENCE_STORE(r) ||
    DISCOVERY_CATEGORY_MATCH.MART_SUPERMARKET(r),
  PARKING: (r) => /PARKING|PARKING_LOT/.test(`${r.entityType} ${r.category}`) || /주차장/.test(r.canonicalLabelKo || ''),
  PUBLIC_TOILET: (r) => /PUBLIC_TOILET|RESTROOM/.test(`${r.entityType} ${r.category}`) || /공중화장실/.test(r.canonicalLabelKo || ''),
  GAS_STATION: (r) => /GAS_STATION|FUEL_STATION/.test(`${r.entityType} ${r.category}`) || /주유소/.test(r.canonicalLabelKo || ''),
  EV_CHARGER: (r) => /EV_CHARGER|EV_CHARGING/.test(`${r.entityType} ${r.category}`) || /전기차.*충전|EV.*충전/i.test(r.canonicalLabelKo || ''),
  TOURIST_INFORMATION: (r) => /TOURIST_INFORMATION|VISITOR_CENTER/.test(`${r.entityType} ${r.category}`) || /관광안내소/.test(r.canonicalLabelKo || ''),
  HOT_SPRING_WELLNESS: (r) =>
    /HOT_SPRING|WELLNESS|SAUNA|BATH|SPA/.test(`${r.entityType} ${r.category}`),
};
export const isDiscoveryEligible = (record: any, category: DiscoveryCategory) =>
  DISCOVERY_CATEGORY_MATCH[category](record);
