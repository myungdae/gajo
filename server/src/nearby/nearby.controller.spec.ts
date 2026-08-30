import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { NearbyController } from './nearby.controller';

describe('NearbyController input policy', () => {
  const nearby = {
    search: jest.fn(() =>
      Promise.resolve(
        Array.from({ length: 40 }, (_, index) => ({ id: String(index) })),
      ),
    ),
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
    'allows only explicit 1, 3, or 5km radii',
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
  });
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
