export const ACCOMMODATION_TYPES = [
  'HOTEL',
  'PENSION',
  'MOTEL',
  'MINBAK',
  'HANOK_STAY',
  'RESORT',
  'GLAMPING',
  'CAMPING',
  'AUTO_CAMPING',
  'CARAVAN',
  'FOREST_LODGE',
] as const;
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];
const REQUEST: [AccommodationType, RegExp][] = [
  ['AUTO_CAMPING', /오토\s*캠핑/],
  ['HANOK_STAY', /한옥\s*(?:스테이|숙소|체험)?/],
  ['FOREST_LODGE', /자연\s*휴양림|산림\s*휴양/],
  ['GLAMPING', /글램핑/],
  ['CARAVAN', /카라반/],
  ['CAMPING', /캠핑|야영/],
  ['PENSION', /펜션/],
  ['MINBAK', /민박/],
  ['MOTEL', /모텔/],
  ['HOTEL', /호텔/],
  ['RESORT', /리조트/],
];
export function requestedAccommodationType(message = '') {
  return REQUEST.find(([, pattern]) => pattern.test(message))?.[0];
}
export function recordAccommodationType(
  record: any,
): AccommodationType | undefined {
  const explicit =
    `${record.accommodationType || ''}`.toUpperCase() as AccommodationType;
  if (ACCOMMODATION_TYPES.includes(explicit)) return explicit;
  const corpus = [
    record.category,
    record.entityType,
    record.canonicalLabelKo,
    ...(record.tags || []),
  ].join(' ');
  return REQUEST.find(([, pattern]) => pattern.test(corpus))?.[0];
}
export const SEMANTIC_ACCOMMODATION_ALIGNMENT = Object.fromEntries(
  ACCOMMODATION_TYPES.map((type) => [
    type,
    {
      regionalType: type,
      rooSemantic: 'AccommodationFacility',
      parent: 'ACCOMMODATION',
      exkoConceptCandidate:
        type === 'HANOK_STAY'
          ? 'HanokStay'
          : type.replace(/_(.)/g, (_, x) => x),
      exkoAlignmentStatus: 'PENDING_VOCABULARY_IMPORT',
    },
  ]),
);
