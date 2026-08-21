const NS = 'https://okcheon.example/ontology#';

export type FieldDemoRole =
  | 'LITERARY_CULTURE'
  | 'SCENIC'
  | 'FOOD'
  | 'CAFE'
  | 'LODGING'
  | 'ESSENTIAL_SHOPPING';

/** Verification-work scope only. It is never consumed by visitor ranking. */
export const OKCHEON_FIELD_DEMO_TARGETS = [
  ['oldTownArea', 'LITERARY_CULTURE'],
  ['jeongJiyongBirthplace', 'LITERARY_CULTURE'],
  ['jeongJiyongLiteratureMuseum', 'LITERARY_CULTURE'],
  ['traditionalCultureExperienceCenter', 'LITERARY_CULTURE'],
  ['dunjubongKoreanPeninsula', 'SCENIC'],
  ['busodamak', 'SCENIC'],
  ['janggyeTourismArea', 'SCENIC'],
  ['jangnyeongsanForest', 'LODGING'],
  ['daebakRestaurant', 'FOOD'],
  ['hanalcheon', 'FOOD'],
  ['janginUreong', 'FOOD'],
  ['coffeeTime', 'CAFE'],
] as const satisfies readonly (readonly [string, FieldDemoRole])[];

export const okcheonFieldDemoEntityIds = new Map(
  OKCHEON_FIELD_DEMO_TARGETS.map(([id, role]) => [`${NS}${id}`, role]),
);

/** Review proposals only; importing this configuration does not stage or approve data. */
export const OKCHEON_FIELD_DEMO_EVIDENCE_PROPOSALS = {
  [`${NS}busodamak`]: {
    field: 'coordinates',
    proposed: { latitude: 36.3522824857, longitude: 127.5637131168 },
    source: {
      sourceType: 'KTO_LINKED_DATA',
      sourceName: '한국관광공사 관광정보 Linked Open Data',
      sourceUrl: 'https://data.visitkorea.or.kr/linkedview/1940660',
    },
    whyNeeded: '부소담악 길찾기 활성화',
    approvalEffect: ['NAVIGATE'],
  },
} as const;
