// Coverage-quality metadata only. Core designation is never a ranking boost,
// advertisement, sponsorship, or permission to bypass discovery type safety.
export const INITIAL_CORE_DESTINATIONS: Record<
  string,
  Array<{
    displayName: string;
    canonicalEntityId?: string;
    expectedCategory: string;
    aliases?: string[];
  }>
> = {
  gajo: [
    {
      displayName: '거창창포원',
      canonicalEntityId:
        'https://gajo-wellness.kr/ontology#geochangChangpowon',
      expectedCategory: 'TOURISM_NATURE',
      aliases: ['창포원', '거창 창포원'],
    },
    {
      displayName: '수승대',
      canonicalEntityId: 'https://gajo-wellness.kr/ontology#suseungdae',
      expectedCategory: 'TOURISM_NATURE',
      aliases: ['수승대관광지', '거창 수승대'],
    },
  ],
  hapcheon: [
    {
      displayName: '황매산',
      canonicalEntityId:
        'https://hapcheon.example/ontology#hwangmaesanCountyPark',
      expectedCategory: 'TOURISM_NATURE',
      aliases: ['황매산 군립공원'],
    },
    {
      displayName: '합천 영상테마파크',
      canonicalEntityId:
        'https://hapcheon.example/ontology#hapcheonVideoThemePark',
      expectedCategory: 'TOURISM_NATURE',
      aliases: ['합천 영상테마파크'],
    },
    {
      displayName: '황계폭포',
      expectedCategory: 'TOURISM_NATURE',
      aliases: ['황계 폭포'],
    },
    {
      displayName: '금성산',
      expectedCategory: 'TOURISM_NATURE',
      aliases: ['합천 금성산'],
    },
  ],
};
