import { routeNaturalLanguageIntent } from './intent-routing';
import { PlaceDiscoveryService } from './place-discovery.service';
import { normalizeNearbyCategory } from '../nearby/nearby.service';

const place = (entityUri: string, canonicalLabelKo: string, entityType: string, category: string, extra: any = {}) => ({
  entityUri, canonicalLabelKo, alternateLabels: [], entityType, category, tags: [category],
  latitude: 35.56, longitude: 128.16, runtimeDataStatus: 'VERIFIED', actions: { navigate: { latitude: 35.56, longitude: 128.16 } }, ...extra,
});
const anchor = place('anchor', '현재 장소', 'ATTRACTION', 'TOURISM_NATURE');
const convenience = place('cu', 'CU 지역점', 'CONVENIENCE_STORE', 'CONVENIENCE_STORE');
const mart = place('mart', '우리마트', 'MART', 'MART');
const grocery = place('grocery', '동네슈퍼', 'GROCERY_STORE', 'GROCERY');
const contamination = [place('food', '식당', 'RESTAURANT', 'FOOD'), place('cafe', '카페', 'CAFE', 'CAFE'), place('stay', '펜션', 'ACCOMMODATION', 'ACCOMMODATION')];
const records = [anchor, convenience, mart, grocery, ...contamination];
const regional = { effectiveDataset: jest.fn(async (regionId: string) => ({ regionId, records: regionId === 'hapcheon' ? records : [] })) };

describe('essential-shopping intent taxonomy', () => {
  it('prefers the explicit convenience-store type', () => {
    expect(routeNaturalLanguageIntent({ rawMessage: '근처 편의점 있어?', inputMode: 'FREE_TEXT' })).toMatchObject({ intentRoute: 'PLACE_DISCOVERY', category: 'CONVENIENCE_STORE' });
  });
  it.each(['장 볼 데 있어?', '물하고 과자 살 데 있어?', '생필품 살 곳 있어?'])('%s routes to broad essential shopping', (rawMessage) => {
    expect(routeNaturalLanguageIntent({ rawMessage, inputMode: 'FREE_TEXT' })).toMatchObject({ intentRoute: 'PLACE_DISCOVERY', category: 'ESSENTIAL_SHOPPING' });
  });
  it('narrows and switches shopping subtypes during follow-up', () => {
    expect(routeNaturalLanguageIntent({ rawMessage: '편의점만 보여줘.', inputMode: 'FREE_TEXT', isFollowup: true, discoveryCategoryHint: 'ESSENTIAL_SHOPPING' })).toMatchObject({ intentRoute: 'PLACE_DISCOVERY', category: 'CONVENIENCE_STORE' });
    expect(routeNaturalLanguageIntent({ rawMessage: '마트는?', inputMode: 'FREE_TEXT', isFollowup: true, discoveryCategoryHint: 'CONVENIENCE_STORE' })).toMatchObject({ intentRoute: 'PLACE_DISCOVERY', category: 'MART_SUPERMARKET' });
    expect(routeNaturalLanguageIntent({ rawMessage: '다른 데는?', inputMode: 'FREE_TEXT', isFollowup: true, discoveryCategoryHint: 'ESSENTIAL_SHOPPING' })).toMatchObject({ intentRoute: 'PLACE_DISCOVERY', category: 'ESSENTIAL_SHOPPING', alternative: true });
  });
});

describe('essential-shopping target eligibility', () => {
  const service = new PlaceDiscoveryService(regional as any);
  it('keeps convenience stores distinct and preferred for an explicit request', async () => {
    const result: any = await service.discover('hapcheon', 'CONVENIENCE_STORE', '근처 편의점 있어?', {});
    expect(result.entities.map((x: any) => x.entityId)).toEqual(['cu']);
    expect(result.entities[0]).toMatchObject({ entityType: 'CONVENIENCE_STORE', category: 'CONVENIENCE_STORE' });
  });
  it('allows all and only explicit shopping types for broad practical requests', async () => {
    const result: any = await service.discover('hapcheon', 'ESSENTIAL_SHOPPING', '장 볼 데 있어?', {});
    expect(new Set(result.entities.map((x: any) => x.entityId))).toEqual(new Set(['cu', 'mart', 'grocery']));
    expect(result.entities.map((x: any) => x.entityId)).not.toEqual(expect.arrayContaining(['food', 'cafe', 'stay']));
  });
  it('offers a clearly labelled mart fallback only when no convenience store exists', async () => {
    const martOnly = { effectiveDataset: jest.fn(async () => ({ regionId: 'hapcheon', records: [anchor, mart] })) };
    const result: any = await new PlaceDiscoveryService(martOnly as any).discover('hapcheon', 'CONVENIENCE_STORE', '편의점 있어?', {});
    expect(result.entities[0]).toMatchObject({ entityId: 'mart', entityType: 'MART', category: 'MART' });
    expect(result.categoryFallbackNotice).toContain('마트·슈퍼마켓');
  });
  it('keeps search candidates typed, unverified, action-safe, and region-scoped', async () => {
    const noShopping = { effectiveDataset: jest.fn(async () => ({ regionId: 'hapcheon', records: [anchor, ...contamination] })) };
    const nearby = { search: jest.fn(async (_category: string, _lat: number, _lng: number, _radius: number, _options: any, regionId: string) => [
      { id: 'search-mart', name: '검색마트', category: 'MART_SUPERMARKET', lat: 35.561, lng: 128.161, distanceMeters: 150, providerCategoryName: '대형마트', address: '', roadAddress: '', phone: '', placeUrl: '' },
      { id: 'search-food', name: '검색식당', category: 'FOOD', lat: 35.562, lng: 128.162, distanceMeters: 180, providerCategoryName: '음식점', address: '', placeUrl: '' },
    ].map((row) => ({ ...row, regionId }))) };
    const result: any = await new PlaceDiscoveryService(noShopping as any, undefined, nearby as any).discover('hapcheon', 'ESSENTIAL_SHOPPING', '현재 장소 근처 장 볼 데?', {});
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]).toMatchObject({ category: 'MART_SUPERMARKET', regionId: 'hapcheon', actions: {}, operationalEvidence: { source: 'SEARCH', verificationStatus: 'UNVERIFIED', tripEligible: false } });
    expect(nearby.search).toHaveBeenCalledWith('ESSENTIAL_SHOPPING', expect.any(Number), expect.any(Number), 2500, {}, 'hapcheon');
  });
  it('isolates shopping discovery by region', async () => {
    expect((await service.discover('okcheon', 'ESSENTIAL_SHOPPING', '장 볼 데?', {})).entities).toEqual([]);
  });
  it.each([['CU 합천점', 'CONVENIENCE_STORE'], ['OO마트', 'MART_SUPERMARKET'], ['XX슈퍼', 'MART_SUPERMARKET']] as const)('normalizes %s to its real business type', (name, expected) => {
    expect(normalizeNearbyCategory(name)).toBe(expected);
  });
});
