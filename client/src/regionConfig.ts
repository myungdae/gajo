import type { CreateContextInput } from "./api/client";
export type RegionId =
  "gajo" | "okcheon" | "muan" | "gyeryong" | "hapcheon" | "daejeon-junggu";
export type QuickIntentId =
  | "first-time"
  | "place-now"
  | "food-now"
  | "two-hour-course"
  | "senior-comfort"
  | "rainy-day"
  | "events-today"
  | "nearby"
  | "free-talk";
export interface QuickIntent {
  id: QuickIntentId;
  title: string;
  description: string;
  destination: "/concierge" | "/nearby-discovery";
  preset?: "senior" | "family-healing" | "indoor" | "nearby";
  context: CreateContextInput;
}
export interface RegionalInterest {
  id: string;
  label: string;
  canonicalId: string;
}
export interface RegionalPlace {
  id: string;
  label: string;
  aliases: string[];
  category: string;
  description?: string;
  runtimeDataStatus: "UNKNOWN" | "PARTIAL" | "VERIFIED";
  entityType?: string;
  address?: string;
  telephone?: string;
  website?: string;
  reservationUrl?: string;
  latitude?: number;
  longitude?: number;
  actions?: Record<string, unknown>;
}
export type ShareKind = "REGIONAL_ENTRY" | "TRIP_INVITE";
export interface RegionShareConfig { kind:"REGIONAL_ENTRY";url:string;title:string;description:string;buttonLabel:string;image:string }
export interface RegionLandingPlace { name:string;description:string }
export interface RegionLandingConfig { backgroundImage:string;posterImage?:string;title:string;description:string;ctaLabel:string;places:RegionLandingPlace[] }
export interface RegionConfig {
  id: RegionId;
  regionName: string;
  administrativeLevel?: "district" | "city" | "county";
  parentRegionId?: string;
  serviceName: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCopy: string;
  home: {
    hero?: {
      title: string;
      titleLines?: string[];
      description: string;
      image?: string;
      alt?: string;
      overlay?: string;
      photoSource?: string;
      photoRightsStatus?: "DEVELOPMENT_ONLY" | "APPROVED";
    };
    question: string;
    supportingCopy: string;
    examples: string[];
    brandLine?: string;
    heroImage?: string;
  };
  accent: string;
  center?: { latitude: number; longitude: number };
  bounds?: { north: number; south: number; east: number; west: number };
  map?: {
    enabled: boolean;
    title: string;
    description: string;
    defaultZoom: number;
  };
  weather?: { enabled: boolean };
  quickIntents: QuickIntent[];
  supportedCategories: string[];
  interests: RegionalInterest[];
  places: RegionalPlace[];
  serviceAreaMessage: string;
  ontologyNamespace: string;
  dataSources: Record<string, string>;
  share?: RegionShareConfig;
  landing?: RegionLandingConfig;
}
export interface RegionalHomeEnglish {regionName:string;serviceName:string;heroTitle:string;heroSubtitle:string;heroCopy:string;spotlight?:{statusLabel:string;title:string;description:string;cta:string;imageAlt?:string};placeNames?:Record<string,string>}
const quickIntents: QuickIntent[] = [
  {
    id: "first-time",
    title: "처음 왔어요. 꼭 가볼 곳",
    description: "지역의 대표 방문지부터 살펴보기",
    destination: "/concierge",
    context: { inputMode: "FREE_TEXT", rawMessage: "처음 왔어요. 꼭 가볼 곳 알려주세요." },
  },
  {
    id: "place-now",
    title: "지금 어디 갈까요?",
    description: "현재 시간에 갈 수 있는 곳",
    destination: "/concierge",
    context: { inputMode: "STRUCTURED" },
  },
  {
    id: "food-now",
    title: "오늘 뭐 먹을까요?",
    description: "주변에서 지금 이용하기 좋은 곳",
    destination: "/nearby-discovery",
    context: { inputMode: "STRUCTURED" },
  },
  {
    id: "two-hour-course",
    title: "2~3시간 코스",
    description: "남은 시간에 맞춰 일정 만들기",
    destination: "/concierge",
    context: { inputMode: "STRUCTURED" },
  },
  {
    id: "senior-comfort",
    title: "부모님과 편하게",
    description: "걷기 부담이 적은 일정",
    destination: "/concierge",
    preset: "senior",
    context: { inputMode: "STRUCTURED" },
  },
  {
    id: "rainy-day",
    title: "비 오는 날",
    description: "날씨에 맞는 실내·대안 일정",
    destination: "/concierge",
    preset: "indoor",
    context: { inputMode: "STRUCTURED", activityPreferences: ["INDOOR"] },
  },
  {
    id: "events-today",
    title: "오늘 행사",
    description: "지금 참여할 수 있는 행사",
    destination: "/concierge",
    context: { inputMode: "STRUCTURED", activityPreferences: ["EVENTS"] },
  },
  {
    id: "nearby",
    title: "내 주변",
    description: "현재 위치에서 가까운 곳",
    destination: "/nearby-discovery",
    preset: "nearby",
    context: { inputMode: "STRUCTURED" },
  },
  {
    id: "free-talk",
    title: "그냥 말할게요",
    description: "상황을 편하게 이야기하기",
    destination: "/concierge",
    context: { inputMode: "STRUCTURED" },
  },
];
export const GAJO_CONFIG: RegionConfig = {
  id: "gajo",
  regionName: "가조",
  serviceName: "가조 여행 동행",
  heroTitle: "가조에 오신 것을 환영합니다",
  heroSubtitle: "오늘의 가조를 편안하게 만나보세요.",
  heroCopy: "계획할 때부터 여행 중인 지금까지, 필요한 다음 일정을 이어드려요.",
  home: {
    hero: {
      title: "가조에서, 여행의 다음을 찾으세요",
      description: "여행 전 계획부터 현장의 맛집·숙소·길찾기, 상황이 달라진 뒤의 새 일정까지 이어드립니다.",
      overlay: "#164d46",
    },
    question: "가조 여행, 무엇을 도와드릴까요?",
    supportingCopy: "말씀하시거나 편하게 입력해 주세요.",
    examples: [
      "가조에서 부모님과 편하게 갈 곳 알려줘",
      "온천 후에 어디로 갈까요?",
      "지금 가까운 맛집을 찾고 있어요",
    ],
  },
  accent: "#0b675f",
  center: { latitude: 35.714, longitude: 127.918 },
  bounds: { north: 35.84, south: 35.58, east: 128.05, west: 127.78 },
  quickIntents,
  supportedCategories: [
    "FOOD",
    "CAFE",
    "LODGING",
    "HOT_SPRING_WELLNESS",
    "ACTIVITY",
    "TOURISM_NATURE",
    "EVENTS",
  ],
  interests: [
    ["REST_AND_RECOVERY", "편안한 휴식"],
    ["HOT_SPRING", "온천"],
    ["FOOD", "맛집"],
    ["CAFE", "카페"],
    ["NATURE", "자연·산책"],
    ["INDOOR", "실내 활동"],
    ["ACTIVITY", "체험"],
  ].map(([id, label]) => ({
    id,
    label,
    canonicalId: `https://gajo-wellness.kr/ontology#interest-${id}`,
  })),
  places: [
    {
      id: "https://gajo-wellness.kr/ontology#antiAgingHealingLand",
      label: "거창 항노화힐링랜드",
      aliases: ["항노화힐링랜드"],
      category: "자연·산책",
      runtimeDataStatus: "VERIFIED",
    },
    {
      id: "https://gajo-wellness.kr/ontology#gajoHotSpringComplex",
      label: "백두산천지온천",
      aliases: ["가조 백두산천지온천"],
      category: "온천",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://gajo-wellness.kr/ontology#localFoodRestaurant",
      label: "미가추어탕",
      aliases: [],
      category: "지역음식",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://gajo-wellness.kr/ontology#wellnessLounge",
      label: "다온 카페",
      aliases: [],
      category: "카페",
      runtimeDataStatus: "PARTIAL",
    },
  ],
  serviceAreaMessage:
    "현재는 가조 지역을 중심으로 안내하고 있어요. 가조에서 즐길 수 있는 장소를 찾아드릴까요?",
  ontologyNamespace: "https://gajo-wellness.kr/ontology#",
  dataSources: {
    masterData: "gajo-master-data",
    nearby: "KAKAO_LOCAL",
    weather: "OPEN_METEO",
  },
};
export const OKCHEON_CONFIG: RegionConfig = {
  id: "okcheon",
  regionName: "옥천",
  serviceName: "옥천 여행안내",
  heroTitle: "옥천에 오신 것을 환영합니다",
  heroSubtitle: "오늘의 옥천을 편안하게 만나보세요.",
  heroCopy: "문학과 전통문화가 이어지는 구읍 여행을 차분하게 준비해 보세요.",
  home: {
    hero: {
      title: "옥천의 풍경과 이야기를 이어가세요",
      description: "여행 전 계획부터 현장의 맛집·숙소·길찾기, 상황이 달라진 뒤의 새 일정까지 이어드립니다.",
      overlay: "#315f63",
    },
    question: "옥천 여행, 무엇을 도와드릴까요?",
    supportingCopy: "말씀하시거나 편하게 입력해 주세요.",
    examples: [
      "정지용 생가 다음에 어디로 갈까요?",
      "옥천에서 맛집과 카페를 찾고 있어요",
      "대청호 주변을 편하게 둘러보고 싶어요",
    ],
  },
  accent: "#376f73",
  administrativeLevel: "county",
  center: { latitude: 36.3064, longitude: 127.5714 },
  bounds: { north: 36.45, south: 36.18, east: 127.93, west: 127.47 },
  map: {
    enabled: true,
    title: "옥천 운영 지도",
    description: "검증된 옥천 장소의 위치를 확인합니다.",
    defaultZoom: 11,
  },
  weather: { enabled: true },
  quickIntents,
  supportedCategories: [
    "LITERATURE_CULTURE",
    "TRADITIONAL_CULTURE",
    "TOURISM_NATURE",
    "LAKE",
    "FOOD",
    "CAFE",
    "INDOOR",
    "REST",
  ],
  interests: [
    ["LITERATURE_CULTURE", "문학·문화"],
    ["TRADITIONAL_CULTURE", "전통문화체험"],
    ["NATURE", "자연·산책"],
    ["DAECHEONG_LAKE", "대청호"],
    ["FOOD", "맛집"],
    ["CAFE", "카페"],
    ["INDOOR", "실내 활동"],
    ["REST_AND_RECOVERY", "편안한 휴식"],
  ].map(([id, label]) => ({
    id,
    label,
    canonicalId: `https://okcheon.example/ontology#interest-${id}`,
  })),
  places: [
    {
      id: "https://okcheon.example/ontology#jeongJiyongBirthplace",
      label: "정지용 생가",
      aliases: ["정지용생가"],
      category: "문학·문화",
      description:
        "옥천 구읍의 정지용 시인 생가로 구성된 지역 장소 항목입니다.",
      runtimeDataStatus: "UNKNOWN",
    },
    {
      id: "https://okcheon.example/ontology#jeongJiyongLiteratureMuseum",
      label: "정지용문학관",
      aliases: ["정지용 문학관"],
      category: "문학·문화",
      description: "정지용 문학을 소개하는 구읍의 지역 문화시설 항목입니다.",
      runtimeDataStatus: "UNKNOWN",
    },
    {
      id: "https://okcheon.example/ontology#traditionalCultureExperienceCenter",
      label: "옥천전통문화체험관",
      aliases: ["전통문화체험관"],
      category: "전통문화체험",
      description: "옥천 구읍의 전통문화 체험시설 항목입니다.",
      runtimeDataStatus: "UNKNOWN",
    },
  ],
  serviceAreaMessage:
    "현재는 옥천 지역을 중심으로 안내하고 있어요. 옥천에서 즐길 수 있는 장소를 찾아드릴까요?",
  ontologyNamespace: "https://okcheon.example/ontology#",
  dataSources: {
    masterData: "okcheon-curated-names",
    nearby: "KAKAO_LOCAL",
    weather: "OPEN_METEO",
  },
};
export const MUAN_CONFIG: RegionConfig = {
  id: "muan",
  regionName: "무안",
  serviceName: "무안 여행안내",
  heroTitle: "무안에 오신 것을 환영합니다",
  heroSubtitle: "오늘의 무안을 편안하게 만나보세요.",
  heroCopy:
    "연꽃과 생태, 갯벌과 해안이 이어지는 무안 여행을 편안하게 준비해 보세요.",
  home: {
    question: "무안 여행, 무엇을 도와드릴까요?",
    supportingCopy: "말씀하시거나 편하게 입력해 주세요.",
    examples: [
      "회산백련지 갔다가 어디로 갈까요?",
      "아이와 할 수 있는 체험 알려줘",
      "무안에서 편하게 쉴 곳을 찾고 있어요",
    ],
  },
  accent: "#557b4b",
  quickIntents,
  supportedCategories: [
    "LOTUS_ECOLOGY",
    "FAMILY_TRIP",
    "TOURISM_NATURE",
    "MUDFLAT_COAST",
    "ACTIVITY",
    "FOOD",
    "CAFE",
    "REST",
    "INDOOR",
  ],
  interests: [
    ["LOTUS_ECOLOGY", "연꽃·생태"],
    ["FAMILY_TRIP", "가족여행"],
    ["NATURE", "자연·산책"],
    ["MUDFLAT_COAST", "갯벌·해안"],
    ["ACTIVITY", "체험"],
    ["FOOD", "맛집"],
    ["CAFE", "카페"],
    ["REST_AND_RECOVERY", "편안한 휴식"],
    ["INDOOR", "실내 활동"],
  ].map(([id, label]) => ({
    id,
    label,
    canonicalId: `https://muan.example/ontology#interest-${id}`,
  })),
  places: [
    {
      id: "https://muan.example/ontology#hoesanWhiteLotusPond",
      label: "회산백련지",
      aliases: ["회산 백련지"],
      category: "연꽃·생태",
      description: "무안의 회산백련지 이름 기반 지역 장소 항목입니다.",
      runtimeDataStatus: "UNKNOWN",
    },
    {
      id: "https://muan.example/ontology#hoesanWhiteLotusPondArea",
      label: "회산백련지 일대",
      aliases: ["회산 백련지 일대"],
      category: "자연·산책",
      description: "회산백련지 주변 권역의 이름 기반 지역 장소 항목입니다.",
      runtimeDataStatus: "UNKNOWN",
    },
  ],
  serviceAreaMessage:
    "현재는 무안 지역을 중심으로 안내하고 있어요. 무안에서 즐길 수 있는 장소를 찾아드릴까요?",
  ontologyNamespace: "https://muan.example/ontology#",
  dataSources: {
    masterData: "muan-curated-names",
    nearby: "KAKAO_LOCAL",
    weather: "UNAVAILABLE",
  },
};
export const GYERYONG_CONFIG: RegionConfig = {
  id: "gyeryong",
  regionName: "계룡",
  serviceName: "계룡 여행안내",
  heroTitle: "국방과 자연이 만나는 계룡에 오신 것을 환영합니다",
  heroSubtitle: "필요한 순간, 먼저 찾아오는 AI 여행 동행자",
  heroCopy:
    "계룡의 자연과 역사, 군문화와 일상을 현재 상황에 맞춰 이어드려요.",
  home: {
    hero: {
      title: "국방과 자연이 만나는 계룡에 오신 것을 환영합니다",
      titleLines: ["국방과 자연이 만나는", "계룡에 오신 것을 환영합니다"],
      description: "필요한 순간, 먼저 찾아오는 AI 여행 동행자",
      overlay: "#263f3c",
    },
    question: "계룡 여행, 무엇을 도와드릴까요?",
    supportingCopy: "말씀하시거나 편하게 입력해 주세요.",
    examples: [
      "계룡 군문화 행사를 보고 싶어요",
      "아이와 지금 어디 갈까요?",
      "행사 후에 갈 맛집 알려줘",
    ],
  },
  accent: "#455a64",
  center: { latitude: 36.274, longitude: 127.249 },
  bounds: { north: 36.36, south: 36.2, east: 127.3, west: 127.18 },
  map: {
    enabled: true,
    title: "계룡 여행 지도",
    description: "현재 위치에서 공개 방문 가능한 계룡의 장소를 확인해 보세요.",
    defaultZoom: 13,
  },
  weather: { enabled: true },
  quickIntents,
  supportedCategories: [
    "MILITARY_CULTURE_HISTORY",
    "FESTIVAL_EVENT",
    "FAMILY_EXPERIENCE",
    "TOURISM_NATURE",
    "FOOD",
    "CAFE",
    "REST",
    "INDOOR",
    "LOCAL_CONVENIENCE",
  ],
  interests: [
    ["MILITARY_CULTURE_HISTORY", "군문화·역사"],
    ["FESTIVAL_EVENT", "축제·행사"],
    ["FAMILY_EXPERIENCE", "가족 체험"],
    ["NATURE", "자연·산책"],
    ["FOOD", "맛집"],
    ["CAFE", "카페"],
    ["REST_AND_RECOVERY", "편안한 휴식"],
    ["INDOOR", "실내 활동"],
    ["LOCAL_CONVENIENCE", "생활편의"],
  ].map(([id, label]) => ({
    id,
    label,
    canonicalId: `https://gyeryong.example/ontology#interest-${id}`,
  })),
  places: [
    {
      id: "https://gyeryong.example/ontology#militaryCultureFestival",
      label: "계룡 군문화축제",
      aliases: ["군문화축제", "계룡군문화축제"],
      category: "축제·행사",
      description:
        "공개 행사 여부와 일정 확인이 필요한 군문화 행사 항목입니다.",
      runtimeDataStatus: "UNKNOWN",
    },
    {
      id: "https://gyeryong.example/ontology#sagyeHistoricHouse",
      label: "사계고택(은농재)",
      aliases: ["사계고택", "은농재"],
      category: "역사·문화",
      description: "계룡시 공식 문화관광에 소개된 고택입니다. 관람 가능 시간은 방문 전에 확인해 주세요.",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://gyeryong.example/ontology#hyangjeoksanHealingForest",
      label: "향적산치유의숲",
      aliases: ["향적산 치유의 숲", "향적산"],
      category: "자연·산책",
      description: "계룡시 공식 문화관광에 소개된 산림 치유·산책 장소입니다.",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://gyeryong.example/ontology#ipamReservoir",
      label: "입암저수지",
      aliases: ["입암 저수지"],
      category: "자연·산책",
      description: "계룡시 공식 문화관광에 소개된 수변 경관 장소입니다.",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://gyeryong.example/ontology#goemokjeongPark",
      label: "괴목정",
      aliases: ["괴목정 공원"],
      category: "자연·산책",
      description: "신도안면 용동리의 공원입니다. 주변 군사시설 출입구역과 혼동하지 않도록 현장 안내를 따라 주세요.",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://gyeryong.example/ontology#militaryExperienceCenter",
      label: "계룡시병영체험관",
      aliases: ["병영체험관", "계룡 병영체험관"],
      category: "군문화·가족체험",
      description: "공개 체험시설이지만 프로그램과 관람 가능 여부는 방문 전에 확인해야 합니다.",
      runtimeDataStatus: "PARTIAL",
    },
  ],
  serviceAreaMessage:
    "현재는 계룡 지역을 중심으로 안내하고 있어요. 계룡에서 즐길 수 있는 장소와 일정을 찾아드릴까요?",
  ontologyNamespace: "https://gyeryong.example/ontology#",
  dataSources: {
    masterData: "gyeryong-curated-names",
    nearby: "KAKAO_LOCAL",
    weather: "OPEN_METEO",
  },
};
export const HAPCHEON_CONFIG: RegionConfig = {
  id: "hapcheon",
  regionName: "합천",
  serviceName: "합천 여행안내",
  heroTitle: "수려한 합천에 오신 것을 환영합니다",
  heroSubtitle: "현장에서 함께하는 AI 여행동행자",
  heroCopy:
    "호수와 자연, 드라이브와 가족 체류를 중심으로 합천 여행을 준비해 보세요.",
  home: {
    hero: {
      title: "수려한 합천에 오신 것을 환영합니다",
      titleLines: ["수려한 합천에", "오신 것을 환영합니다"],
      description: "현장에서 함께하는 AI 여행동행자",
      image: "/branding/hapcheon-meteor-basin-ai-dev-v1.jpg",
      alt: "산 위에서 바라본 합천의 넓은 산과 들 풍경을 표현한 AI 생성 개발용 이미지",
      photoSource: "AI 생성 임시 이미지 — 공식 합천 현장사진 아님",
      photoRightsStatus: "DEVELOPMENT_ONLY",
      overlay: "#294f56",
    },
    question: "지금, 무엇을 도와드릴까요?",
    supportingCopy: "말씀하시거나 편하게 입력해 주세요.",
    brandLine: "합천에 오신 것을 환영합니다",
    examples: [
      "합천호 주변 맛집 알려줘",
      "아이들과 지금 어디 갈까요?",
      "오늘 묵을 숙소를 찾고 있어요",
      "해인사 갔다가 어디로 갈까요?",
    ],
  },
  accent: "#496d75",
  center: { latitude: 35.55, longitude: 128.05 },
  bounds: { north: 35.84, south: 35.45, east: 128.32, west: 127.95 },
  map: {
    enabled: true,
    title: "합천 운영 지도",
    description: "공식 출처에서 좌표가 확인된 합천 장소만 표시합니다.",
    defaultZoom: 11,
  },
  weather: { enabled: true },
  quickIntents,
  supportedCategories: [
    "HAPCHEON_LAKE",
    "TOURISM_NATURE",
    "SCENIC_DRIVE",
    "FAMILY_TRIP",
    "FESTIVAL_EXHIBITION",
    "ACCOMMODATION",
    "FOOD",
    "CAFE",
    "REST",
    "ACTIVITY",
  ],
  interests: [
    ["HAPCHEON_LAKE", "합천호·호수"],
    ["NATURE", "자연·산책"],
    ["SCENIC_DRIVE", "드라이브"],
    ["FAMILY_TRIP", "가족여행"],
    ["FESTIVAL_EXHIBITION", "축제·전시"],
    ["ACCOMMODATION", "숙박"],
    ["FOOD", "맛집"],
    ["CAFE", "카페"],
    ["REST_AND_RECOVERY", "편안한 휴식"],
    ["ACTIVITY", "체험"],
  ].map(([id, label]) => ({
    id,
    label,
    canonicalId: `https://hapcheon.example/ontology#interest-${id}`,
  })),
  places: [
    {
      id: "https://hapcheon.example/ontology#hapcheonLake",
      label: "합천호",
      aliases: ["합천 호수"],
      category: "합천호·호수",
      description: "합천군 공식 관광정보로 확인한 합천호 권역입니다.",
      runtimeDataStatus: "VERIFIED",
    },
    {
      id: "https://hapcheon.example/ontology#haeinsa",
      label: "해인사",
      aliases: ["합천 해인사"],
      category: "자연·산책",
      runtimeDataStatus: "VERIFIED",
    },
    {
      id: "https://hapcheon.example/ontology#hwangmaesanCountyPark",
      label: "황매산 군립공원",
      aliases: ["황매산"],
      category: "자연·산책",
      runtimeDataStatus: "VERIFIED",
    },
    {
      id: "https://hapcheon.example/ontology#hapcheonVideoThemePark",
      label: "합천 영상테마파크",
      aliases: ["합천영상테마파크", "영상테마파크"],
      category: "체험",
      runtimeDataStatus: "VERIFIED",
    },
    {
      id: "https://hapcheon.example/ontology#hapcheonGardenThemePark",
      label: "합천 정원테마파크",
      aliases: ["정원테마파크"],
      category: "체험",
      runtimeDataStatus: "VERIFIED",
    },
    {
      id: "https://hapcheon.example/ontology#hwangmaesanSilverGrassFestival",
      label: "황매산 억새축제",
      aliases: ["황매산억새축제"],
      category: "축제·전시",
      description: "가을 축제이며 세부 일정은 공식 안내 확인이 필요합니다.",
      runtimeDataStatus: "VERIFIED",
      entityType: "EVENT",
    },
    {
      id: "https://hapcheon.example/ontology#cPark",
      label: "씨파크",
      aliases: ["합천 씨파크"],
      category: "체험",
      runtimeDataStatus: "VERIFIED",
    },
    {
      id: "https://hapcheon.example/ontology#cafeMotorrad",
      label: "카페 모토라드 합천",
      aliases: ["카페모토라드"],
      category: "카페",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://hapcheon.example/ontology#cherryRoastery",
      label: "커피볶는집체리",
      aliases: ["커피 볶는 집 체리"],
      category: "카페",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://hapcheon.example/ontology#cafeMoida",
      label: "카페모이다",
      aliases: ["카페 모이다"],
      category: "카페",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://hapcheon.example/ontology#hapcheonLakeSmilePension",
      label: "합천호 스마일펜션",
      aliases: ["스마일펜션", "합천호수뷰 스마일펜션"],
      category: "숙박",
      description: "공식 홈페이지로 확인한 합천호 권역 펜션입니다.",
      runtimeDataStatus: "VERIFIED",
    },
    {
      id: "https://hapcheon.example/ontology#hapcheonLakeCharcoalGalbi",
      label: "합천호 한우숯불갈비",
      aliases: ["합천호 숯불갈비"],
      category: "맛집",
      runtimeDataStatus: "PARTIAL",
    },
    {
      id: "https://hapcheon.example/ontology#bukeoMaeul",
      label: "북어마을",
      aliases: [],
      category: "맛집",
      runtimeDataStatus: "PARTIAL",
    },
  ],
  serviceAreaMessage:
    "현재는 합천호 권역을 중심으로 안내하고 있어요. 합천에서 즐길 수 있는 장소와 일정을 찾아드릴까요?",
  ontologyNamespace: "https://hapcheon.example/ontology#",
  dataSources: {
    masterData: "hapcheon-verified-operational",
    nearby: "VERIFIED_ANCHOR",
    weather: "OPEN_METEO",
  },
  share:{kind:"REGIONAL_ENTRY",url:"https://exkovia.com/hapcheon",title:"합천 여행, 같이 해요!",description:"함께 여행하며 필요한 곳을 찾고 일정을 만들어 보세요.",buttonLabel:"합천 여행도우미 시작하기",image:"https://exkovia.com/branding/hapcheon-ai-autumn-social-1200x630-v3.png"},
  landing:{backgroundImage:"/branding/hapcheon-autumn-landing-background-v1.png",posterImage:"/branding/hapcheon-tourism-ai-mobile-780x1688-v4.png",title:"합천관광 AI 여행도우미",description:"해인사부터 황매산까지, 필요한 순간 함께 여행을 이어가세요.",ctaLabel:"합천 여행 시작하기",places:[{name:"해인사",description:"천년의 역사와 고즈넉한 사찰"},{name:"영상테마파크",description:"근현대 시간여행 공간"},{name:"황매산",description:"사계절 아름다운 자연의 풍경"},{name:"합천호",description:"푸른 호수와 드라이브 풍경"}]},
};
export const DAEJEON_JUNGGU_CONFIG: RegionConfig = {
  id: "daejeon-junggu",
  regionName: "대전 중구",
  administrativeLevel: "district",
  parentRegionId: "daejeon",
  serviceName: "대전 중구 여행안내",
  heroTitle: "대전 중구에 오신 것을 환영합니다",
  heroSubtitle: "도심의 문화와 맛, 시장과 일상을 편하게 만나보세요.",
  heroCopy:
    "은행동·대흥동·중앙로의 도심문화와 시장, 먹거리와 공연을 편안하게 이어보세요.",
  home: {
    question: "대전 중구 여행, 무엇을 도와드릴까요?",
    supportingCopy: "말씀하시거나 편하게 입력해 주세요.",
    examples: [
      "중앙시장 주변 맛집 알려줘",
      "은행동에서 지금 어디 갈까요?",
      "대흥동 전시와 카페를 찾고 있어요",
    ],
  },
  accent: "#765b46",
  quickIntents,
  supportedCategories: [
    "URBAN_CULTURE",
    "TRADITIONAL_MARKET",
    "FOOD",
    "CAFE",
    "PERFORMANCE_EXHIBITION",
    "FAMILY_OUTING",
    "WALKING",
    "SHOPPING",
    "LOCAL_CONVENIENCE",
    "REST",
  ],
  interests: [
    ["URBAN_CULTURE", "도심문화"],
    ["TRADITIONAL_MARKET", "전통시장"],
    ["FOOD", "맛집"],
    ["CAFE", "카페"],
    ["PERFORMANCE_EXHIBITION", "공연·전시"],
    ["FAMILY_OUTING", "가족 나들이"],
    ["WALKING", "산책"],
    ["SHOPPING", "쇼핑"],
    ["LOCAL_CONVENIENCE", "생활편의"],
    ["REST_AND_RECOVERY", "편안한 휴식"],
  ].map(([id, label]) => ({
    id,
    label,
    canonicalId: `https://daejeon-junggu.example/ontology#interest-${id}`,
  })),
  places: [
    {
      id: "https://daejeon-junggu.example/ontology#eunhaengJungangroCulturalArea",
      label: "은행동·중앙로 문화권",
      aliases: ["은행동 중앙로 권역", "은행동·중앙로 권역", "은행동", "중앙로"],
      category: "도심문화",
      runtimeDataStatus: "UNKNOWN",
    },
    {
      id: "https://daejeon-junggu.example/ontology#euneungjeongiCultureStreet",
      label: "으능정이 문화의거리",
      aliases: ["으능정이", "으능정이 거리"],
      category: "도심문화",
      runtimeDataStatus: "UNKNOWN",
    },
    {
      id: "https://daejeon-junggu.example/ontology#daejeonCentralMarket",
      label: "대전 중앙시장",
      aliases: ["중앙시장"],
      category: "전통시장",
      runtimeDataStatus: "UNKNOWN",
    },
    {
      id: "https://daejeon-junggu.example/ontology#daeheungCulturalArtsArea",
      label: "대흥동 문화예술권",
      aliases: ["대흥동", "대흥동 문화권"],
      category: "공연·전시",
      runtimeDataStatus: "UNKNOWN",
    },
  ],
  serviceAreaMessage:
    "현재는 대전 중구를 중심으로 안내하고 있어요.\n중구에서 지금 즐길 수 있는 장소와 일정을 찾아드릴까요?",
  ontologyNamespace: "https://daejeon-junggu.example/ontology#",
  dataSources: {
    masterData: "daejeon-junggu-curated-names",
    nearby: "UNAVAILABLE",
    weather: "UNAVAILABLE",
  },
};
export const REGION_CONFIGS: Record<RegionId, RegionConfig> = {
  gajo: GAJO_CONFIG,
  okcheon: OKCHEON_CONFIG,
  muan: MUAN_CONFIG,
  gyeryong: GYERYONG_CONFIG,
  hapcheon: HAPCHEON_CONFIG,
  "daejeon-junggu": DAEJEON_JUNGGU_CONFIG,
};
export const REGION_CONFIG = GAJO_CONFIG;
export const REGION_HOME_ENGLISH:Record<RegionId,RegionalHomeEnglish>={
  gajo:{regionName:'Gajo',serviceName:'Explore Gajo',heroTitle:'Welcome to Gajo',heroSubtitle:'Take in Gajo at a relaxed pace today.',heroCopy:'Plan your next stop, from local food and stays to on-the-go changes.'},
  okcheon:{regionName:'Okcheon',serviceName:'Explore Okcheon',heroTitle:'Welcome to Okcheon',heroSubtitle:'Discover the landscapes and stories of Okcheon.',heroCopy:'Plan a relaxed journey through its literary and cultural heritage.'},
  muan:{regionName:'Muan',serviceName:'Explore Muan',heroTitle:'Welcome to Muan',heroSubtitle:'Discover Muan’s lotus ponds, wetlands, and coast.',heroCopy:'Find a comfortable route for nature, food, and family time.'},
  gyeryong:{regionName:'Gyeryong',serviceName:'Explore Gyeryong',heroTitle:'Welcome to Gyeryong',heroSubtitle:'Explore local history, events, and family attractions.',heroCopy:'Plan your next stop with practical local information.'},
  hapcheon:{regionName:'Hapcheon',serviceName:'Explore Hapcheon',heroTitle:'Welcome to Beautiful Hapcheon',heroSubtitle:"Enjoy a relaxing journey through Hapcheon's beautiful landscapes.",heroCopy:'Explore the lake, nature, scenic drives, and family-friendly stays.',spotlight:{statusLabel:'Welcome to Hapcheon',title:'Welcome to Beautiful Hapcheon',description:'Your AI travel companion, here before you need it.',cta:'Start My Journey',imageAlt:'A panoramic view of the mountains and fields of Hapcheon'},placeNames:{'https://hapcheon.example/ontology#hapcheonLake':'Hapcheon Lake','https://hapcheon.example/ontology#hwangmaesanCountyPark':'Hwangmaesan County Park'}},
  'daejeon-junggu':{regionName:'Jung-gu, Daejeon',serviceName:'Explore Jung-gu',heroTitle:'Welcome to Jung-gu, Daejeon',heroSubtitle:'Discover the city’s culture, markets, and performances.',heroCopy:'Find useful local stops for an easy day in the city.'}
};
export const getRegionalHomeEnglish=(region:RegionConfig)=>REGION_HOME_ENGLISH[region.id];
export const REGION_INTEREST_OPTIONS = [...GAJO_CONFIG.interests];
export const REGION_PLACE_SUGGESTIONS = [...GAJO_CONFIG.places];
export function findRegionConfig(value?: string | null) {
  return value && Object.prototype.hasOwnProperty.call(REGION_CONFIGS, value)
    ? REGION_CONFIGS[value as RegionId]
    : undefined;
}
export function setActiveRegionConfig(config: RegionConfig) {
  REGION_INTEREST_OPTIONS.splice(
    0,
    REGION_INTEREST_OPTIONS.length,
    ...config.interests,
  );
  REGION_PLACE_SUGGESTIONS.splice(
    0,
    REGION_PLACE_SUGGESTIONS.length,
    ...config.places,
  );
}
export function getRegionConfig(value?: string | null) {
  return findRegionConfig(value) || GAJO_CONFIG;
}
export function getRegionShareConfig(region:RegionConfig):RegionShareConfig{return region.share||{kind:"REGIONAL_ENTRY",url:`https://exkovia.com/${region.id}`,title:`${region.regionName} 여행, 같이 해요!`,description:"함께 여행하며 필요한 곳을 찾고 일정을 만들어 보세요.",buttonLabel:`${region.regionName} 여행도우미 시작하기`,image:"https://exkovia.com/branding/travel-helper-social-1200x630-v2.png"}}
const campaigns: Record<string, QuickIntentId> = {
  "next-place": "place-now",
  "food-now": "food-now",
  "rainy-day": "rainy-day",
  "two-hour-course": "two-hour-course",
  "events-today": "events-today",
};
export function resolveEntry(
  search: string,
  config: RegionConfig = GAJO_CONFIG,
) {
  const p = new URLSearchParams(search);
  const id = campaigns[p.get("intent") || ""];
  const modeValue = p.get("mode")?.toUpperCase();
  return {
    entrySource: p.get("entry") || "direct",
    entryEntity: p.get("entity") || undefined,
    mode:
      modeValue === "PLAN" || modeValue === "NOW"
        ? (modeValue as "PLAN" | "NOW")
        : undefined,
    intent: id ? config.quickIntents.find((i) => i.id === id) : undefined,
  };
}
export const entryCopy: Record<string, string> = {
  restaurant: "식사 후 어디 갈까요?",
  pension: "내일 오전 일정 만들기",
  parking: "주차 후 가까운 곳부터 보기",
  festival: "오늘 행사와 주변 즐길거리",
  attraction: "관람 후 다음 일정 찾기",
};
