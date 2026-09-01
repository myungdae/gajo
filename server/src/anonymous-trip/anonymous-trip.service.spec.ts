import { BadRequestException } from '@nestjs/common';
import { AnonymousTripService } from './anonymous-trip.service';
import { AnonymousTripSchema } from './anonymous-trip.schema';
describe('AnonymousTripService', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const token = '223e4567-e89b-42d3-a456-426614174000';
  it('stores only region-owned privacy-safe state with a 90-day expiry', async () => {
    const updateOne = jest.fn(),
      service = new AnonymousTripService({ updateOne } as any, {} as any),
      result: any = await service.sync({
        anonymousTripId: id,
        regionId: 'hapcheon',
        state: {
          anonymousTripId: id,
          regionId: 'hapcheon',
          rawMessage: 'private',
          itinerary: { steps: [{ entityId: 'place' }] },
        },
      }, token);
    expect(updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ anonymousTripId: id, regionId: 'hapcheon' }),
      expect.anything(),
      { upsert: true },
    );
    expect(JSON.stringify(result)).not.toContain('private');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 89 * 86400000,
    );
  });
  it('rejects cross-region ownership', async () => {
    const service = new AnonymousTripService({} as any, {} as any);
    await expect(
      service.sync({
        anonymousTripId: id,
        regionId: 'hapcheon',
        state: { anonymousTripId: id, regionId: 'gajo' },
      }, token),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('deletes only an owner-matched trip, removes linkable raw events, and is idempotent',async()=>{const deleteOne=jest.fn().mockResolvedValueOnce({deletedCount:1}).mockResolvedValueOnce({deletedCount:0}),deleteMany=jest.fn(),service=new AnonymousTripService({deleteOne}as any,{deleteMany}as any);await expect(service.delete(id,'hapcheon',token)).resolves.toEqual({deleted:true});expect(deleteMany).toHaveBeenCalledWith({sessionId:id,regionId:'hapcheon'});await expect(service.delete(id,'hapcheon',token)).resolves.toEqual({deleted:false});expect(deleteMany).toHaveBeenCalledTimes(1)});
  it('declares a Mongo TTL index', () => {
    expect(AnonymousTripSchema.indexes()).toContainEqual([
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    ]);
  });
});
