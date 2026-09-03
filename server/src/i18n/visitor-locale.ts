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
]);

const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
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
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, localizeVisitorPayload(item, locale)])) as T;
  }
  return value;
}
