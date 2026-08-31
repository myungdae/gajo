import { HAPCHEON_REGION_CONFIG } from '../region/region-config.service';
import { allowedNearbyRadii, nearbyRadiusPolicy, nextNearbyRadius } from './nearby-radius.policy';

describe('nearby radius policy', () => {
  it('uses wider staged searches for lodging and tourism', () => {
    expect(nearbyRadiusPolicy('LODGING_CAMPING_GLAMPING').steps).toEqual([
      1000, 3000, 5000, 10000,
    ]);
    expect(nearbyRadiusPolicy('TOURISM_NATURE').automaticMaxRadius).toBe(10000);
  });
  it('keeps immediate needs closer and supports canonical region overrides', () => {
    expect(nearbyRadiusPolicy('FOOD').automaticMaxRadius).toBe(3000);
    expect(nearbyRadiusPolicy('CAFE').automaticMaxRadius).toBe(5000);
    expect(
      nearbyRadiusPolicy('LODGING', {
        ...HAPCHEON_REGION_CONFIG,
        nearbySearch: {
          categoryOverrides: { LODGING: { minimumCandidates: 7 } },
        },
      }).minimumCandidates,
    ).toBe(7);
  });
  it('uses the same category maximum for automatic and manual radius progression', () => {
    const food = nearbyRadiusPolicy('FOOD'),
      cafe = nearbyRadiusPolicy('CAFE'),
      lodging = nearbyRadiusPolicy('LODGING');
    expect(allowedNearbyRadii(food)).toEqual([1000, 3000]);
    expect(nextNearbyRadius(food, 1000)).toBe(3000);
    expect(nextNearbyRadius(food, 3000)).toBeUndefined();
    expect(nextNearbyRadius(cafe, 3000)).toBe(5000);
    expect(nextNearbyRadius(cafe, 5000)).toBeUndefined();
    expect(nextNearbyRadius(lodging, 5000)).toBe(10000);
    expect(nextNearbyRadius(lodging, 10000)).toBeUndefined();
  });
});
