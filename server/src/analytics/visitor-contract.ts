import { BadRequestException } from '@nestjs/common';

export const VISITOR_REGIONS = [
  'gajo',
  'okcheon',
  'muan',
  'gyeryong',
  'hapcheon',
  'daejeon-junggu',
];
export const VISITOR_EVENTS = [
  'PLACE_RECOMMENDATION_SHOWN',
  'WEBSITE_OUTBOUND_DISPATCHED',
  'NAVER_PLACE_OUTBOUND_DISPATCHED',
  'KAKAO_PLACE_OUTBOUND_DISPATCHED',
  'BOOKING_CLICKED',
  'BOOKING_OUTBOUND_DISPATCHED',
  'PAGE_VIEWED',
  'REGION_HOME_VIEWED',
  'NEARBY_SEARCH_SUBMITTED',
  'SEARCH_RESULTS_SHOWN',
  'PLACE_DETAIL_OPENED',
  'PHONE_CLICKED',
  'DIRECTIONS_CLICKED',
  'ITINERARY_SAVE_SUCCEEDED',
  'RUNTIME_JOURNEY_REQUESTED',
  'RUNTIME_JOURNEY_PRESENTED',
  'RUNTIME_JOURNEY_STARTED',
  'RUNTIME_JOURNEY_ADJUSTMENT_OPENED',
  'RUNTIME_JOURNEY_REPLAN_REQUESTED',
] as const;
export const TRAFFIC_CLASSES = [
  'VERIFIED_ONSITE',
  'ATTRIBUTED_ENTRY',
  'GENERAL_VISIT',
  'INTERNAL_TEST',
  'AUTOMATED_CHECK',
  'UNKNOWN',
] as const;
export type TrafficClass = (typeof TRAFFIC_CLASSES)[number];
export const SCREENS = [
  'HOME',
  'NEARBY',
  'CONCIERGE',
  'MY_TRIP',
  'MAP',
  'PARTNER_ENTRY',
  'UNKNOWN',
];
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface VisitorEventDto {
  schemaVersion: 2;
  eventId: string;
  eventType: (typeof VISITOR_EVENTS)[number];
  regionId: string;
  anonymousTripId: string;
  visitSessionId: string;
  pageViewId: string;
  screen: string;
  uiLocale: 'ko' | 'en' | 'unknown';
  occurredAt: string;
  searchId?: string;
  resultSetId?: string;
  actionId?: string;
  placeKey?: string;
  placeProof?: string;
  resultCount?: number;
  entryId?: string;
  provider?: string;
  channelId?: string;
}
const keys = new Set([
  'channelId',
  'schemaVersion',
  'eventId',
  'eventType',
  'regionId',
  'anonymousTripId',
  'visitSessionId',
  'pageViewId',
  'screen',
  'uiLocale',
  'occurredAt',
  'searchId',
  'resultSetId',
  'actionId',
  'placeKey',
  'placeProof',
  'resultCount',
  'entryId',
  'provider',
]);
export function validateVisitorEvent(
  value: unknown,
  now = new Date(),
): VisitorEventDto {
  const fail = () => {
    throw new BadRequestException('Invalid analytics v2 event');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail();
  const v = value as VisitorEventDto;
  if (
    Object.keys(v).some((k) => !keys.has(k)) ||
    v.schemaVersion !== 2 ||
    !VISITOR_EVENTS.includes(v.eventType) ||
    !VISITOR_REGIONS.includes(v.regionId) ||
    !SCREENS.includes(v.screen) ||
    !['ko', 'en', 'unknown'].includes(v.uiLocale)
  )
    return fail();
  for (const k of [
    'eventId',
    'anonymousTripId',
    'visitSessionId',
    'pageViewId',
  ] as const)
    if (!UUID.test(v[k])) return fail();
  for (const k of ['searchId', 'resultSetId', 'actionId'] as const)
    if (v[k] !== undefined && !UUID.test(v[k]!)) return fail();
  if (
    typeof v.occurredAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.occurredAt) ||
    !Number.isFinite(Date.parse(v.occurredAt)) ||
    Math.abs(now.getTime() - Date.parse(v.occurredAt)) > 86400000
  )
    return fail();
  if (
    v.placeKey !== undefined &&
    (typeof v.placeKey !== 'string' ||
      v.placeKey.length > 240 ||
      !v.placeKey.length)
  )
    return fail();
  if (
    v.placeProof !== undefined &&
    (typeof v.placeProof !== 'string' || v.placeProof.length > 1500)
  )
    return fail();
  if (
    v.entryId !== undefined &&
    (typeof v.entryId !== 'string' ||
      !/^(regional-qr:[a-z-]+|partner:[a-z0-9-]+)$/.test(v.entryId) ||
      v.entryId.length > 160)
  )
    return fail();
  if (
    v.provider !== undefined &&
    !['naver', 'kakao', 'tmap'].includes(v.provider)
  )
    return fail();
  if (
    v.resultCount !== undefined &&
    (!Number.isInteger(v.resultCount) ||
      v.resultCount < 0 ||
      v.resultCount > 1000)
  )
    return fail();
  if (
    ['NEARBY_SEARCH_SUBMITTED', 'SEARCH_RESULTS_SHOWN'].includes(v.eventType) &&
    !v.searchId
  )
    return fail();
  if (
    v.eventType === 'SEARCH_RESULTS_SHOWN' &&
    (!v.resultSetId || v.resultCount === undefined)
  )
    return fail();
  if (
    ['PLACE_DETAIL_OPENED', 'PHONE_CLICKED', 'DIRECTIONS_CLICKED'].includes(
      v.eventType,
    ) &&
    !v.placeKey
  )
    return fail();
  if (
    [
      'PHONE_CLICKED',
      'DIRECTIONS_CLICKED',
      'ITINERARY_SAVE_SUCCEEDED',
      'RUNTIME_JOURNEY_STARTED',
      'RUNTIME_JOURNEY_ADJUSTMENT_OPENED',
      'RUNTIME_JOURNEY_REPLAN_REQUESTED',
    ].includes(v.eventType) &&
    !v.actionId
  )
    return fail();
  if (v.eventType.startsWith('BOOKING_') && (!v.placeKey || !v.actionId || !UUID.test(v.channelId || ''))) return fail();
  if (v.channelId !== undefined && !UUID.test(v.channelId)) return fail();
  if ((v.eventType.endsWith('_OUTBOUND_DISPATCHED') || v.eventType === 'PLACE_RECOMMENDATION_SHOWN') && !v.placeKey) return fail();
  if (v.eventType.endsWith('_OUTBOUND_DISPATCHED') && (!v.actionId || !UUID.test(v.channelId || ''))) return fail();
  if (v.channelId !== undefined && !v.eventType.startsWith('BOOKING_') && !v.eventType.endsWith('_OUTBOUND_DISPATCHED') && v.eventType !== 'PHONE_CLICKED') return fail();
  return v;
}
