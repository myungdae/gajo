import type {
  DecisionCandidate,
  DecisionContext,
} from './decision-pipeline.service';

export const ITINERARY_ROLES = [
  'ANCHOR',
  'ATTRACTION',
  'ACTIVITY',
  'MEAL',
  'CAFE_BREAK',
  'REST',
  'ACCOMMODATION',
  'TRANSIT',
  'EVENT',
] as const;
export const INTEREST_ANALYTICS_EVENTS = [
  'INTEREST_REQUESTED',
  'INTEREST_COVERED',
  'INTEREST_UNCOVERED',
] as const;
export type ItineraryRole = (typeof ITINERARY_ROLES)[number];
export interface CompositionContext extends DecisionContext {
  duration?: string;
  rawMessage?: string;
  selectedInterests?: string[];
}
export interface InterestCoverage {
  selected: string[];
  covered: string[];
  uncovered: string[];
}

const ROLE_BY_INTEREST: Record<string, ItineraryRole[]> = {
  FOOD: ['MEAL'],
  CAFE: ['CAFE_BREAK'],
  ACCOMMODATION: ['ACCOMMODATION'],
  REST: ['REST', 'CAFE_BREAK', 'ACCOMMODATION'],
  REST_AND_RECOVERY: ['REST', 'CAFE_BREAK', 'ACCOMMODATION'],
  ACTIVITY: ['ACTIVITY'],
  FESTIVAL_EVENT: ['EVENT'],
  HAPCHEON_LAKE: ['ANCHOR', 'ATTRACTION'],
  LAKE: ['ANCHOR', 'ATTRACTION'],
  TOURISM_NATURE: ['ATTRACTION', 'ACTIVITY'],
  NATURE: ['ATTRACTION', 'ACTIVITY'],
};
export function itineraryRole(candidate: DecisionCandidate): ItineraryRole {
  if (candidate.isMustVisit) return 'ANCHOR';
  const semantic =
    `${candidate.entityType || ''} ${candidate.category || ''}`.toUpperCase();
  if (/ACCOMMODATION|PENSION|HOTEL|LODGING/.test(semantic))
    return 'ACCOMMODATION';
  if (/RESTAURANT|FOOD|MEAL/.test(semantic) || candidate.isMeal) return 'MEAL';
  if (/CAFE/.test(semantic)) return 'CAFE_BREAK';
  if (/EVENT|FESTIVAL/.test(semantic)) return 'EVENT';
  if (/EXPERIENCE|ACTIVITY/.test(semantic)) return 'ACTIVITY';
  if (/REST/.test(semantic)) return 'REST';
  if (/TRANSIT|TRANSPORT/.test(semantic)) return 'TRANSIT';
  return 'ATTRACTION';
}
const accommodationFirst = (text = '') =>
  /(?:숙소|펜션|체크인).{0,12}(?:먼저|부터)|(?:먼저|우선).{0,12}(?:숙소|펜션|체크인)|(?:숙소|펜션)(?:로|에)\s*(?:먼저\s*)?(?:가|들어)/.test(
    text,
  );
const morningCafe = (text = '') =>
  /아침|오전/.test(text) && /카페|커피/.test(text);
const dinner = (text = '') => /저녁|저녁식사|디너/.test(text);
function rolePriority(
  candidate: DecisionCandidate,
  context: CompositionContext,
) {
  const role = itineraryRole(candidate);
  if (accommodationFirst(context.rawMessage) && role === 'ACCOMMODATION')
    return -100;
  if (candidate.scheduledTime) return -20;
  if (morningCafe(context.rawMessage) && role === 'CAFE_BREAK') return -10;
  if (dinner(context.rawMessage) && role === 'MEAL') return 70;
  return {
    ANCHOR: 0,
    ATTRACTION: 10,
    ACTIVITY: 20,
    MEAL: 30,
    CAFE_BREAK: 40,
    REST: 45,
    EVENT: 15,
    TRANSIT: 50,
    ACCOMMODATION: 90,
  }[role];
}
function distance(a?: DecisionCandidate, b?: DecisionCandidate) {
  if (!a?.coordinates || !b?.coordinates) return Number.MAX_SAFE_INTEGER;
  const rad = (x: number) => (x * Math.PI) / 180,
    dLat = rad(b.coordinates.latitude - a.coordinates.latitude),
    dLon = rad(b.coordinates.longitude - a.coordinates.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.coordinates.latitude)) *
      Math.cos(rad(b.coordinates.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function composeItinerary(
  ranked: DecisionCandidate[],
  context: CompositionContext,
) {
  const selected = [...new Set(context.selectedInterests || [])];
  const requestedRoles = [
    ...new Set(
      selected.flatMap((interest) => ROLE_BY_INTEREST[interest] || []),
    ),
  ];
  const chosen: DecisionCandidate[] = [];
  const add = (candidate?: DecisionCandidate) => {
    if (
      candidate &&
      !chosen.some((item) => item.programUri === candidate.programUri)
    )
      chosen.push(candidate);
  };
  const covers = (interest: string) =>
    chosen.some(
      (candidate) =>
        (candidate.tags || []).includes(interest) ||
        (ROLE_BY_INTEREST[interest] || []).includes(itineraryRole(candidate)),
    );
  ranked.filter((candidate) => candidate.isMustVisit).forEach(add);
  for (const interest of selected) {
    if (covers(interest)) continue;
    for (const role of ROLE_BY_INTEREST[interest] || []) {
      const match = ranked.find(
        (candidate) => itineraryRole(candidate) === role,
      );
      if (match) {
        add(match);
        break;
      }
    }
  }
  const overnight =
    /N|박|OVERNIGHT/i.test(context.duration || '') ||
    requestedRoles.includes('ACCOMMODATION');
  const limit = overnight && requestedRoles.length >= 4 ? 5 : 4;
  for (const candidate of ranked.filter(
    (candidate) => !chosen.some((item) => itineraryRole(item) === itineraryRole(candidate)),
  )) {
    if (chosen.length >= limit) break;
    add(candidate);
  }
  for (const candidate of ranked) {
    if (chosen.length >= limit) break;
    add(candidate);
  }
  const remaining = chosen.slice(0, limit),
    ordered: DecisionCandidate[] = [];
  while (remaining.length) {
    remaining.sort(
      (a, b) =>
        rolePriority(a, context) - rolePriority(b, context) ||
        distance(ordered.at(-1), a) - distance(ordered.at(-1), b) ||
        (b.score || 0) - (a.score || 0) ||
        a.programUri.localeCompare(b.programUri),
    );
    ordered.push(remaining.shift()!);
  }
  const covered = selected.filter((interest) => {
    const roles = ROLE_BY_INTEREST[interest] || [];
    return ordered.some(
      (candidate) =>
        (candidate.tags || []).includes(interest) ||
        roles.includes(itineraryRole(candidate)),
    );
  });
  return {
    items: ordered.map((candidate) => ({
      ...candidate,
      itineraryRole: itineraryRole(candidate),
    })),
    coverage: {
      selected,
      covered,
      uncovered: selected.filter((interest) => !covered.includes(interest)),
    },
  };
}
