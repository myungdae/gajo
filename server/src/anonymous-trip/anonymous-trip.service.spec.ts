import { BadRequestException } from '@nestjs/common';
import { AnonymousTripService } from './anonymous-trip.service';
import { AnonymousTripSchema } from './anonymous-trip.schema';
describe('AnonymousTripService', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  it('stores only region-owned privacy-safe state with a 90-day expiry', async () => {
    const updateOne = jest.fn(),
      service = new AnonymousTripService({ updateOne } as any),
      result: any = await service.sync({
        anonymousTripId: id,
        regionId: 'hapcheon',
        state: {
          anonymousTripId: id,
          regionId: 'hapcheon',
          rawMessage: 'private',
          itinerary: { steps: [{ entityId: 'place' }] },
        },
      });
    expect(updateOne).toHaveBeenCalledWith(
      { anonymousTripId: id, regionId: 'hapcheon' },
      expect.anything(),
      { upsert: true },
    );
    expect(JSON.stringify(result)).not.toContain('private');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 89 * 86400000,
    );
  });
  it('rejects cross-region ownership', async () => {
    const service = new AnonymousTripService({} as any);
    await expect(
      service.sync({
        anonymousTripId: id,
        regionId: 'hapcheon',
        state: { anonymousTripId: id, regionId: 'gajo' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('declares a Mongo TTL index', () => {
    expect(AnonymousTripSchema.indexes()).toContainEqual([
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    ]);
  });
});
