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
  hapcheon: [
    {
      displayName: '황매산',
      canonicalEntityId:
        'https://hapcheon.example/ontology#hwangmaesanCountyPark',
      expectedCategory: 'TOURISM_NATURE',
      aliases: ['황매산 군립공원'],
    },
    {
      displayName: '합천영상테마파크',
      canonicalEntityId:
        'https://hapcheon.example/ontology#hapcheonGardenThemePark',
      expectedCategory: 'TOURISM_NATURE',
      aliases: ['합천 영상테마파크', '합천 정원테마파크'],
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
