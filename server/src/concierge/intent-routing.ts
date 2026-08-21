export type IntentRoute =
  | 'JOURNEY_PLAN'
  | 'PLACE_DISCOVERY'
  | 'DISTANCE_INFO'
  | 'IMMEDIATE_NOW'
  | 'REPLAN';
export type DiscoveryCategory =
  | 'FOOD'
  | 'CAFE'
  | 'LODGING'
  | 'HOT_SPRING_WELLNESS'
  | 'ACTIVITY'
  | 'TOURISM_NATURE'
  | 'CONVENIENCE'
  | 'ESSENTIAL_SHOPPING'
  | 'CONVENIENCE_STORE'
  | 'MART_SUPERMARKET';
export function explicitDestinationPhrases(message = ''): string[] {
  const desire=/(?:가고|갈래|둘러보고|보고)\s*싶|갈래|둘\s*다\s*(?:가|보)/;
  if(!desire.test(message))return[];
  const prefix=message.split(/(?:가고|갈래|둘러보고|보고)\s*싶|갈래/)[0]
    .replace(/둘\s*다\s*$/,'').trim();
  const parts=prefix.split(/\s*(?:하고|이랑|랑|와|과|,)\s*/)
    .map(value=>value.replace(/(?:을|를|에|도)\s*$/,'').trim()).filter(Boolean);
  if(parts.length>=2)return parts;
  const sequence=message.match(/^\s*(.+?)\s*(?:에\s*)?갔다가\s*(.+?)\s*(?:에\s*)?갈래/);
  return sequence?[sequence[1].trim(),sequence[2].trim()]:[];
}
const CATEGORY_PATTERNS: [DiscoveryCategory, RegExp][] = [
  [
    'LODGING',
    /숙박|숙소|호텔|모텔|펜션|민박|한옥|리조트|글램핑|캠핑|야영|오토\s*캠핑|카라반|자연\s*휴양림/,
  ],
  ['CAFE', /카페|커피(?:\s*한\s*잔)?|다방|차\s*(?:한\s*잔|마실)/],
  ['HOT_SPRING_WELLNESS', /온천|사우나|찜질(?:방)?|스파|목욕(?:탕|시설)?/],
  ['ACTIVITY', /놀거리|체험|레저|실내\s*체험/],
  [
    'TOURISM_NATURE',
    /산책|관광|공원|명소|볼\s*만한|갈\s*곳|다\s*봤|이제\s*어디/,
  ],
  ['CONVENIENCE_STORE', /(?:24\s*시간\s*)?편의점/],
  ['MART_SUPERMARKET', /마트|슈퍼마켓|슈퍼(?!맨)|식료품점|동네\s*가게/],
  ['ESSENTIAL_SHOPPING', /장\s*볼\s*(?:곳|데)|생필품|물(?:하고|이랑|과)?\s*과자|과자(?:하고|이랑|과)?\s*물|음료수?\s*살|먹을\s*것\s*(?:좀\s*)?살|간단(?:히|하게)?\s*(?:뭐|무엇을)?\s*살\s*(?:곳|데)/],
  ['CONVENIENCE', /약국|병원/],
  [
    'FOOD',
    /식당|맛집|밥집|배고|밥\s*(?:먹|을)|먹을\s*(?:곳|데)|저녁\s*먹|점심\s*먹|음식점|식사/,
  ],
];
export function discoveryCategory(message = '') {
  if (/숙박|자고\s*싶|묵고\s*싶|체크인/.test(message)) return 'LODGING';
  return CATEGORY_PATTERNS.map(([category, pattern]) => ({
    category,
    index: message.search(pattern),
  }))
    .filter((x) => x.index >= 0)
    .sort((a, b) => b.index - a.index)[0]?.category;
}
export function routeNaturalLanguageIntent(input: {
  rawMessage?: string;
  inputMode?: string;
  isFollowup?: boolean;
  discoveryCategoryHint?: DiscoveryCategory;
}) {
  const message = input.rawMessage?.trim() || '',
    explicitCategory = discoveryCategory(message),
    alternative =
      /다른\s*(?:곳|데)|더\s*가까운\s*(?:곳|데)|첫\s*번째\s*말고|그럼\s*두\s*번째/.test(
        message,
      ),
    category =
      explicitCategory ||
      (input.isFollowup && alternative
        ? input.discoveryCategoryHint
        : undefined),
    nearbyRelation = /주변|근처|가까|인근/.test(message),
    categoryOverride = Boolean(
      explicitCategory &&
      (/아니|만\s*(?:보여|찾아)/.test(message) || /(?:은|는)\??$/.test(message)),
    ),
    relationalReference =
      /거기|그곳|그중|그\s*(?:근처|주변|카페|식당|숙소)/.test(message) &&
      /주변|근처|가까|거기서|그중/.test(message);
  const explicitDestinations=explicitDestinationPhrases(message);
  if(explicitDestinations.length>=2)
    return{intentRoute:'JOURNEY_PLAN' as const,category:undefined,multiDestination:true,explicitDestinations};
  if (
    input.isFollowup &&
    /거긴?\s*멀|얼마나\s*멀|거리(?:는|가|를)?/.test(message)
  )
    return { intentRoute: 'DISTANCE_INFO' as const, category };
  if (
    input.isFollowup &&
    category &&
    (!explicitCategory ||
      relationalReference ||
      nearbyRelation ||
      categoryOverride)
  )
    return {
      intentRoute: 'PLACE_DISCOVERY' as const,
      category,
      ...(alternative
        ? {
            alternative: true,
            preferCloser: /더\s*가까운/.test(message),
            selectionIndex: /두\s*번째/.test(message) ? 1 : undefined,
          }
        : {}),
    };
  if (input.isFollowup) return { intentRoute: 'REPLAN' as const, category };
  if (input.inputMode !== 'FREE_TEXT' || !message)
    return { intentRoute: 'JOURNEY_PLAN' as const, category };
  if (
    /지금|현재\s*위치|내\s*주변|오늘\s*(?:저녁|점심|아침|갈|먹)/.test(message)
  )
    return { intentRoute: 'IMMEDIATE_NOW' as const, category };
  const journey =
    /\d+박\s*\d+일|당일\s*여행|(?:하루|내일).{0,8}(?:일정|코스)|일정\s*(?:짜|만들|추천)|여행\s*(?:짜|계획)|코스\s*(?:짜|만들)|(?:보고|갔다가|들렀다가|먹고).{0,30}(?:보고|갔다가|들렀다가|먹고|펜션|숙소)/.test(
      message,
    );
  if (journey) return { intentRoute: 'JOURNEY_PLAN' as const, category };
  if (
    category &&
    /주변|근처|가까운|인근|알려|찾아|보여|추천|어디|있어|아니|먹을\s*(?:곳|데)|살\s*(?:곳|데)|장\s*볼|가고\s*싶|(?:숙박|목욕|자고|묵고).{0,6}싶|가기\s*좋|편한|갈\s*만한|(?:아이와|부모님과)?\s*갈\s+(?:실내\s*)?(?:체험|카페|식당)/.test(
      message,
    )
  )
    return { intentRoute: 'PLACE_DISCOVERY' as const, category };
  return { intentRoute: 'JOURNEY_PLAN' as const, category };
}
