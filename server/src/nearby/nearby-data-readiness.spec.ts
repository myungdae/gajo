import { REGIONAL_CANDIDATE_DATASETS } from '../regions/regional-candidate.registry';

describe('regional lodging data readiness', () => {
  const lodging = (regionId: string) =>
    REGIONAL_CANDIDATE_DATASETS[regionId].records.filter(
      (record) => record.entityType === 'ACCOMMODATION',
    );
  it('documents that Hapcheon currently has one coordinate-ready canonical lodging record', () => {
    const rows = lodging('hapcheon');
    expect(rows).toHaveLength(1);
    expect(
      rows.every(
        (row) =>
          Number.isFinite(row.latitude) &&
          Number.isFinite(row.longitude) &&
          row.category === 'ACCOMMODATION',
      ),
    ).toBe(true);
  });
  it('keeps coordinate-missing Okcheon camping records out of distance discovery', () => {
    const camping = lodging('okcheon').filter(
      (record) => record.accommodationType === 'CAMPING',
    );
    expect(camping.map((record) => record.canonicalLabelKo)).toEqual([
      '너와두리농촌캠핑장',
      '마로니에숲',
      '나드리캠핑장',
    ]);
    expect(
      camping.every(
        (record) => record.latitude == null && record.longitude == null,
      ),
    ).toBe(true);
  });
  it('does not invent lodging records for Gajo', () =>
    expect(lodging('gajo')).toEqual([]));
});
