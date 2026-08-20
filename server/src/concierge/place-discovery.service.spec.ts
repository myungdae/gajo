import { PlaceDiscoveryService } from './place-discovery.service';

const lake = {
  entityUri: 'lake',
  canonicalLabelKo: '합천호',
  alternateLabels: ['합천 호수'],
  entityType: 'ATTRACTION',
  category: 'HAPCHEON_LAKE',
  tags: ['HAPCHEON_LAKE'],
  runtimeDataStatus: 'VERIFIED',
  latitude: 35.5305,
  longitude: 128.0324,
};
const pension = {
  entityUri: 'pension',
  canonicalLabelKo: '합천호 스마일펜션',
  alternateLabels: ['스마일펜션'],
  entityType: 'ACCOMMODATION',
  category: 'LODGING',
  tags: ['REST'],
  accommodationType: 'PENSION',
  runtimeDataStatus: 'VERIFIED',
  latitude: 35.524485899856,
  longitude: 128.01578179029,
};
const glamping={entityUri:'glamping',canonicalLabelKo:'검증된 글램핑 테스트 레코드',alternateLabels:[],entityType:'ACCOMMODATION',category:'LODGING',tags:[],accommodationType:'GLAMPING'};
const autoCamping={entityUri:'auto-camping',canonicalLabelKo:'검증된 오토캠핑 테스트 레코드',alternateLabels:[],entityType:'ACCOMMODATION',category:'LODGING',tags:[],accommodationType:'AUTO_CAMPING'};
const haeinsa = {
  entityUri: 'haeinsa',
  canonicalLabelKo: '해인사',
  alternateLabels: ['합천 해인사'],
  entityType: 'ATTRACTION',
  category: 'TOURISM_CULTURE',
  tags: ['TOURISM_NATURE'],
  runtimeDataStatus: 'VERIFIED',
  latitude: 35.8005687584,
  longitude: 128.0971196597,
};
const hwangmaesan = {
  entityUri: 'hwangmaesan',
  canonicalLabelKo: '황매산 군립공원',
  alternateLabels: ['황매산'],
  entityType: 'ATTRACTION',
  category: 'TOURISM_NATURE',
  tags: ['TOURISM_NATURE'],
  runtimeDataStatus: 'VERIFIED',
  latitude: 35.4822804994,
  longitude: 127.9831021731,
};
const coordinateUnknownAnchor = {
  entityUri: 'unknown-anchor',
  canonicalLabelKo: '무좌표 명소',
  alternateLabels: [],
  entityType: 'ATTRACTION',
  category: 'TOURISM_NATURE',
  tags: [],
  runtimeDataStatus: 'VERIFIED',
};
const lowful = {
  entityUri: 'urn:regional:hapcheon:lowful',
  canonicalLabelKo: '로우풀',
  alternateLabels: [],
  entityType: 'CAFE',
  category: 'CAFE',
  tags: ['CAFE', 'REST', 'HAPCHEON_LAKE'],
  runtimeDataStatus: 'VERIFIED',
  latitude: 35.525488,
  longitude: 128.018877,
  telephone: '0507-1333-2434',
  actions: {
    call: { phone: '0507-1333-2434' },
    navigate: { latitude: 35.525488, longitude: 128.018877 },
  },
};
const motorrad = {
  entityUri: 'motorrad',
  canonicalLabelKo: '카페 모토라드 합천',
  alternateLabels: [],
  entityType: 'CAFE',
  category: 'CAFE',
  tags: ['CAFE', 'HAPCHEON_LAKE'],
  runtimeDataStatus: 'VERIFIED',
  latitude: 35.5444275199,
  longitude: 128.0537942855,
};
const moida = {
  entityUri: 'moida',
  canonicalLabelKo: '카페모이다',
  alternateLabels: [],
  entityType: 'CAFE',
  category: 'CAFE',
  tags: ['CAFE', 'HAPCHEON_LAKE'],
  runtimeDataStatus: 'VERIFIED',
};
const restaurant = {
  entityUri: 'food',
  canonicalLabelKo: '북어마을',
  alternateLabels: [],
  entityType: 'RESTAURANT',
  category: 'FOOD',
  tags: ['FOOD', 'HAPCHEON_LAKE'],
  runtimeDataStatus: 'VERIFIED',
  actions: { call: { phone: '055' } },
};

describe('PlaceDiscoveryService', () => {
  const records = [
    lake,
    pension,
    haeinsa,
    hwangmaesan,
    coordinateUnknownAnchor,
    lowful,
    motorrad,
    moida,
    restaurant,
    glamping,
    autoCamping,
  ];
  const regional = {
    effectiveDataset: jest.fn(async (region: string) => ({
      regionId: region,
      records: region === 'hapcheon' ? records : [],
    })),
  };
  const service = new PlaceDiscoveryService(regional as any);

  it('ranks DB-only ACTIVE metadata without a name boost and preserves actions', async () => {
    const result: any = await service.discover(
      'hapcheon',
      'CAFE',
      '합천호 주변에서 전망 좋은 카페에 가고 싶어요.',
      { activityPreferences: ['CAFE', 'HAPCHEON_LAKE'] },
    );
    expect(result).toMatchObject({ anchorEntityId: 'lake', anchorLabel: '합천호' });
    expect(result.entities.map((item: any) => item.entityId)).toEqual([
      'urn:regional:hapcheon:lowful',
      'motorrad',
      'moida',
    ]);
    expect(result.entities[0].actions).toEqual(lowful.actions);
    expect(result.entities.every((item: any) => item.entityType === 'CAFE')).toBe(true);
  });

  it.each(['스마일펜션 근처 카페 알려줘.', '합천호 스마일펜션 근처 카페 알려줘.'])(
    'resolves %s to the same canonical coordinate anchor',
    async (message) => {
      const result: any = await service.discover('hapcheon', 'CAFE', message, {
        activityPreferences: ['CAFE', 'HAPCHEON_LAKE'],
        latitude: lake.latitude,
        longitude: lake.longitude,
      });
      expect(result).toMatchObject({ anchorEntityId: 'pension', anchorLabel: '합천호 스마일펜션' });
      expect(result.entities[0]).toMatchObject({
        entityId: 'urn:regional:hapcheon:lowful',
        distanceMeters: 301,
      });
      expect(result.entities[0].reasons).toContain('합천호 스마일펜션 기준 301m');
      expect(result.entities[1]).toMatchObject({ entityId: 'motorrad', distanceMeters: 4092 });
    },
  );

  it.each([
    ['해인사 근처 카페', 'CAFE', 'haeinsa'],
    ['황매산 근처 식당', 'FOOD', 'hwangmaesan'],
    ['합천호 주변 카페', 'CAFE', 'lake'],
  ] as const)('establishes an independent anchor for %s', async (message, category, anchorEntityId) => {
    const result: any = await service.discover('hapcheon', category, message, {
      latitude: pension.latitude,
      longitude: pension.longitude,
    });
    expect(result.anchorEntityId).toBe(anchorEntityId);
  });

  it('does not inherit the first explicit anchor in consecutive discovery queries', async () => {
    const first: any = await service.discover('hapcheon', 'CAFE', '합천호 주변 전망 좋은 카페', {});
    const second: any = await service.discover('hapcheon', 'CAFE', '스마일펜션 근처 카페', {
      activityPreferences: ['HAPCHEON_LAKE'],
      latitude: lake.latitude,
      longitude: lake.longitude,
    });
    expect(first.anchorEntityId).toBe('lake');
    expect(second.anchorEntityId).toBe('pension');
    expect(second.entities[0].distanceMeters).toBe(301);
  });

  it('does not fall back to session coordinates when the explicit anchor has no verified point', async () => {
    const result: any = await service.discover('hapcheon', 'CAFE', '무좌표 명소 근처 카페', {
      latitude: lake.latitude,
      longitude: lake.longitude,
    });
    expect(result.anchorEntityId).toBe('unknown-anchor');
    expect(result.entities.every((item: any) => item.distanceMeters === undefined)).toBe(true);
  });

  it('returns restaurants only and never leaks another region', async () => {
    const food: any = await service.discover(
      'hapcheon',
      'FOOD',
      '합천호 주변 저녁 먹을 곳 알려줘.',
      { activityPreferences: ['FOOD'] },
    );
    expect(food.entities.map((item: any) => item.entityId)).toEqual(['food']);
    expect((await service.discover('okcheon', 'CAFE', '근처 카페', {})).entities).toEqual([]);
  });
  it('strictly filters an explicit glamping request and excludes pensions',async()=>{const result:any=await service.discover('hapcheon','LODGING','합천 글램핑 추천해줘',{});expect(result.entities.map((x:any)=>x.entityId)).toEqual(['glamping']);expect(result.entities[0].accommodationType).toBe('GLAMPING')});
  it('distinguishes auto camping while generic lodging remains broad',async()=>{const exact:any=await service.discover('hapcheon','LODGING','오토캠핑 추천',{}),generic:any=await service.discover('hapcheon','LODGING','숙박 추천',{});expect(exact.entities.map((x:any)=>x.entityId)).toEqual(['auto-camping']);expect(generic.entities.map((x:any)=>x.entityId)).toEqual(expect.arrayContaining(['pension','glamping','auto-camping']))});
});
