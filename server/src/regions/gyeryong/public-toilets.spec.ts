import { GYERYONG_PUBLIC_TOILETS } from './public-toilets';

describe('Gyeryong public restroom dataset', () => {
  it('keeps exactly the 67 official July 2020 records separate from demo rows', () => {
    expect(GYERYONG_PUBLIC_TOILETS).toHaveLength(67);
    expect(GYERYONG_PUBLIC_TOILETS[0].entityUri).toContain('publicToilet-101');
    expect(GYERYONG_PUBLIC_TOILETS.at(-1)?.entityUri).toContain('publicToilet-167');
    expect(GYERYONG_PUBLIC_TOILETS.every((row) => row.runtimeDataStatus === 'PARTIAL')).toBe(true);
    expect(GYERYONG_PUBLIC_TOILETS.every((row) => row.category === 'PUBLIC_TOILET')).toBe(true);
  });

  it('does not overstate coordinate precision or current operation', () => {
    for (const row of GYERYONG_PUBLIC_TOILETS) {
      expect(row.coordinateSource).toMatchObject({ sourceType: 'ADDRESS_GEOCODE_ESTIMATE', precision: 'ESTIMATED' });
      expect(row.source).toMatchObject({ sourceType: 'OFFICIAL_LOCAL_GOV', datasetDate: '2020-07' });
      expect(row.accessNotice).toMatch(/현재 운영 여부.*정확한 위치/);
    }
  });
});
