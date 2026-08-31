import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { NearbyController } from './nearby.controller';
import { NearbyServiceError } from './nearby.service';

describe('NearbyController input policy', () => {
  const nearby = {
    searchProgressively: jest.fn(() => Promise.resolve({results:Array.from({ length: 40 }, (_, index) => ({ id: String(index) })),radius:3000,initialRadius:1000,nextRadius:5000,minimumCandidates:5,expanded:true,coverageStatus:'COMPLETE',providerCalls:6})),
    isConfigured: jest.fn(() => true),
  };
  const controller = new NearbyController(nearby as any);
  beforeEach(() => jest.clearAllMocks());
  it.each([
    [91, 128],
    [-91, 128],
    [35, 181],
    [35, -181],
  ])('rejects invalid coordinates', async (lat, lng) => {
    await expect(
      controller.discovery({
        category: 'CAFE',
        latitude: lat,
        longitude: lng,
        radius: 1000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each(['999', '2000', '5001', 'x'])(
    'allows only explicit policy radii',
    async (radius) => {
      await expect(
        controller.discovery({
          category: 'CAFE',
          latitude: 35.5,
          longitude: 128,
          radius: Number(radius),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('limits a successful response to 30 results and timestamps the search', async () => {
    const result = await controller.discovery({
      category: 'CAFE',
      latitude: 35.5,
      longitude: 128,
      radius: 3000,
      regionId: 'hapcheon',
    });
    expect(result.results).toHaveLength(30);
    expect(result.timeZone).toBe('Asia/Seoul');
    expect(Number.isFinite(Date.parse(result.searchedAt))).toBe(true);
    expect(result).toMatchObject({radius:3000,initialRadius:1000,nextRadius:5000,expanded:true});
  });
  it('allows the lodging policy maximum and leaves an omitted radius to automatic expansion',async()=>{await controller.discovery({category:'LODGING',latitude:35.5,longitude:128,radius:10000,regionId:'hapcheon'});await controller.discovery({category:'LODGING',latitude:35.5,longitude:128,regionId:'hapcheon'});expect(nearby.searchProgressively).toHaveBeenNthCalledWith(1,'LODGING',35.5,128,expect.anything(),'hapcheon',10000);expect(nearby.searchProgressively).toHaveBeenNthCalledWith(2,'LODGING',35.5,128,expect.anything(),'hapcheon',undefined)});
  it('returns a safe 400 contract for a category radius above its policy maximum',async()=>{nearby.searchProgressively.mockRejectedValueOnce(new NearbyServiceError('INVALID_REQUEST','선택한 분류는 3km까지 찾을 수 있습니다.'));await expect(controller.discovery({category:'FOOD',latitude:35.5,longitude:128,radius:5000,regionId:'hapcheon'})).rejects.toBeInstanceOf(BadRequestException)});
  it('rejects categories outside the allowlist', async () => {
    await expect(
      controller.discovery({
        category: 'DISCOUNT',
        latitude: 35.5,
        longitude: 128,
        radius: 1000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  /* eslint-disable prettier/prettier */
  it('requires a region for every public discovery request', async () => {
    await expect(controller.discovery({category:'CAFE',latitude:35.5,longitude:128,radius:1000})).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires an allowlisted region and usable accuracy before reverse geocoding',async()=>{await expect(controller.reverseGeocode({latitude:35.5,longitude:128,accuracy:20})).rejects.toBeInstanceOf(BadRequestException);await expect(controller.reverseGeocode({latitude:35.5,longitude:128,regionId:'hapcheon',accuracy:501})).rejects.toBeInstanceOf(BadRequestException)});
  /* eslint-enable prettier/prettier */
  it('does not expose coordinate-bearing nearby lookups as GET routes', () => {
    const source = readFileSync(__dirname + '/nearby.controller.ts', 'utf8');
    for (const route of [
      'reverse-geocode',
      'location-search',
      'discovery',
      'restaurants',
      'route',
      'navigation-links',
    ])
      expect(source).not.toContain(`@Get('${route}')`);
    expect(source).toContain("@Get('status')");
    expect(source).not.toContain('origin: { lat, lng');
  });
});
