export type GuideAudience =
  'VISITOR' | 'BUSINESS' | 'PUBLIC_SECTOR' | 'GENERAL';
export type GuideKnowledge = {
  intent: string;
  audiences: GuideAudience[];
  patterns: RegExp[];
  shortAnswer: string;
  audienceAnswers?: Partial<Record<GuideAudience, string>>;
  supportingConcepts: string[];
  example?: string;
  allowedClaims: string[];
  prohibitedClaims: string[];
  relatedQuestions: string[];
};

const prohibited = [
  'ChatGPT는 여행 추천을 못한다',
  'Google은 추천을 못한다',
  '네이버는 부정확하다',
  '세계 최초',
  '100% 정확',
  '매출 보장',
  '유료 업체 우선 노출',
  '현재 Google Play에서 다운로드할 수 있습니다',
  '현재 앱스토어에서 다운로드할 수 있습니다',
];
const item = (
  value: Omit<GuideKnowledge, 'prohibitedClaims'>,
): GuideKnowledge => ({ ...value, prohibitedClaims: prohibited });

export const GUIDE_KNOWLEDGE: GuideKnowledge[] = [
  item({
    intent: 'CONCIERGE_ONE_LINE',
    audiences: ['GENERAL', 'VISITOR', 'BUSINESS', 'PUBLIC_SECTOR'],
    patterns: [
      /(?:지역\s*)?AI\s*컨시어지.*(?:뭐|무엇|한마디|한\s*줄|쉽게\s*설명)|한마디로\s*뭐|한\s*줄로\s*설명|쉽게\s*설명하면/i,
    ],
    shortAnswer:
      '지역 AI 컨시어지는 여행객의 지금 상황을 이해해, 필요한 지역의 장소와 서비스를 찾아 다음 행동까지 이어주는 여행 AI입니다. 쉽게 말하면 여행객에게는 필요한 순간의 길잡이이고, 지역 업체에는 필요한 고객과 만나는 연결통로입니다. 묻는다 → 상황을 이해한다 → 판단한다 → 지역과 연결한다 → 행동으로 이어진다.',
    supportingConcepts: ['runtime context', 'regional connection', 'actions'],
    allowedClaims: ['현재 제품 역할을 간결하게 설명'],
    relatedQuestions: [
      '여행 중에는 실제로 무엇을 해주나요?',
      '이거 홈페이지인가요?',
    ],
  }),
  item({
    intent: 'DURING_TRIP_ASSISTANCE',
    audiences: ['GENERAL', 'VISITOR'],
    patterns: [
      /여행\s*중.*(?:실제로|무엇|뭘|어떻게\s*(?:쓰|이어))|여행할\s*때.*뭘|실제\s*여행.*어떻게\s*이어/i,
    ],
    shortAnswer:
      '목적지 목록만 주고 끝내지 않습니다. 현재 확인할 수 있는 위치·시간·날씨, 진행 중인 여행 상태와 방문자가 알려준 요청·동행·이동 여건을 함께 보고 지금 맞는 다음 선택을 다시 판단합니다. 비가 오거나, 식사가 필요하다고 말했거나, 동행자가 지쳤거나, 한 장소를 마쳤거나, 남은 시간이 줄었을 때처럼 흐름이 달라지면 그 상황에 맞춰 여행을 이어갑니다. 배고픔이나 피로를 센서가 자동으로 안다는 뜻은 아닙니다. 여행을 알려주는 AI가 아니라, 여행의 흐름을 계속 이어주는 AI를 지향합니다.',
    supportingConcepts: ['runtime context', 'TripSession', 'current journey'],
    allowedClaims: ['제공되거나 확인 가능한 현재 맥락 사용', '방문자 입력에 따른 재판단'],
    relatedQuestions: [
      '여행 계획이 갑자기 바뀌어도 되나요?',
      '추천만 하나요, 바로 갈 수도 있나요?',
    ],
  }),
  item({
    intent: 'RUNTIME_REPLANNING',
    audiences: ['GENERAL', 'VISITOR'],
    patterns: [
      /계획.*(?:갑자기\s*)?바뀌|일정.*바꿔|시간.*줄었|비가\s*오면.*일정/i,
    ],
    shortAnswer:
      '네. 여행 도중 조건이 달라지면 현재 TripSession과 진행 중인 여정을 기준으로 남은 흐름을 다시 구성할 수 있습니다. 반드시 가고 싶은 곳과 직접 지정한 목적지는 제약으로 보존하고, 줄어든 시간이나 방문자가 알려준 변화, 확인 가능한 날씨 같은 현재 조건에 맞춰 나머지를 조정합니다. 폐업·휴무나 교통 상황을 실시간으로 모두 안다고 약속하지 않으며, 확인되지 않은 운영 사실은 추측하지 않습니다.',
    supportingConcepts: ['TripSession', 'must-visit constraints', 'runtime replanning'],
    allowedClaims: ['명시 목적지 보존', '현재 조건에 따른 남은 여정 재구성'],
    relatedQuestions: [
      '추천만 하나요, 바로 갈 수도 있나요?',
      '앞에서 한 이야기도 기억하나요?',
    ],
  }),
  item({
    intent: 'TRIP_CONTINUITY',
    audiences: ['GENERAL', 'VISITOR'],
    patterns: [
      /앞에서.*(?:이야기|말).*(?:기억|이어)|매번.*다시\s*설명|저장한\s*여행.*이어|이야기도\s*기억/i,
    ],
    shortAnswer:
      '같은 여행에서는 TripSession에 저장한 장소와 일정, 구조화된 대화 맥락을 이용해 앞의 선택을 이어갑니다. 그래서 매 질문마다 여행을 처음부터 다시 설명하지 않아도 됩니다. 다만 사람처럼 모든 대화를 무기한 기억하는 것은 아니며, 저장 범위와 브라우저·세션 상태에 따라 이어지는 정보가 달라질 수 있습니다.',
    supportingConcepts: ['TripSession', 'saved places', 'itinerary', 'structured context'],
    allowedClaims: ['같은 여행의 구조화된 연속성', '무제한 기억 아님'],
    relatedQuestions: ['추천만 하나요, 바로 갈 수도 있나요?'],
  }),
  item({
    intent: 'RECOMMENDATION_TO_ACTION',
    audiences: ['GENERAL', 'VISITOR'],
    patterns: [
      /추천만.*(?:해|하)|바로\s*갈\s*수|길찾기.*(?:되|해)|추천.*바로.*가/i,
    ],
    shortAnswer:
      '지원되는 장소라면 추천에서 끝나지 않고 묻기 → 판단 → 선택 → 행동으로 이어집니다. 검증된 좌표가 있는 장소의 길찾기, 확인된 전화번호로 전화, My Trip 저장 같은 실제 구현 행동을 제공할 수 있습니다. 모든 장소에 모든 버튼이 있는 것은 아니며, 확인된 운영 정보가 없는 행동은 열지 않습니다.',
    supportingConcepts: ['navigation', 'phone', 'My Trip', 'action safety'],
    allowedClaims: ['구현되고 검증된 행동만 제공'],
    relatedQuestions: ['앞에서 한 이야기도 기억하나요?'],
  }),
  item({
    intent: 'FUTURE_VISION',
    audiences: ['GENERAL', 'VISITOR', 'BUSINESS', 'PUBLIC_SECTOR'],
    patterns: [/앞으로.*(?:어디까지|발전|가능)|미래.*(?:기능|발전)/i],
    shortAnswer:
      '현재는 여행 상황에 맞춘 방문자 안내, 같은 여행의 연속성, 검증된 정보가 있는 길찾기·전화·저장 같은 행동, Regional Copilot을 통한 지역 데이터 검토를 지원합니다. 앞으로의 가능성으로는 더 넓은 예약·교통·시설 시스템 연동, IoT, 물리적 서비스 로봇과의 연결을 검토할 수 있습니다. 이런 항목은 미래 가능성이며 현재 구현된 기능, 특히 현재 로봇이 운영 중이라는 뜻은 아닙니다.',
    supportingConcepts: ['CURRENT', 'FUTURE POSSIBILITIES'],
    allowedClaims: ['현재와 미래 가능성의 명확한 구분'],
    relatedQuestions: ['지금 여행 중에는 실제로 무엇을 해주나요?'],
  }),
  item({
    intent: 'EXKO_EXPLANATION',
    audiences: ['GENERAL', 'VISITOR', 'PUBLIC_SECTOR'],
    patterns: [
      /EXKO.*(?:뭐|무엇|설명)|엑스코.*(?:뭐|무엇|설명)/i,
      /일반\s*검색.*관계\s*기반|관계\s*기반\s*AI.*검색/i,
    ],
    shortAnswer:
      '검색은 이름이 맞는 장소를 찾는 데 강하고, 관계 기반 AI는 사람·장소·문화·음식이 어떻게 연결되는지를 이해해 여행의 흐름을 만드는 데 도움을 줍니다. EXKO는 이런 관계를 다루는 내부 플랫폼 계층입니다. 실제 길찾기나 전화 같은 행동은 EXKO가 결정하지 않고, 지역 관리자가 확인한 운영정보와 현재 여행 상황을 다시 확인한 뒤에만 제공합니다.',
    supportingConcepts: [
      'semantic relationships',
      'RDM action safety',
      'runtime context',
    ],
    allowedClaims: [
      'EXKO는 내부 관계 계층',
      '검색과 관계 기반 이해의 역할 차이',
      '운영 행동은 RDM 안전 경계 적용',
    ],
    relatedQuestions: [
      '관계 기반 AI가 여행을 어떻게 만들어요?',
      '관계가 있으면 바로 길찾기할 수 있나요?',
    ],
  }),
  item({
    intent: 'OKCHEON_STATUS',
    audiences: ['GENERAL', 'VISITOR', 'PUBLIC_SECTOR'],
    patterns: [
      /옥천.*(?:되나요|되나|지원|사용|쓸\s*수|어느\s*정도\s*준비|준비.*상태)|옥천에서도/,
    ],
    shortAnswer:
      '합천에서 현장 검증을 진행했고, 가조에서 공통 엔진의 재사용성을 확인했으며, 옥천도 같은 Regional Engine에 공식 지역 데이터와 설정을 연결하는 방식으로 온보딩하고 있습니다. 현재 옥천 방문자 화면과 지역별 여행 저장의 기본 연결은 구현되었고, EXKO 의미 관계 기반 문학 여정도 작동합니다. 다만 일부 장소의 정확한 좌표와 운영시간, 카페·생활편의점의 현장 검증은 계속 필요해 현장 데모는 관리자 확인 준비 단계입니다. 따라서 공개 배포가 완료된 완전한 운영 서비스라고 주장하지는 않습니다.',
    supportingConcepts: [
      'shared Regional Engine',
      'Okcheon RDM',
      'regional isolation',
      'onboarding status',
    ],
    allowedClaims: [
      '공통 엔진 연결',
      '부분적 공식 데이터 온보딩',
      '미완료 운영 검증 공개',
    ],
    relatedQuestions: [
      '옥천에서 지금 어떤 기능을 쓸 수 있나요?',
      '정보는 누가 확인하나요?',
    ],
  }),
  item({
    intent: 'CHATGPT_DIFFERENCE',
    audiences: ['GENERAL', 'VISITOR'],
    patterns: [/chatgpt|챗gpt|챗지피티|gemini|제미나이|범용\s*ai/i],
    shortAnswer:
      'ChatGPT는 아주 폭넓은 질문에 답할 수 있는 범용 AI입니다. 지역 AI 컨시어지는 그런 AI를 지역의 검증된 정보와 현재 여행 상황에 연결해 실제 현장에서 일하도록 만든 서비스입니다. 단순히 답을 주는 데서 끝나지 않고 현재 여행을 이어서 다음 행동까지 연결하는 데 초점을 둡니다.',
    supportingConcepts: ['RDM', 'runtime context', 'TripSession', 'actions'],
    allowedClaims: ['범용 AI와 지역 운영 시스템의 역할 차이'],
    relatedQuestions: [
      'ChatGPT한테 위치를 알려주면 똑같지 않나요?',
      '실제 여행에서는 어떻게 이어지나요?',
    ],
  }),
  item({
    intent: 'MAP_DIFFERENCE',
    audiences: ['GENERAL', 'VISITOR'],
    patterns: [/구글|google|네이버\s*지도|지도.*(?:왜|필요)|다\s*해주/i],
    shortAnswer:
      '맞습니다. 지도 서비스는 장소를 찾고 길을 안내하는 데 매우 뛰어납니다. 지역 AI 컨시어지가 집중하는 것은 그 많은 장소 중 현재 위치, 남은 시간, 동행자, 날씨와 기존 여행을 함께 보고 지금 무엇이 맞는지 판단하는 일입니다. Maps find places. The Concierge helps decide what fits now.',
    supportingConcepts: [
      'current location',
      'runtime context',
      'journey continuity',
    ],
    allowedClaims: ['서로 다른 초점', '지도 서비스의 강점 인정'],
    relatedQuestions: [
      '구글도 요즘 AI 추천하는데요?',
      '그냥 검색하면 되지 않나요?',
    ],
  }),
  item({
    intent: 'MAP_OBJECTION',
    audiences: ['GENERAL', 'VISITOR'],
    patterns: [/구글도.*(?:추천|ai)|지도도.*추천|위치.*알려.*똑같/i],
    shortAnswer:
      '맞습니다. 범용 AI와 지도 서비스도 위치 기반 추천을 제공할 수 있습니다. 이 플랫폼이 좁게 집중하는 차이는 지역 관리자가 검토한 운영 데이터, 여러 질문 사이의 여행 연속성, 현재 일정 상태와 안전한 행동 연결을 한 구조에서 다루는 점입니다. 모든 면에서 더 낫다는 뜻이 아니라 지역 현장 운영에 맞춘 역할입니다.',
    supportingConcepts: [
      'RDM',
      'Regional Copilot',
      'current-turn',
      'action safety',
    ],
    allowedClaims: ['기능 중첩 인정', '지역 운영 초점'],
    relatedQuestions: [
      '정보는 누가 검토하나요?',
      '여행을 닫았다 열면 어떻게 되나요?',
    ],
  }),
  item({
    intent: 'SEARCH_CONTINUITY',
    audiences: ['GENERAL', 'VISITOR'],
    patterns: [/그냥.*검색|검색하면|키워드\s*검색/],
    shortAnswer:
      '검색은 보통 한 번의 질문에서 장소를 찾는 데 강합니다. 지역 AI 컨시어지는 “펜션 근처 카페?” 다음의 “그 주변 볼 곳?”, “거긴 멀어?”, “비가 오는데?”를 같은 여행 맥락으로 이어갑니다. 각 질문을 고립된 검색어로 보지 않고 현재 장소와 일정 상태를 구조화해 유지하는 데 초점을 둡니다.',
    supportingConcepts: [
      'conversational anchor',
      'current-turn',
      'TripSession',
    ],
    allowedClaims: ['구조화된 연속성'],
    relatedQuestions: ['닫았다 다시 열어도 이어지나요?'],
  }),
  item({
    intent: 'INFORMATION_CORRECTION',
    audiences: ['GENERAL', 'VISITOR', 'BUSINESS', 'PUBLIC_SECTOR'],
    patterns: [
      /정보\s*수정|잘못된\s*정보.*(?:고치|알려|발견)|(?:업체|가게)\s*정보.*틀|영업시간.*바뀌|전화번호.*바뀌|주소.*잘못|업체.*직접.*수정|누가.*(?:수정.*승인|최종.*(?:승인|결정))|수정.*바로.*반영|왜.*(?:바로.*수정|복잡)|관광객.*틀린\s*정보|지자체.*누가.*지역정보/i,
    ],
    shortAnswer:
      '지역정보를 아무나 바로 운영 데이터에 덮어쓰지는 않습니다. 현재는 Regional Copilot이 검색에서 발견된 후보와 확인이 필요한 데이터 품질 문제를 검토 과제로 보여주고, 권한을 가진 지역 운영자가 기존 정보와 근거를 확인해 최종 반영 여부를 결정합니다. 확인된 정보만 VERIFIED/ACTIVE 지역 운영 데이터가 되어 관광객 서비스에 제공됩니다. 기본 원칙은 “수정 필요 발견 → 근거 확인 → 사람의 승인 → 서비스 반영”입니다. 현재 Guide나 관광객 서비스에는 공개 정보 오류 신고 버튼이 없고, 업체가 직접 운영 데이터를 수정하는 셀프서비스 포털도 구현되어 있지 않습니다. 향후에는 관광객이나 업체가 변경사항과 근거를 제출하고 지역 운영자가 확인·승인하는 방식으로 확장할 수 있습니다. 전화번호·영업시간·위치처럼 실제 행동에 연결되는 정보이므로 검색에서 발견됐다는 이유만으로 즉시 사실로 취급하지 않는 절차입니다.',
    audienceAnswers: {
      VISITOR:
        '틀린 정보를 발견해도 확인되지 않은 내용을 그대로 믿거나 운영 데이터에 즉시 덮어쓰지는 않습니다. Regional Copilot이 확인할 후보와 품질 문제를 구분하고, 권한을 가진 지역 운영자가 근거를 확인해 승인한 정보만 관광객 서비스에 반영합니다. 현재 관광객 화면에는 공개 오류 신고 버튼이 구현되어 있지 않습니다. 향후에는 오류 내용과 근거를 제출하고 검토 결과를 거쳐 반영하는 방식으로 확장할 수 있습니다.',
      BUSINESS:
        '업체의 영업시간·전화번호·주소 같은 운영 정보도 확인 없이 바로 지역의 공식 운영 데이터가 되지는 않습니다. 현재는 업체가 직접 즉시 수정하는 셀프서비스 포털이 없으며, Regional Copilot의 검토 과제와 권한을 가진 지역 운영자의 근거 확인·승인을 거쳐 VERIFIED/ACTIVE 데이터로 반영하는 구조입니다. 향후에는 업체가 변경사항과 근거를 직접 제출하고 승인 후 반영하는 방식으로 확장할 수 있습니다.',
      PUBLIC_SECTOR:
        'Regional Copilot이 검색 후보, 누락·좌표·연락처 같은 데이터 품질 문제와 확인할 근거를 검토 대상으로 제시하고, 최종 반영 여부는 권한을 가진 Regional Manager가 결정합니다. 승인된 정보만 VERIFIED/ACTIVE 지역 운영 데이터가 되어 Local Concierge에 제공됩니다. Copilot이 제안하고 사람이 결정하는 구조이며, 공개 신고나 업체 직접 수정 포털은 현재 구현 범위가 아니라 향후 승인형 제출 경로로 확장할 수 있습니다.',
    },
    supportingConcepts: [
      'candidate review',
      'human approval',
      'VERIFIED/ACTIVE boundary',
    ],
    allowedClaims: [
      '현재 관리자 검토 경로',
      '공개 신고·업체 포털 미구현',
      '사람의 최종 승인',
    ],
    relatedQuestions: [
      '업체가 직접 수정할 수 있나요?',
      '수정하면 바로 반영되나요?',
      '누가 최종 승인하나요?',
      '왜 바로 수정하면 안 되나요?',
    ],
  }),
  item({
    intent: 'DATA_ACCURACY',
    audiences: ['GENERAL', 'VISITOR', 'BUSINESS', 'PUBLIC_SECTOR'],
    patterns: [/틀린\s*정보|정보.*틀리|오류|정확|책임/],
    shortAnswer:
      '오류가 전혀 없다고 약속하지는 않습니다. 외부 검색에서 발견한 정보는 곧바로 운영 사실로 쓰지 않고 미검증 후보로 구분합니다. Regional Copilot이 검토 과제를 만들고 지역 관리자가 중요한 사실을 확인한 뒤 VERIFIED/ACTIVE 지역 운영 데이터로 반영하는 구조입니다.',
    supportingConcepts: [
      'search evidence',
      'UNVERIFIED',
      'Regional Copilot',
      'RDM',
    ],
    allowedClaims: ['검토 절차', '제로 오류 비보장'],
    relatedQuestions: [
      '누가 정보를 검토하나요?',
      '잘못된 정보를 발견하면 어떻게 하나요?',
    ],
  }),
  item({
    intent: 'DATA_STEWARDSHIP',
    audiences: ['GENERAL', 'BUSINESS', 'PUBLIC_SECTOR'],
    patterns: [/누가.*(?:관리|고치|검토)|지역정보.*관리|틀린.*누가/],
    shortAnswer:
      'Regional Copilot은 누락 장소, 오래된 정보, 좌표 부족과 미검증 후보를 찾아 검토 과제로 제안합니다. 중요한 운영 사실은 지역 관리자가 확인하고 승인합니다. Copilot proposes. Human decides.',
    supportingConcepts: [
      'Regional Copilot',
      'Regional Manager',
      'Core Destination',
    ],
    allowedClaims: ['사람의 승인'],
    relatedQuestions: [
      'Regional Copilot은 무슨 일을 하나요?',
      '누가 최종 승인하나요?',
    ],
  }),
  item({
    intent: 'PAID_RANKING',
    audiences: ['GENERAL', 'BUSINESS', 'PUBLIC_SECTOR'],
    patterns: [/돈.*(?:업체|먼저|추천)|유료|광고|가입.*먼저|순위/],
    shortAnswer:
      '아니요. 유료 참여와 추천 우선순위는 같지 않습니다. 현재 제품 원칙에서 결제나 회원 여부는 추천 순위를 정하는 기준이 아니며, 추천은 방문자 필요, 상황 적합성, 장소 유형과 검증된 운영 정보를 기준으로 합니다. 향후 광고나 상업 상품이 생긴다면 맥락 기반 추천과 명확히 구분되어야 합니다. 미래의 구체적인 상업 정책까지 약속하지는 않습니다.',
    supportingConcepts: ['ranking principle', 'Core Destination', 'RDM'],
    allowedClaims: ['현재 원칙만 설명'],
    relatedQuestions: ['업체는 왜 참여해야 하나요?'],
  }),
  item({
    intent: 'BUSINESS_VALUE',
    audiences: ['BUSINESS', 'GENERAL'],
    patterns: [/업체.*(?:도움|좋|참여|왜)|상인|사업자|가게.*참여/],
    shortAnswer:
      '가치는 단순히 광고 노출을 늘리는 데 있지 않습니다. 방문자 필요 → 맥락상 적합한 후보 → 알맞은 지역 업체 → 지원되는 행동 → 방문 가능성으로 이어질 수 있다는 데 있습니다. 업체는 대표 정보와 운영 정보를 정확하게 표현하고 방문자 상황에 실제로 맞을 때 발견될 기회를 얻습니다. 참여나 결제가 추천·방문·매출을 보장하지는 않습니다.',
    supportingConcepts: [
      'canonical business identity',
      'verified facts',
      'actions',
    ],
    allowedClaims: ['잠재적 가치', '보장 없음'],
    relatedQuestions: [
      '정보 수정은 어떻게 하나요?',
      '돈을 내면 먼저 나오나요?',
    ],
  }),
  item({
    intent: 'MUNICIPALITY_VALUE',
    audiences: ['PUBLIC_SECTOR', 'GENERAL'],
    patterns: [/지자체|공공|군청|시청|꼭.*해야|왜.*필요/],
    shortAnswer:
      '지자체 참여가 기술적으로 필수인 것은 아닙니다. 다만 관광·음식·숙박 같은 지역 정보를 지속적으로 관리하고, 누락 데이터를 찾고, 근거를 검증해 현장 방문자 서비스와 연결하는 정보 stewardship 역할에 도움이 됩니다. 공공·민간의 실제 역할은 지역 여건과 협력 방식에 따라 달라집니다.',
    supportingConcepts: [
      'public data',
      'regional stewardship',
      'sustainability',
    ],
    allowedClaims: ['선택적 참여'],
    relatedQuestions: ['민간 운영으로 시작할 수 있나요?'],
  }),
  item({
    intent: 'REGIONAL_SCALE',
    audiences: ['GENERAL', 'PUBLIC_SECTOR'],
    patterns: [/합천.*(?:만|밖)|다른\s*지역|전국|확장|여러\s*지역|지역.*(?:섞|분리)|가조.*옥천|합천.*가조/i],
    shortAnswer:
      '합천·가조·옥천은 같은 Regional Engine을 함께 사용합니다. 대신 각 지역의 운영 데이터, 의미 관계의 근거, 관리자 권한과 방문자의 여행 상태는 지역별로 분리됩니다. 쉽게 말해 AI 기술은 함께 쓰되, 지역의 정보와 여행은 서로 섞이지 않도록 분리합니다. 지자체 참여가 기술적으로 반드시 필요하거나 전국 운영이 완료됐다는 뜻은 아닙니다.',
    supportingConcepts: ['Shared Regional Engine', 'isolated regions'],
    allowedClaims: ['검증 단계', '전국 운영 미주장'],
    relatedQuestions: ['지역별 정보가 섞이지 않나요?'],
  }),
  item({
    intent: 'WEBSITE_OR_MOBILE',
    audiences: ['GENERAL', 'VISITOR', 'BUSINESS', 'PUBLIC_SECTOR'],
    patterns: [
      /홈페이지|웹\s*사이트|웹사이트|pc.*(?:되|사용)|컴퓨터.*(?:되|사용)/i,
    ],
    shortAnswer:
      '웹에서 열리기 때문에 홈페이지처럼 보일 수 있고 PC에서도 사용할 수 있습니다. 다만 정보를 찾아 읽는 데 중심을 둔 일반적인 홈페이지와는 제품 역할이 다릅니다. 지역 AI 컨시어지는 여행 현장에서 휴대폰으로 사용하는 것을 중심으로 설계한 모바일형 서비스입니다. 현재 위치, 시간, 동행자, 날씨와 이어 오던 여행을 함께 이해해 지금 갈 곳을 찾고, 일정을 바꾸거나 길찾기·전화 같은 다음 행동으로 연결합니다. 쉽게 말하면 웹은 들어오는 입구이고, 실제 서비스는 관광객의 휴대폰 속에서 함께 움직이는 AI 컨시어지에 가깝습니다. 홈페이지가 “합천의 관광지는 여기에 있습니다”라고 정보를 보여준다면, 컨시어지는 “지금 비가 오고 어머니와 함께 계시니 남은 두 시간에는 이곳이 더 적합합니다”처럼 현재 상황에 맞는 다음 행동을 돕는 차이입니다.',
    audienceAnswers: {
      BUSINESS:
        '웹에서 열리지만 단순한 업체 목록 홈페이지는 아닙니다. 검증된 업체 정체성과 운영 정보를 지역 맥락에 연결해, 방문자의 현재 상황에 적합할 때 발견되고 길찾기·전화·예약처럼 지원되는 다음 행동으로 이어지도록 돕습니다. 결제에 따른 순위나 노출을 약속하는 구조는 아닙니다.',
      PUBLIC_SECTOR:
        '웹과 PC에서도 사용할 수 있지만 방문자가 여행 현장에서 휴대폰으로 쓰는 것을 중심으로 설계했습니다. QR이나 링크로 바로 접근할 수 있어 앱스토어 설치를 먼저 요구하지 않고, 지역 운영 데이터와 Regional Manager의 관리 책임을 바탕으로 현장 안내를 이어갑니다. 향후 유통 방식은 필요에 따라 확장할 수 있습니다.',
    },
    supportingConcepts: [
      'web entry',
      'mobile-first field use',
      'runtime context',
      'actions',
    ],
    allowedClaims: ['웹 제공', 'PC 지원', '모바일 우선'],
    relatedQuestions: ['그럼 이걸 내 휴대폰에 어떻게 넣나요?', '앱인가요?'],
  }),
  item({
    intent: 'PHONE_ACCESS',
    audiences: ['GENERAL', 'VISITOR', 'PUBLIC_SECTOR'],
    patterns: [
      /(?:휴대폰|핸드폰).*(?:넣|가지|가질|설치)|어떻게.*(?:가지|가질|넣)|설치해야|다운로드|qr|큐알|홈\s*화면.*추가/i,
    ],
    shortAnswer:
      '가장 간단한 방법은 QR코드를 찍거나 링크를 눌러 바로 여는 것입니다. 앱스토어에서 먼저 설치해야만 사용할 수 있는 서비스가 아닙니다. 자주 사용하고 싶다면 지원되는 휴대폰과 브라우저에서 ‘홈 화면에 추가’를 이용해 일반 앱처럼 아이콘으로 열 수 있습니다. 같은 브라우저에서 다시 열면 지역별 익명 여행 상태에 저장된 일정과 장소를 이어서 사용할 수 있도록 설계되어 있습니다. 설치해야 쓸 수 있는 서비스가 아니라, 먼저 바로 써보고 마음에 들면 내 휴대폰에 넣어 계속 쓰는 흐름입니다. 기기와 브라우저에 따라 홈 화면 추가 방식과 메뉴 이름은 다를 수 있습니다.',
    supportingConcepts: [
      'QR or link',
      'optional Home Screen',
      'TripSession continuity',
    ],
    allowedClaims: ['설치 선택', '동일 브라우저 지역별 여행 연속성'],
    relatedQuestions: ['앱인가요?', '앱스토어에서도 받을 수 있나요?'],
  }),
  item({
    intent: 'APP_EXPERIENCE',
    audiences: ['GENERAL', 'VISITOR'],
    patterns: [/(?:그럼\s*)?앱(?:인가|이에요|이야|처럼)|앱을\s*받아야/i],
    shortAnswer:
      '앱처럼 사용할 수 있지만 처음부터 앱스토어 설치를 요구하는 방식은 아닙니다. 모바일 브라우저에서 바로 사용할 수 있고, 지원되는 휴대폰에서는 홈 화면에 추가해 앱처럼 실행할 수 있습니다. 현재 기본 방식은 이런 모바일 웹/PWA 방식이며, 필요하면 향후 앱스토어 배포 형태로 확장할 수도 있습니다.',
    supportingConcepts: ['mobile web', 'optional PWA installation'],
    allowedClaims: ['앱 같은 사용 경험', '현재 스토어 미필수'],
    relatedQuestions: ['PWA가 뭐예요?', '앱스토어에서도 받을 수 있나요?'],
  }),
  item({
    intent: 'STORE_AVAILABILITY',
    audiences: ['GENERAL', 'VISITOR', 'PUBLIC_SECTOR'],
    patterns: [
      /앱\s*스토어|앱스토어|구글\s*플레이|google\s*play|플레이\s*스토어/i,
    ],
    shortAnswer:
      '현재 앱스토어에 공개된 앱은 아닙니다. 기본 제공 방식은 QR이나 링크로 바로 여는 웹/PWA이고, 지원되는 환경에서는 홈 화면에 추가해 앱처럼 사용할 수 있습니다. 향후 필요하면 TWA(Trusted Web Activity) 같은 방식으로 패키징해 Google Play 등 앱스토어를 통한 배포 형태로 확장할 수 있지만, 현재 스토어 패키징이나 출시는 구현되어 있지 않습니다.',
    supportingConcepts: ['current web/PWA delivery', 'future optional TWA'],
    allowedClaims: ['현재 스토어 미출시', '향후 선택적 확장'],
    relatedQuestions: ['PWA가 뭐예요?', 'TWA가 뭐예요?'],
  }),
  item({
    intent: 'PWA_EXPLANATION',
    audiences: ['GENERAL', 'VISITOR', 'PUBLIC_SECTOR'],
    patterns: [/pwa|progressive\s*web\s*app/i],
    shortAnswer:
      'PWA(Progressive Web App)는 웹 기술로 만들어졌지만 지원되는 환경에서 홈 화면에 추가하고 앱처럼 실행할 수 있도록 하는 방식입니다. 웹의 접근성과 앱의 편리함을 함께 활용하려는 방식이라고 생각하면 쉽습니다. 이 서비스에서는 먼저 QR이나 링크로 바로 써보고, 원할 때 홈 화면에 추가하는 흐름에 해당합니다.',
    supportingConcepts: ['Progressive Web App', 'optional installation'],
    allowedClaims: ['지원 환경 차이'],
    relatedQuestions: ['앱스토어에서도 받을 수 있나요?', 'TWA가 뭐예요?'],
  }),
  item({
    intent: 'TWA_EXPLANATION',
    audiences: ['GENERAL', 'PUBLIC_SECTOR'],
    patterns: [/twa|trusted\s*web\s*activity/i],
    shortAnswer:
      'TWA(Trusted Web Activity)는 웹/PWA 서비스를 Android 앱 형태로 패키징해 Google Play 같은 앱스토어를 통해 배포할 때 활용할 수 있는 방식입니다. 사용자 입장에서는 앱스토어에서 설치한 Android 앱처럼 접근할 수 있지만 서비스의 핵심 웹 기술을 계속 활용할 수 있습니다. 이 서비스에는 현재 TWA 패키징이 구현되어 있지 않으며 향후 필요할 때 검토할 수 있는 선택지입니다.',
    supportingConcepts: ['Android packaging', 'future optional distribution'],
    allowedClaims: ['Android 설명', '현재 미구현'],
    relatedQuestions: ['현재는 어떻게 휴대폰에 넣나요?'],
  }),
  item({
    intent: 'PRIVACY_LOCATION',
    audiences: ['VISITOR', 'GENERAL'],
    patterns: [
      /내\s*위치|위치.*(?:사용|저장|권한)|개인정보|여행정보|닫았다.*열|다시\s*열/,
    ],
    shortAnswer:
      '위치는 브라우저에서 허용한 경우에만 가져오며, 거부하거나 사용할 수 없으면 그 상태로 동작합니다. 여행은 지역별 익명 TripSession으로 브라우저 localStorage에 저장되고, 저장 실패 시 같은 브라우저의 sessionStorage를 보조로 사용합니다. 여행 연속성을 위해 익명 ID와 개인정보를 줄인 여행 상태가 서버에 동기화될 수 있으며, 지역별 키로 분리됩니다. 자유 입력 원문은 TripSession 저장 과정에서 제거되지만 컨시어지 요청 처리용 서버 Runtime Context에는 입력 메시지가 저장되는 현재 구현이 있으므로 원문이 서버에 전혀 남지 않는다고 약속하지 않습니다.',
    supportingConcepts: [
      'permissioned geolocation',
      'TripSession',
      'anonymous sync',
      'regional isolation',
      'Runtime Context',
    ],
    allowedClaims: ['실제 저장 경계 공개'],
    relatedQuestions: ['새 여행을 시작하면 기존 여행은 어떻게 되나요?'],
  }),
  item({
    intent: 'PLATFORM_OVERVIEW',
    audiences: ['GENERAL'],
    patterns: [/무슨\s*서비스|무엇.*서비스|왜.*필요|어떤.*서비스|소개/],
    shortAnswer:
      '지역 AI 컨시어지는 범용 AI를 지역의 검증된 운영 정보와 방문자의 현재 여행 상황에 연결하는 플랫폼입니다. Local Concierge는 방문자의 다음 행동을 돕고, Regional Copilot은 지역 관리자의 데이터 검토를 돕습니다. 이 Guide Copilot은 그 구조와 필요성을 일반 방문자·업체·공공 관계자에게 설명합니다.',
    supportingConcepts: ['three surfaces', 'RDM', 'runtime context'],
    allowedClaims: ['현재 구현 역할'],
    relatedQuestions: [
      'ChatGPT와 무엇이 다른가요?',
      '업체에는 어떤 도움이 되나요?',
    ],
  }),
];

// Colloquial follow-up after “홈페이지인가요?”: “그럼 내가 어떻게 가져요?”
GUIDE_KNOWLEDGE.find((entry) => entry.intent === 'PHONE_ACCESS')?.patterns.push(
  /어떻게.*가져|홈\s*화면.*넣/i,
);
