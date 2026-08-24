import type { RegionalCandidateRecord } from '../regional-candidate.registry';
import { OKCHEON_PHASE2_ESSENTIAL_SERVICES } from '../essential-services-phase2';

const NS = 'https://okcheon.example/ontology#',
  verifiedAt = '2026-08-22';
const county = (url: string) => ({
  sourceType: 'OFFICIAL_LOCAL_GOV',
  sourceName: '옥천군 문화관광',
  sourceUrl: url,
  verifiedAt,
});
type Input = Omit<
  RegionalCandidateRecord,
  'runtimeDataStatus' | 'actions' | 'source' | 'lastVerifiedAt'
> & {
  sourceUrl: string;
  runtimeDataStatus?: RegionalCandidateRecord['runtimeDataStatus'];
};
const record = (v: Input): RegionalCandidateRecord => {
  const actions: Record<string, unknown> = { detail: { url: v.sourceUrl } };
  if (v.telephone) actions.call = { phone: v.telephone };
  if (v.website) actions.website = { url: v.website };
  if (Number.isFinite(v.latitude) && Number.isFinite(v.longitude))
    actions.navigate = { latitude: v.latitude, longitude: v.longitude };
  const { sourceUrl, ...facts } = v;
  return {
    ...facts,
    runtimeDataStatus: v.runtimeDataStatus || 'PARTIAL',
    actions,
    source: county(sourceUrl),
    lastVerifiedAt: verifiedAt,
  };
};
const scenic = (key: number) =>
  `https://www.oc.go.kr/tour/contents.do?key=${key}`;
const attraction = (
  id: string,
  name: string,
  key: number,
  extra: Partial<Input> = {},
): RegionalCandidateRecord =>
  record({
    entityUri: `${NS}${id}`,
    canonicalLabelKo: name,
    alternateLabels: [],
    entityType: 'ATTRACTION',
    category: 'TOURISM_NATURE',
    tags: ['TOURISM_NATURE'],
    description: `옥천군이 옥천 9경으로 소개하는 ${name}입니다.`,
    sourceUrl: scenic(key),
    ...extra,
  });
const foodSource = 'https://www.oc.go.kr/tour/contents.do?key=4087',
  residentSource = 'https://www.oc.go.kr/tour/contents.do?key=4257',
  lodgingSource = 'https://oc.go.kr/tour/contents.do?key=4004';

export const OKCHEON_MASTER_DATA: readonly RegionalCandidateRecord[] = [
  attraction('dunjubongKoreanPeninsula', '둔주봉 한반도지형', 3830, {
    alternateLabels: ['둔주봉 한반도 지형', '둔주봉'],
    address: '충청북도 옥천군 안남면 연주길 46',
    latitude: 36.35619308,
    longitude: 127.6727267,
    tags: ['TOURISM_NATURE', 'SCENIC_VIEW', 'HIKING'],
    sourceUrl:
      'https://www.oc.go.kr/tour/viewTnTursmResrceU.do?key=2510&resrceNo=5',
  }),
  attraction('oldRoute37CherryRoad', '옛 37번 국도변 벚꽃길', 3831, {
    alternateLabels: ['구 37번 국도 벚꽃길'],
    tags: ['TOURISM_NATURE', 'SCENIC_DRIVE', 'SEASONAL'],
  }),
  attraction('busodamak', '부소담악', 3832, {
    alternateLabels: ['옥천 부소담악'],
    address: '충청북도 옥천군 군북면 환산로 518',
    tags: ['TOURISM_NATURE', 'LAKE', 'SCENIC_VIEW'],
  }),
  attraction('yongamsaSunrise', '용암사 일출', 3833, {
    alternateLabels: ['용암사'],
    category: 'TOURISM_CULTURE',
    tags: ['TOURISM_NATURE', 'CULTURE'],
  }),
  record({
    entityUri: `${NS}jangnyeongsanForest`,
    canonicalLabelKo: '장령산자연휴양림',
    alternateLabels: ['장령산 자연휴양림', '장령산휴양림'],
    entityType: 'ACCOMMODATION',
    accommodationType: 'FOREST_LODGE',
    category: 'ACCOMMODATION',
    tags: ['TOURISM_NATURE', 'ACTIVITY', 'REST', 'ACCOMMODATION'],
    address: '충청북도 옥천군 군서면 장령산로 519',
    telephone: '043-733-9615',
    website: 'https://www.foresttrip.go.kr/',
    description: '옥천 5경이자 숙박·야영 시설을 갖춘 자연휴양림입니다.',
    sourceUrl: scenic(3834),
  }),
  attraction('janggyeTourismArea', '장계관광지', 3835, {
    address: '충청북도 옥천군 안내면 장계1길 57',
    telephone: '043-730-3418',
    tags: ['TOURISM_NATURE', 'LAKE', 'CULTURE'],
  }),
  attraction('geumgangRecreationArea', '금강유원지', 3836, {
    address: '충청북도 옥천군 동이면 금강로 596',
    tags: ['TOURISM_NATURE', 'RIVER', 'REST'],
  }),
  attraction('hyangsuLakeTrail', '향수호수길', 3837, {
    tags: ['TOURISM_NATURE', 'LAKE', 'WALKING'],
  }),
  record({
    entityUri: `${NS}oldTownArea`,
    canonicalLabelKo: '옥천구읍',
    alternateLabels: ['옥천 구읍', '옥천 구읍 일대', '구읍 일대'],
    entityType: 'AREA',
    category: 'PLACE_CONCEPT',
    tags: ['LITERATURE_CULTURE', 'TRADITIONAL_CULTURE', 'WALKING'],
    description:
      '정지용 문학과 근대문화 장소들이 모인 옥천 9경의 역사문화 권역입니다.',
    sourceUrl: scenic(3838),
  }),

  record({
    entityUri: `${NS}jeongJiyongBirthplace`,
    canonicalLabelKo: '정지용 생가',
    alternateLabels: ['정지용생가'],
    entityType: 'ATTRACTION',
    category: 'LITERATURE_CULTURE',
    tags: ['LITERATURE_CULTURE'],
    address: '충청북도 옥천군 옥천읍 향수길 5',
    description: '시인 정지용의 생가로 보존된 구읍 문화 장소입니다.',
    sourceUrl: 'https://etc.oc.go.kr/tour/contents.do?key=2720',
  }),
  record({
    entityUri: `${NS}jeongJiyongLiteratureMuseum`,
    canonicalLabelKo: '정지용문학관',
    alternateLabels: ['정지용 문학관'],
    entityType: 'ATTRACTION',
    category: 'LITERATURE_CULTURE',
    tags: ['LITERATURE_CULTURE', 'INDOOR'],
    address: '충청북도 옥천군 옥천읍 향수길 56',
    description: '정지용의 생애와 문학을 소개하는 문화공간입니다.',
    sourceUrl: 'https://etc.oc.go.kr/tour/contents.do?key=2720',
  }),
  record({
    entityUri: `${NS}yukYoungsooBirthplace`,
    canonicalLabelKo: '육영수 생가',
    alternateLabels: ['육영수생가'],
    entityType: 'ATTRACTION',
    category: 'LITERATURE_CULTURE',
    tags: ['LITERATURE_CULTURE', 'TRADITIONAL_CULTURE'],
    address: '충청북도 옥천군 옥천읍 향수길 119',
    description: '옥천 구읍의 별도 역사문화 장소로 보존된 생가입니다.',
    sourceUrl: 'https://www.oc.go.kr/tour/viewTnTursmResrceU.do?key=2510',
  }),
  record({
    entityUri: `${NS}traditionalCultureExperienceCenter`,
    canonicalLabelKo: '옥천전통문화체험관',
    alternateLabels: ['옥천 전통문화체험관', '전통문화체험관'],
    entityType: 'EXPERIENCE',
    accommodationType: 'HANOK_STAY',
    category: 'EXPERIENCE',
    tags: ['TRADITIONAL_CULTURE', 'INDOOR', 'ACTIVITY', 'ACCOMMODATION'],
    address: '충청북도 옥천군 옥천읍 향수길 100',
    telephone: '043-730-3414',
    website: 'https://tradition.oc.go.kr',
    operatingHours: [
      {
        days: [
          'TUESDAY',
          'WEDNESDAY',
          'THURSDAY',
          'FRIDAY',
          'SATURDAY',
          'SUNDAY',
        ],
        openTime: '10:00',
        closeTime: '17:00',
        lastEntryTime: '16:30',
        note: '설날·추석 당일 및 매주 월요일 휴관',
      },
    ],
    description: '전시와 전통문화 교육·체험을 운영하는 시설입니다.',
    sourceUrl: 'https://www.oc.go.kr/tour/contents.do?key=3877',
  }),

  ...[
    [
      'hanalcheon',
      '한알천',
      '메밀막국수, 능이오리백숙',
      '옥천읍 성왕로 1217',
      '043-731-3700',
    ],
    [
      'chamsaemTrout',
      '참샘송어 직판장',
      '송어회',
      '옥천읍 성왕로 1236',
      '043-733-4088',
    ],
    [
      'daebakRestaurant',
      '대박집',
      '생선국수, 도리뱅뱅',
      '성왕로 1250',
      '043-731-4727',
    ],
    [
      'herbalGoatVillage',
      '한방염소촌',
      '염소전골, 한방염소탕',
      '옥천읍 성왕로 1280',
      '043-733-7836',
    ],
    [
      'eollukbaegiBarley',
      '얼룩배기 보리밥 식당',
      '보리밥정식, 들깨수제비',
      '옥천읍 성왕로 1309',
      '043-731-1121',
    ],
    [
      'sojeongVillageRestaurant',
      '소정마을',
      '황태찜, 황태전골',
      '옥천읍 성왕로 1313-1',
      '043-733-8841',
    ],
    [
      'janginUreong',
      '장인우렁쌈밥',
      '수육우렁쌈밥, 생삼겹살',
      '옥천읍 성왕로 1354',
      '043-731-4223',
    ],
    [
      'bokgolOlgaengi',
      '맛있는 복골올갱이',
      '올갱이국밥, 올갱이 부추전',
      '옥천읍 성왕로 1441',
      '043-731-1085',
    ],
  ].map(([id, name, menu, address, phone]) =>
    record({
      entityUri: `${NS}${id}`,
      canonicalLabelKo: name,
      alternateLabels: [],
      entityType: 'RESTAURANT',
      category: 'FOOD',
      tags: ['FOOD', 'OKCHEON_COUNTY_DESIGNATED'],
      address: `충청북도 옥천군 ${address}`,
      telephone: phone,
      description: `옥천군 지정 맛집 목록의 ${menu} 취급 음식점입니다. 지정 사실은 추천 순위를 의미하지 않습니다.`,
      sourceUrl: foodSource,
    }),
  ),

  ...[
    ['plahie', '플라히에', '안내면 장계1길'],
    ['todakCafe', '토닥', '안내면 현리3길'],
    ['tteulpang', '뜰팡', '옥천읍 가화길'],
    ['roundCoffee', '라운드커피', '옥천읍 성왕로'],
    ['coffeeTime', '커피타임', '옥천읍 향수길'],
  ].map(([id, name, address]) =>
    record({
      entityUri: `${NS}${id}`,
      canonicalLabelKo: name,
      alternateLabels: [],
      entityType: 'CAFE',
      category: 'CAFE',
      tags: ['CAFE', 'REST'],
      address: `충청북도 옥천군 ${address}`,
      description:
        '옥천군 디지털 관광주민증 참여업소 목록에 등재된 카페입니다. 운영시간과 정확한 지점은 추가 확인이 필요합니다.',
      sourceUrl: residentSource,
    }),
  ),

  ...[
    [
      'neowaduriCamp',
      '너와두리농촌캠핑장',
      '청성면 한두레로 387',
      '043-733-7620',
    ],
    [
      'marronnierForestCamp',
      '마로니에숲',
      '이원면 장찬길 159-73',
      '043-732-1910',
    ],
    ['nadeuriCamp', '나드리캠핑장', '청성면 삼남2길 6', '010-5405-4450'],
  ].map(([id, name, address, phone]) =>
    record({
      entityUri: `${NS}${id}`,
      canonicalLabelKo: name,
      alternateLabels: [],
      entityType: 'ACCOMMODATION',
      accommodationType: 'CAMPING',
      category: 'ACCOMMODATION',
      tags: ['ACCOMMODATION', 'ACTIVITY'],
      address: `충청북도 옥천군 ${address}`,
      telephone: phone,
      description: '옥천군 문화관광 숙박 안내에 등재된 캠핑장입니다.',
      sourceUrl: lodgingSource,
    }),
  ),

  ...[
    ['onbomdal', '온봄달열하루', '라탄', '옥천읍 향수4길'],
    ['gabinyu', '숲속작은목공방 가비뉴', '목공', '안남면 청정3길'],
    ['sesanInsect', '세산곤충체험농장', '곤충 관찰', '동이면 세산3길'],
    ['baumArt', '문화예술공간 바움', '염색·허브', '옥천읍 마암로'],
  ].map(([id, name, activity, address]) =>
    record({
      entityUri: `${NS}${id}`,
      canonicalLabelKo: name,
      alternateLabels: [],
      entityType: 'EXPERIENCE',
      category: 'EXPERIENCE',
      tags: ['ACTIVITY', 'EXPERIENCE'],
      address: `충청북도 옥천군 ${address}`,
      description: `옥천군 디지털 관광주민증 목록의 ${activity} 체험 장소입니다. 프로그램 시간과 예약 여부는 확인이 필요합니다.`,
      sourceUrl: residentSource,
    }),
  ),
  ...OKCHEON_PHASE2_ESSENTIAL_SERVICES,
];
