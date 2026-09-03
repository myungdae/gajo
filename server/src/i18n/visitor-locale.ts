import { visitorPlaceName, type ReviewedPlaceContent } from './place-content';
export type VisitorLocale = 'ko' | 'en';

export function normalizeVisitorLocale(value: unknown): VisitorLocale {
  return value === 'en' ? 'en' : 'ko';
}

const ENGLISH_TEMPLATES = new Map<string, string>([
  ['현재 기준 위치를 먼저 확인해 주세요. 위치를 확인한 뒤 실제 주변 장소를 가까운 순서로 찾아드릴게요.', 'Please choose a starting location. We will then show nearby places in distance order.'],
  ['현재 위치를 기준으로 실제 주변 장소를 가까운 순서로 확인했습니다. 영업 여부는 방문 전에 확인해 주세요.', 'These places are sorted by distance from your current location. Check opening information before visiting.'],
  ['1km 안에서 확인된 장소가 없습니다. 3km 또는 5km로 범위를 넓혀 찾아볼 수 있어요.', 'No places were found within 1 km. You can expand the search to 3 km or 5 km.'],
  ['아직 저장한 숙소가 없습니다. 현재 위치 주변의 숙소를 찾아드릴까요?', 'You have not saved accommodation yet. Would you like to find a place to stay nearby?'],
  ['거리 확인을 위해 출발 장소를 알려주세요.', 'Choose a starting point to check the distance.'],
  ['조건에 맞는 검증된 장소를 아직 찾지 못했습니다.', 'No verified places match these conditions yet.'],
  ['요청을 접수했습니다. 조건을 분석했지만 아직 추천할 프로그램을 찾지 못했습니다.', 'We reviewed your request but could not find a suitable recommendation yet.'],
  ['말씀하신 상황에 맞춰 편안한 일정을 준비했습니다.', 'We prepared a comfortable itinerary for your needs.'],
  ['여행을 계속할까요?', 'Would you like to continue your trip?'],
  ['현재 운영 여부 확인 필요', 'Check current opening hours before visiting.'],
  ['예약 가능 여부는 숙소에 직접 확인해 주세요.', 'Contact the accommodation directly to check availability.'],
  ['검증된 지역 대표 장소입니다.', 'A verified local landmark.'],
  ['검증된 지역 관광 데이터입니다.', 'Verified local tourism information.'],
  ['검증된 지역 운영 데이터입니다.', 'Verified local business information.'],
  ['카카오 Local 주변 검색 결과입니다.', 'A nearby result from Kakao Local.'],
  ['가까운 곳', 'Nearby'],
  ['관광지', 'Attractions'], ['음식점', 'Restaurants'], ['카페', 'Cafés'], ['숙소', 'Accommodation'],
  ['영업 중', 'Open'], ['영업 종료', 'Closed'], ['운영 중', 'Open'], ['운영 종료', 'Closed'],
  ['예약 필요', 'Reservation required'], ['정보 없음', 'Information unavailable'],
  ['지금 갈 수 있는 곳을 다시 찾아볼게요.', 'We will look again for places you can visit now.'],
  ['비 오는 날씨에 적합한 실내 활동', 'Indoor activity suitable for rainy weather'],
  ['짧은 보행 거리', 'Short walking distance'],
  ['요청한 장소명과 정확히 일치', 'Exact match for the requested place name'],
  ['합천호 관련 맥락', 'Related to 합천호'],
  ['휴식 맥락', 'Suitable for a rest'],
  ['요청한 장소 유형', 'Matches the requested place type'],
  ['가까운 편의점 결과가 부족해 주변 마트·슈퍼마켓도 함께 보여드렸습니다.', 'There are few nearby convenience stores, so supermarkets are included.'],
  ['현재 이 지역은 승인된 Core Destination 후보 데이터가 충분하지 않습니다. 임의로 대표 명소를 만들지 않고 지역 정보 검토가 끝난 뒤 안내할게요.', 'There are not enough approved core destinations for this area yet. We will show them after regional review.'],
]);

const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^(.+) 기준 (\d+)m$/u, m => `${m[2]} m from ${m[1] === '현재 위치' ? 'your current location' : m[1]}`],
  [/^(.+) 근거를 고려해 (.+)을\(를\) 우선 추천합니다\.$/u, m => `We recommend ${m[2]} first. Reasons: ${m[1].split(', ').map(reason=>localizeVisitorText(reason,'en')).join(', ')}.`],
  [/^현재 위치에서 약 (.+)로 가까움$/u, m => `Nearby: about ${m[1]} from your current location`],
  [/^(.+) 완화$/u, m => `Helps with ${m[1]}`],
  [/^(.+)를 함께 둘러보시려는군요\.$/u, m => `You would like to visit ${m[1].split('과 ').join(' and ')} together.`],
  [/^(.+) 안에서 이동 순서를 살펴봤어요\.$/u, m => `We reviewed the visit order for ${m[1].split('과 ').join(' and ')}.`],
  [/^(.+)은 그대로 유지할게요\. 일부 장소의 정확한 위치가 아직 확인되지 않아 거리순 계산은 어렵습니다\. 우선 말씀하신 순서대로 둘까요\?$/u, m => `We will keep ${m[1].split('과 ').join(' and ')}. Some coordinates are unverified, so we cannot sort by distance yet. Keep your requested order?`],
  [/^(\d+)~(\d+)km 떨어진 곳$/u, (m) => `${m[1]}–${m[2]} km away`],
  [/^카카오 Local 분류: (.+)$/u, (m) => `Kakao Local category: ${m[1]}`],
  [/^검색 분류 근거: (.+)$/u, (m) => `Search category: ${m[1]}`],
  [/^(\d+)단계: (.+)$/u, (m) => `Stop ${m[1]}: ${m[2]}`],
  [/^(.+)으로 돌아갈까요\?$/u, (m) => `Would you like to return to ${m[1]}?`],
  [/^(.+)에서 (.+)까지 직선거리로 약 (\d+)m입니다\.$/u, (m) => `The straight-line distance from ${m[1]} to ${m[2]} is about ${m[3]} m.`],
];

export function localizeVisitorText(value: string, locale: VisitorLocale): string {
  if (locale === 'ko') return value;
  const exact = ENGLISH_TEMPLATES.get(value);
  if (exact) return exact;
  for (const [pattern, replace] of patterns) {
    const match = value.match(pattern);
    if (match) return replace(match);
  }
  return value;
}

export function localizeVisitorPayload<T>(value: T, locale: VisitorLocale): T {
  if (locale === 'ko' || value == null) return value;
  if (typeof value === 'string') return localizeVisitorText(value, locale) as T;
  if (Array.isArray(value)) return value.map((item) => localizeVisitorPayload(item, locale)) as T;
  if (typeof value === 'object') {
    if (value instanceof Date) return value;
    if ('toObject' in value && typeof value.toObject === 'function') return localizeVisitorPayload(value.toObject(), locale) as T;
    const source = value as Record<string, unknown>;
    // Never translate identity, addresses, user input, or machine-readable values.
    const protectedFields = new Set(['name', 'canonicalLabel', 'canonicalLabelKo', 'address', 'roadAddress', 'rawMessage', 'input', 'entityUri', 'entityId', 'uri', 'id', 'regionId', 'visitorContent']);
    const result = Object.fromEntries(Object.entries(source).map(([key, item]) => [key, protectedFields.has(key) ? item : localizeVisitorPayload(item, locale)]));
    if (typeof source.name === 'string' && source.visitorContent) result.name = visitorPlaceName(source.name, source.visitorContent as ReviewedPlaceContent);
    if (source.visitorContent) {
      const content = source.visitorContent as ReviewedPlaceContent;
      for (const key of ['programLabel','facilityLabel','label']) {
        if (typeof source[key] === 'string') result[key] = visitorPlaceName(source[key],content);
      }
      if (content.en?.description) result.description = content.en.description;
      if (content.en?.category) result.categoryLabel = content.en.category;
    }
    // Render the existing proposal from structured facts; leave stored Korean text intact.
    if (source.explanation && source.triggerEvent && Array.isArray(source.removedItems) && Array.isArray(source.proposedNewItems)) {
      const event = source.triggerEvent as {eventType?:string;currentValue?:unknown};
      const labels = (items: unknown[]) => items.map(item => {
        const step = item as Record<string, unknown>;
        return step.programLabel || step.facilityLabel || step.label || 'Planned stop';
      }).join(', ');
      const changes: Record<string,string> = {
        HEAVY_RAIN: `Heavy rain (${event.currentValue} mm) was observed.`,
        WEATHER_CHANGED: 'The weather is no longer suitable for outdoor activities.',
        FACILITY_UNAVAILABLE: 'A planned facility is currently unavailable.',
        RESERVATION_UNAVAILABLE: 'A required reservation is unavailable.',
      };
      result.explanation = `${changes[event.eventType || ''] || 'Current conditions have changed.'} Affected stops: ${labels(source.removedItems) || 'Planned activities'}. Suggested alternatives: ${labels(source.proposedNewItems) || 'No confirmed alternative yet'}. Would you like to update your itinerary?`;
    }
    return result as T;
  }
  return value;
}
