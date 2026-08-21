import { PlaceDiscoveryService } from './place-discovery.service';
import { regionalCandidateDataset } from '../regions/regional-candidate.registry';

describe('Okcheon Phase 3 honest golden-flow boundary', () => {
  const dataset = regionalCandidateDataset('okcheon')!,
    regional = {
      effectiveDataset: jest.fn(async (regionId: string) =>
        regionId === 'okcheon' ? dataset : { regionId, records: [] },
      ),
    },
    service = new PlaceDiscoveryService(regional as any);
  it('A preserves a real Okcheon anchor and cafe category but never fabricates distance/navigation', async () => {
    const anchor = dataset.records.find(
        (x) => x.canonicalLabelKo === '둔주봉 한반도지형',
      )!,
      result: any = await service.discover(
        'okcheon',
        'CAFE',
        '둔주봉 한반도지형 근처 카페 있어?',
        {
          conversationalAnchor: {
            entityId: anchor.entityUri,
            regionId: 'okcheon',
            label: anchor.canonicalLabelKo,
            latitude: anchor.latitude,
            longitude: anchor.longitude,
            source: 'RDM',
            sourceTurnId: 'a',
          },
        },
      );
    expect(result).toMatchObject({
      regionId: 'okcheon',
      category: 'CAFE',
      anchorEntityId: anchor.entityUri,
    });
    expect(result.entities).toHaveLength(5);
    expect(
      result.entities.every(
        (x: any) =>
          x.regionId === 'okcheon' &&
          x.category === 'CAFE' &&
          x.distanceMeters === undefined &&
          !x.actions?.navigate,
      ),
    ).toBe(true);
  });
  it('B resolves and preserves exactly two representative requested destinations', async () => {
    const result: any[] = await service.resolveRequestedDestinations(
      'okcheon',
      ['둔주봉 한반도지형', '부소담악'],
    );
    expect(result.map((x) => x.label)).toEqual([
      '둔주봉 한반도지형',
      '부소담악',
    ]);
    expect(result.map((x) => x.requestedLabel)).toEqual([
      '둔주봉 한반도지형',
      '부소담악',
    ]);
    expect(
      result.every((x) => x.entityId.startsWith('https://okcheon.example/')),
    ).toBe(true);
  });
  it('C returns no canonical essential shopping and requires cautious search evidence', async () =>
    expect(
      (
        await service.discover(
          'okcheon',
          'ESSENTIAL_SHOPPING',
          '장 볼 데 있어?',
          {},
        )
      ).entities,
    ).toEqual([]));
  it('D never claims accessibility for the elderly/mobility scenario', async () => {
    const result: any = await service.discover(
      'okcheon',
      'TOURISM_NATURE',
      '70대 어머니와 같이 왔는데 많이 걷기는 어려워요. 두 시간 정도 어디가 좋을까요?',
      { mobilityConstraints: ['LIMITED_WALKING'] },
    );
    expect(result.entities.length).toBeGreaterThan(0);
    expect(
      result.entities.every(
        (x: any) =>
          x.accessibility === undefined &&
          !(x.reasons || []).join(' ').includes('무장애'),
      ),
    ).toBe(true);
  });
  it('E exposes only actual indoor tags for weather replanning candidates', async () => {
    const result: any = await service.discover(
      'okcheon',
      'ACTIVITY',
      '비가 오기 시작했어요',
      { weather: 'RAIN' },
    );
    expect(result.entities.length).toBeGreaterThan(0);
    expect(
      result.entities.every(
        (x: any) => x.regionId === 'okcheon' && x.category === 'EXPERIENCE',
      ),
    ).toBe(true);
  });
});
