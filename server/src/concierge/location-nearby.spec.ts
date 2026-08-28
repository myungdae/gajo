/* Test doubles intentionally cross Nest service boundaries. */
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConciergeService } from './concierge.service';

describe('GPS anchored concierge discovery', () => {
  const context = {
    createContext: jest.fn((input: any) =>
      Promise.resolve({
        context: { contextNo: 'location', operationUri: 'op', ...input },
        evidence: [],
        firedRules: [],
      }),
    ),
  };
  it('uses actual nearby provider results for a close mart request instead of tourism entities', async () => {
    const nearby = {
        search: jest.fn(() =>
          Promise.resolve([
            {
              id: 'mart-1',
              name: '현장 마트',
              category: 'MART_SUPERMARKET',
              roadAddress: '경남 합천군',
              lat: 35.52,
              lng: 128.01,
              distanceMeters: 120,
              contextualReasons: ['현재 위치에서 가까운 후보입니다.'],
              operatingMessage: '현재 운영 여부 확인 필요',
              placeUrl: 'https://place.map.kakao.com/1',
            },
          ]),
        ),
      },
      service = new ConciergeService(
        context as any,
        { run: jest.fn() } as any,
        {} as any,
        {
          get: () => ({ id: 'hapcheon' }),
          detectOutOfRegion: () => undefined,
        } as any,
        {} as any,
        undefined,
        undefined,
        undefined,
        nearby as any,
      ),
      result: any = await service.chat({
        regionId: 'hapcheon',
        rawMessage: '가까운 마트 찾아줘',
        inputMode: 'FREE_TEXT',
        latitude: 35.52,
        longitude: 128.01,
        locationAccuracy: 20,
        locationStatus: 'AVAILABLE',
      } as any);
    expect(nearby.search).toHaveBeenCalledWith(
      'MART_SUPERMARKET',
      35.52,
      128.01,
      1000,
      expect.anything(),
      'hapcheon',
    );
    expect(result.discovery).toMatchObject({
      relation: 'NEARBY',
      entities: [
        {
          programLabel: '현장 마트',
          distanceMeters: 120,
          operatingState: 'UNKNOWN',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/관광지|영업 중/);
  });
  it('requires confirmed usable location instead of falling back to registered regional entities', async () => {
    const nearby = { search: jest.fn() },
      service = new ConciergeService(
        context as any,
        { run: jest.fn() } as any,
        {} as any,
        {
          get: () => ({ id: 'hapcheon' }),
          detectOutOfRegion: () => undefined,
        } as any,
        {} as any,
        undefined,
        undefined,
        undefined,
        nearby as any,
      ),
      result: any = await service.chat({
        regionId: 'hapcheon',
        rawMessage: '가까운 마트 찾아줘',
        inputMode: 'FREE_TEXT',
        locationStatus: 'UNKNOWN',
      } as any);
    expect(result).toMatchObject({
      nearbyLocationRequired: true,
      recommendation: null,
    });
    expect(nearby.search).not.toHaveBeenCalled();
  });
  it('keeps rain context while using GPS cafe discovery', async () => {
    const nearby = { search: jest.fn(() => Promise.resolve([])) },
      service = new ConciergeService(
        context as any,
        { run: jest.fn() } as any,
        {} as any,
        {
          get: () => ({ id: 'hapcheon' }),
          detectOutOfRegion: () => undefined,
        } as any,
        {} as any,
        undefined,
        undefined,
        undefined,
        nearby as any,
      );
    await service.chat({
      regionId: 'hapcheon',
      rawMessage: '비가 와. 가까운 카페 찾아줘',
      inputMode: 'FREE_TEXT',
      weather: 'HEAVY_RAIN',
      latitude: 35.52,
      longitude: 128.01,
      locationAccuracy: 30,
      locationStatus: 'AVAILABLE',
    } as any);
    expect(nearby.search).toHaveBeenCalledWith(
      'CAFE',
      35.52,
      128.01,
      1000,
      expect.objectContaining({ weather: 'HEAVY_RAIN' }),
      'hapcheon',
    );
  });
  it.each([
    ['밥 먹고 싶어요', 'FOOD'],
    ['카페 가고 싶어요', 'CAFE'],
  ])(
    'returns multiple current-location candidates for %s',
    async (message, category) => {
      const nearby = {
          search: jest.fn(() =>
            Promise.resolve(
              [1, 2, 3].map((n) => ({
                id: `p${n}`,
                name: `후보 ${n}`,
                category,
                lat: 35.5 + n / 1000,
                lng: 128,
                distanceMeters: n * 100,
                contextualReasons: ['거리순 후보'],
                operatingMessage: '영업 여부 확인 필요',
              })),
            ),
          ),
        },
        service = new ConciergeService(
          context as any,
          { run: jest.fn() } as any,
          {} as any,
          {
            get: () => ({ id: 'hapcheon' }),
            detectOutOfRegion: () => undefined,
          } as any,
          {} as any,
          undefined,
          undefined,
          undefined,
          nearby as any,
        ),
        result: any = await service.chat({
          regionId: 'hapcheon',
          rawMessage: message,
          inputMode: 'FREE_TEXT',
          latitude: 35.5,
          longitude: 128,
          locationAccuracy: 20,
          locationStatus: 'AVAILABLE',
        } as any);
      expect(result.discovery.entities).toHaveLength(3);
      expect(result.serverTime.timeZone).toBe('Asia/Seoul');
      expect(nearby.search).toHaveBeenCalledWith(
        category,
        35.5,
        128,
        1000,
        expect.anything(),
        'hapcheon',
      );
    },
  );
});
