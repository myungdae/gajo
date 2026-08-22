import { PlaceDiscoveryService } from '../concierge/place-discovery.service';
import { ExkoSemanticAdapter } from '../exko-semantic/exko-semantic.service';
import { regionalCandidateDataset } from '../regions/regional-candidate.registry';
import { RegionConfigService } from './region-config.service';

describe('three-region golden isolation', () => {
  const regional = {
    effectiveDataset: jest.fn(async (regionId: string) =>
      regionalCandidateDataset(regionId),
    ),
  };
  it('keeps Hapcheon Core, Gajo PLACE_CONCEPT and Okcheon EXKO results region-pure in one run', async () => {
    const discovery = new PlaceDiscoveryService(
        regional as any,
        undefined,
        undefined,
        undefined,
        new RegionConfigService(),
      ),
      [hapcheon] = await discovery.resolveRequestedDestinations('hapcheon', [
        '합천영상테마파크',
      ]),
      [gajo] = await discovery.resolveRequestedDestinations('gajo', [
        '가조온천',
      ]),
      okcheonDataset = regionalCandidateDataset('okcheon')!,
      okcheon = new ExkoSemanticAdapter({ get: () => 'true' } as any).semanticJourney(
        'okcheon',
        '정지용 시인과 관련된 곳을 둘러보고 옥천다운 점심도 먹고 싶어요.',
        okcheonDataset.records,
      );
    expect(hapcheon.entityId).toContain('hapcheon');
    expect(gajo).toMatchObject({
      entityId: 'https://gajo-wellness.kr/semantic#gajoHotSpringArea',
      entityType: 'PLACE_CONCEPT',
      resolved: false,
    });
    expect(okcheon.itinerary.every((x: any) => x.entityId.includes('okcheon'))).toBe(true);
    expect(JSON.stringify(hapcheon)).not.toMatch(/okcheon|gajo-wellness/);
    expect(JSON.stringify(gajo)).not.toMatch(/okcheon|hapcheon/);
    expect(JSON.stringify(okcheon)).not.toMatch(/hapcheon|gajo-wellness/);
  });
});
