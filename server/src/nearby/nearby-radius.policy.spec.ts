import { HAPCHEON_REGION_CONFIG } from '../region/region-config.service';
import { nearbyRadiusPolicy } from './nearby-radius.policy';

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
});
