import type { NearbyCategory } from './nearby.service';
import type { RegionConfig } from '../region/region-config.service';

export const NEARBY_RADIUS_STEPS = [1000, 3000, 5000, 10000] as const;
export type NearbyRadius = (typeof NEARBY_RADIUS_STEPS)[number];

export interface NearbyRadiusPolicy {
  steps: readonly NearbyRadius[];
  automaticMaxRadius: NearbyRadius;
  minimumCandidates: number;
  nearRadius: NearbyRadius;
}

export function allowedNearbyRadii(policy: NearbyRadiusPolicy) {
  return policy.steps.filter(
    (radius) => radius <= policy.automaticMaxRadius,
  );
}
export function nextNearbyRadius(
  policy: NearbyRadiusPolicy,
  current: NearbyRadius,
) {
  return allowedNearbyRadii(policy).find((radius) => radius > current);
}

const LODGING = /^LODGING/;
const TOURISM =
  /^(TOURIST_ATTRACTION|NATURE|CULTURE_ART|EXPERIENCE|FESTIVAL_EXHIBITION|ACTIVITY|TOURISM_NATURE)$/;
const CAFE = /^CAFE/;
const IMMEDIATE =
  /^(FOOD|CONVENIENCE|ESSENTIAL_SHOPPING|CONVENIENCE_STORE|MART_SUPERMARKET|PHARMACY|HOSPITAL|MEDICAL)$/;

export function nearbyRadiusPolicy(
  category: NearbyCategory,
  region?: RegionConfig,
): NearbyRadiusPolicy {
  const base: NearbyRadiusPolicy = LODGING.test(category)
    ? {
        steps: NEARBY_RADIUS_STEPS,
        automaticMaxRadius: 10000,
        minimumCandidates: 5,
        nearRadius: 1000,
      }
    : TOURISM.test(category)
      ? {
          steps: NEARBY_RADIUS_STEPS,
          automaticMaxRadius: 10000,
          minimumCandidates: 5,
          nearRadius: 1000,
        }
      : CAFE.test(category)
        ? {
            steps: [1000, 3000, 5000],
            automaticMaxRadius: 5000,
            minimumCandidates: 5,
            nearRadius: 1000,
          }
        : IMMEDIATE.test(category)
          ? {
              steps: [1000, 3000, 5000],
              automaticMaxRadius: 3000,
              minimumCandidates: 5,
              nearRadius: 1000,
            }
          : {
              steps: [1000, 3000, 5000],
              automaticMaxRadius: 3000,
              minimumCandidates: 5,
              nearRadius: 1000,
            };
  const override = region?.nearbySearch?.categoryOverrides?.[category];
  return override ? { ...base, ...override } : base;
}
