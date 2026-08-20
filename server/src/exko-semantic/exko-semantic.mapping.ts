export type AlignmentStatus =
  'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE' | 'UNRESOLVED' | 'CONFLICT';
const exko = 'http://sight.eventpool.kr/resource/';
export const ENTITY_ALIGNMENTS = [
  {
    exkoUri: exko + '합천호_스마일펜션',
    regionalEntityId:
      'https://hapcheon.example/ontology#hapcheonLakeSmilePension',
    regionId: 'hapcheon',
    status: 'HIGH_CONFIDENCE',
    evidence: [
      'exact normalized Korean name',
      'EXKO region relation to 합천군',
      'reviewed regional entity and aliases',
    ],
  },
  {
    exkoUri: exko + '카페_로우풀',
    regionalEntityId: 'urn:regional:hapcheon:lowful',
    regionId: 'hapcheon',
    status: 'HIGH_CONFIDENCE',
    evidence: [
      'normalized 로우풀 name',
      'EXKO cafe type',
      'reviewed Hapcheon RDM record',
    ],
  },
  {
    exkoUri: exko + '카페Lowful',
    regionalEntityId: 'urn:regional:hapcheon:lowful',
    regionId: 'hapcheon',
    status: 'POSSIBLE',
    evidence: ['name variant only; possible EXKO duplicate'],
  },
  {
    exkoUri: exko + '합천호',
    regionalEntityId: 'https://hapcheon.example/ontology#hapcheonLake',
    regionId: 'hapcheon',
    status: 'HIGH_CONFIDENCE',
    evidence: ['exact name', 'region and natural-resource class'],
  },
  {
    exkoUri: exko + '해인사',
    regionalEntityId: 'https://hapcheon.example/ontology#haeinsa',
    regionId: 'hapcheon',
    status: 'HIGH_CONFIDENCE',
    evidence: ['exact name', 'region and attraction class'],
  },
  {
    exkoUri: exko + '황매산',
    regionalEntityId: 'https://hapcheon.example/ontology#hwangmaesanCountyPark',
    regionId: 'hapcheon',
    status: 'POSSIBLE',
    evidence: ['RDM entity is the county park; EXKO entity is the mountain'],
  },
  {
    exkoUri: exko + '합천_영상테마파크',
    regionalEntityId:
      'https://hapcheon.example/ontology#hapcheonGardenThemePark',
    regionId: 'hapcheon',
    status: 'POSSIBLE',
    evidence: ['RDM alias matches but canonical scope differs'],
  },
] as const;
export const ACCOMMODATION_ALIGNMENTS = [
  { exkoUri: exko + '숙박', regionalType: 'ACCOMMODATION', relation: 'exact' },
  { exkoUri: exko + '호텔', regionalType: 'HOTEL', relation: 'exact' },
  { exkoUri: exko + '펜션_풀빌라', regionalType: 'PENSION', relation: 'close' },
  { exkoUri: exko + '모텔', regionalType: 'MOTEL', relation: 'exact' },
  {
    exkoUri: exko + '민박_게스트하우스',
    regionalType: 'MINBAK',
    relation: 'close',
  },
  {
    exkoUri: exko + 'B&B_한옥마을_게스트하우스',
    regionalType: 'HANOK_STAY',
    relation: 'close',
  },
  { exkoUri: exko + '리조트', regionalType: 'RESORT', relation: 'exact' },
  {
    exkoUri: exko + '글램핑_캠핑',
    regionalType: 'GLAMPING',
    relation: 'close',
  },
  { exkoUri: exko + '글램핑_캠핑', regionalType: 'CAMPING', relation: 'close' },
  {
    exkoUri: exko + '글램핑_캠핑',
    regionalType: 'AUTO_CAMPING',
    relation: 'broader',
  },
  {
    exkoUri: exko + '글램핑_캠핑',
    regionalType: 'CARAVAN',
    relation: 'broader',
  },
  { exkoUri: exko + '숙박', regionalType: 'FOREST_LODGE', relation: 'broader' },
] as const;
export const MAPPING_CLASSIFICATIONS = {
  classHierarchy: 'KEEP',
  objectProperties: 'KEEP',
  inverseOf: 'KEEP',
  defaultFacets: 'MAP',
  lat_long: 'TRANSFORM_VERIFY',
  Telephone: 'VERIFY',
  homepage: 'VERIFY',
  여행최적기: 'MAP',
  relationalNear: 'SEMANTIC_HINT',
  realTimeWeather: 'RUNTIME',
  visitorFatigue: 'ROO_ONLY',
  remainingTripTime: 'ROO_ONLY',
  runtimeDistance: 'RUNTIME_DERIVED',
} as const;
