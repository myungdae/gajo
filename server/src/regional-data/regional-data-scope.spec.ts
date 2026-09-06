import { RegionalDataService } from './regional-data.service';
import { RegionalDataController } from './regional-data.controller';

describe('regional manager list and KPI share authoritative query scope', () => {
  it.each(['gajo', 'hapcheon', 'okcheon'])('%s counts exclude every other region', async regionId => {
    const regions = ['gajo', 'hapcheon', 'okcheon'];
    const rows = regions.flatMap((r, i) => Array.from({ length: i + 1 }, (_, n) => ({ id: `${r}-${n}`, regionId: r, displayName: r, lifecycleStatus: 'ACTIVE', verificationStatus: 'VERIFIED' })));
    const find = jest.fn((q = {}) => {
      const query = { sort: () => query, lean: async () => rows.filter(r => Object.entries(q).every(([key, value]) => r[key] === value)) };
      return query;
    });
    const controller = new RegionalDataController(new RegionalDataService({ find } as any));
    const result = await controller.list({ regionId });
    expect(result.records).toHaveLength(regions.indexOf(regionId) + 1);
    expect(result.records.every(r => r.regionId === regionId)).toBe(true);
    expect(result.quality.totalActive).toBe(result.records.length);
    expect(result.quality.missingCoordinates).toBe(result.records.length);
    expect(find.mock.calls.every(([query]) => query.regionId === regionId)).toBe(true);
  });
});
