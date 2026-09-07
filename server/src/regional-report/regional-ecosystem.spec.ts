import { RegionalReportService } from './regional-report.service';

describe('Hapcheon policy-report ecosystem', () => {
  const service = new RegionalReportService({} as any, {} as any, {} as any);

  it('builds a read-only graph from actual Hapcheon master records', () => {
    const result: any = service.ecosystem('hapcheon');
    expect(result).toMatchObject({
      region: { id: 'hapcheon', name: '합천' },
      status: 'AVAILABLE',
      generatedFrom: 'HAPCHEON_MASTER_DATA',
      interpretation: 'ONTOLOGY_RELATIONSHIP_NOT_OBSERVED_PERFORMANCE',
    });
    expect(result.nodes.length).toBeGreaterThanOrEqual(18);
    expect(result.counts.verified).toBeGreaterThan(0);
    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '합천호', kind: 'ATTRACTION' }),
        expect.objectContaining({ label: '황매산 억새축제', kind: 'FESTIVAL' }),
        expect.objectContaining({ label: '합천호 스마일펜션', kind: 'STAY' }),
        expect.objectContaining({ label: '유성가든식당', kind: 'FOOD' }),
      ]),
    );
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relation: 'EXPLICIT_RELATED' }),
        expect.objectContaining({ relation: 'SAME_AREA' }),
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(/revenue|sales|estimated/i);
  });

  it('does not project Hapcheon data into another region', () => {
    expect(service.ecosystem('okcheon')).toEqual(
      expect.objectContaining({
        region: { id: 'okcheon' },
        status: 'PREPARING',
        nodes: [],
        edges: [],
      }),
    );
  });
});
