import { OKCHEON_MASTER_DATA } from './master-data';

describe('Okcheon Phase 2 minimum official dataset', () => {
  const byType = (type: string) =>
    OKCHEON_MASTER_DATA.filter((x) => x.entityType === type);
  it('covers all nine official scenic destinations without treating the list as ranking', () => {
    const names = [
      '둔주봉 한반도지형',
      '옛 37번 국도변 벚꽃길',
      '부소담악',
      '용암사 일출',
      '장령산자연휴양림',
      '장계관광지',
      '금강유원지',
      '향수호수길',
      '옥천구읍',
    ];
    for (const name of names)
      expect(OKCHEON_MASTER_DATA.some((x) => x.canonicalLabelKo === name)).toBe(
        true,
      );
    expect(JSON.stringify(OKCHEON_MASTER_DATA)).not.toMatch(
      /rank|sponsor|advertis|paid/i,
    );
  });
  it('keeps every fact tied to an official county source and does not claim whole-record verification', () => {
    expect(OKCHEON_MASTER_DATA).toHaveLength(33);
    for (const item of OKCHEON_MASTER_DATA) {
      expect(item.runtimeDataStatus).toBe('PARTIAL');
      expect(item.source).toMatchObject({
        sourceType: 'OFFICIAL_LOCAL_GOV',
        sourceName: '옥천군 문화관광',
        sourceUrl: expect.stringMatching(/^https:\/\//),
      });
      expect(item.lastVerifiedAt).toBe('2026-08-22');
    }
  });
  it('provides balanced identity coverage while retaining honest operational gaps', () => {
    expect(byType('RESTAURANT')).toHaveLength(8);
    expect(byType('CAFE')).toHaveLength(5);
    expect(byType('ACCOMMODATION')).toHaveLength(4);
    expect(byType('EXPERIENCE')).toHaveLength(5);
    expect(OKCHEON_MASTER_DATA.filter((x) => x.actions?.navigate)).toHaveLength(
      1,
    );
    expect(
      OKCHEON_MASTER_DATA.filter(
        (x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude),
      ),
    ).toHaveLength(1);
  });
  it('keeps the old-town concept non-operational and preserves separate cultural identities', () => {
    const area = OKCHEON_MASTER_DATA.find((x) =>
      x.entityUri.endsWith('#oldTownArea'),
    )!;
    expect(area).toMatchObject({
      entityType: 'AREA',
      category: 'PLACE_CONCEPT',
    });
    expect(area.actions).not.toHaveProperty('navigate');
    for (const id of [
      'jeongJiyongBirthplace',
      'jeongJiyongLiteratureMuseum',
      'yukYoungsooBirthplace',
      'traditionalCultureExperienceCenter',
    ])
      expect(
        OKCHEON_MASTER_DATA.some((x) => x.entityUri.endsWith(`#${id}`)),
      ).toBe(true);
  });
  it('does not fabricate essential-shopping coverage', () =>
    expect(
      OKCHEON_MASTER_DATA.some((x) =>
        /CONVENIENCE|MART|SUPERMARKET|GROCERY/.test(
          `${x.entityType} ${x.category}`,
        ),
      ),
    ).toBe(false));
});
