import { REGIONAL_CANDIDATE_DATASETS } from '../regions/regional-candidate.registry';
import { PlaceDiscoveryService } from './place-discovery.service';

const regional = {
  effectiveDataset: jest.fn(async (regionId: string) =>
    REGIONAL_CANDIDATE_DATASETS[regionId],
  ),
};
const service = new PlaceDiscoveryService(regional as any);

const cases = [
  {
    regionId: 'gajo',
    canonical: '거창 항노화힐링랜드',
    compact: '거창항노화힐링랜드',
    alias: '항노화자연휴양림',
    entityId: 'https://gajo-wellness.kr/ontology#antiAgingHealingLand',
  },
  {
    regionId: 'hapcheon',
    canonical: '합천 영상테마파크',
    compact: '합천영상테마파크',
    alias: '영상테마파크',
    entityId: 'https://hapcheon.example/ontology#hapcheonVideoThemePark',
  },
  {
    regionId: 'okcheon',
    canonical: '둔주봉 한반도지형',
    compact: '둔주봉한반도지형',
    alias: '둔주봉',
    entityId: 'https://okcheon.example/ontology#dunjubongKoreanPeninsula',
  },
] as const;

describe.each(cases)('$regionId exact-place contract', (fixture) => {
  it.each([
    ['official name', fixture.canonical],
    ['space-free name', fixture.compact],
    ['registered alias', fixture.alias],
  ])('resolves %s through the same canonical matcher', async (_kind, query) => {
    await expect(
      service.resolveExactPlaceIntent(fixture.regionId, query),
    ).resolves.toMatchObject({ entityId: fixture.entityId });
  });

  it('returns the requested place itself for 찾아줘', async () => {
    const intent = await service.resolveExactPlaceIntent(
      fixture.regionId,
      `${fixture.alias} 찾아줘`,
    );
    expect(intent).toMatchObject({ entityId: fixture.entityId });
    const result: any = await service.discover(
      fixture.regionId,
      intent!.category,
      `${fixture.alias} 찾아줘`,
      {},
    );
    expect(result.entities[0]).toMatchObject({
      entityId: fixture.entityId,
      programLabel: fixture.canonical,
    });
  });

  it('keeps the named place as an anchor for 주변 관광지', async () => {
    const result: any = await service.discover(
      fixture.regionId,
      'TOURISM_NATURE',
      `${fixture.alias} 주변 관광지`,
      { preferCloser: true },
    );
    expect(result).toMatchObject({
      anchorEntityId: fixture.entityId,
      anchorLabel: fixture.canonical,
      relation: 'NEARBY',
    });
    expect(result.entities.map((item: any) => item.entityId)).not.toContain(
      fixture.entityId,
    );
  });

  it('keeps exact identity ahead of distance and recommendation ranking', async () => {
    const intent = await service.resolveExactPlaceIntent(
      fixture.regionId,
      `${fixture.canonical} 찾아줘`,
    );
    const result: any = await service.discover(
      fixture.regionId,
      intent!.category,
      `${fixture.canonical} 찾아줘`,
      { latitude: 0, longitude: 0, preferCloser: true },
    );
    expect(result.entities[0].entityId).toBe(fixture.entityId);
    expect(result.entities[0].reasons).toContain('요청한 장소명과 정확히 일치');
  });
});

test('aliases remain isolated to the active regional dataset', async () => {
  for (const fixture of cases) {
    for (const other of cases.filter((item) => item.regionId !== fixture.regionId))
      await expect(
        service.resolveExactPlaceIntent(other.regionId, `${fixture.alias} 찾아줘`),
      ).resolves.toBeUndefined();
  }
});

test('the active region selects its own canonical when a common alias is shared', async () => {
  const shared = new PlaceDiscoveryService({
    effectiveDataset: jest.fn(async (regionId: string) => ({
      regionId,
      records: [
        {
          entityUri: `urn:${regionId}:central-park`,
          canonicalLabelKo: `${regionId} 중앙공원`,
          alternateLabels: ['중앙공원'],
          entityType: 'ATTRACTION',
          category: 'TOURISM_NATURE',
          tags: ['TOURISM_NATURE'],
          runtimeDataStatus: 'VERIFIED',
        },
      ],
    })),
  } as any);

  await expect(shared.resolveExactPlaceIntent('region-a', '중앙공원 찾아줘'))
    .resolves.toMatchObject({ entityId: 'urn:region-a:central-park' });
  await expect(shared.resolveExactPlaceIntent('region-b', '중앙공원 찾아줘'))
    .resolves.toMatchObject({ entityId: 'urn:region-b:central-park' });
});

const collisionService=(records:any[])=>new PlaceDiscoveryService({effectiveDataset:jest.fn(async()=>({regionId:'region-a',records}))} as any);
test('official names outrank aliases with the same normalized text',async()=>{
  const resolver=collisionService([{entityUri:'urn:a:alias',canonicalLabelKo:'동쪽 문화공원',alternateLabels:['중앙 공원'],entityType:'ATTRACTION',category:'TOURISM_NATURE'},{entityUri:'urn:a:official',canonicalLabelKo:'중앙공원',alternateLabels:[],entityType:'ATTRACTION',category:'TOURISM_NATURE'}]);
  await expect(resolver.resolveExactPlaceIntent('region-a','중앙 공원 찾아줘')).resolves.toMatchObject({status:'RESOLVED',entityId:'urn:a:official'});
});
test('colliding aliases are ambiguous instead of selecting the first canonical',async()=>{
  const resolver=collisionService(['one','two'].map(id=>({entityUri:`urn:a:${id}`,canonicalLabelKo:`${id} 문화공원`,alternateLabels:['중앙공원'],entityType:'ATTRACTION',category:'TOURISM_NATURE'})));
  await expect(resolver.resolveExactPlaceIntent('region-a','중앙공원 찾아줘')).resolves.toMatchObject({status:'AMBIGUOUS',candidates:expect.arrayContaining([{entityId:'urn:a:one',label:'one 문화공원'},{entityId:'urn:a:two',label:'two 문화공원'}])});
  await expect(resolver.resolveRequestedDestinations('region-a',['중앙공원'])).resolves.toEqual([expect.objectContaining({resolved:false,ambiguity:{candidateEntityIds:['urn:a:one','urn:a:two']}})]);
});
