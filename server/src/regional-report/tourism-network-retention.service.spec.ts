import { TourismNetworkRetentionService } from './tourism-network-retention.service';

describe('TourismNetworkRetentionService', () => {
  it('removes only expired redemption linkage without changing operational fields', async () => {
    const updateMany = jest.fn().mockResolvedValue({ modifiedCount: 3 }),
      service = new TourismNetworkRetentionService({ updateMany } as any),
      now = new Date('2026-08-30T00:00:00Z');
    await service.removeExpiredLinkage(now);
    expect(updateMany).toHaveBeenCalledWith(
      {
        linkExpiresAt: { $lte: now },
        $or: [
          { anonymousTripId: { $type: 'string' } },
          { idempotencyKey: { $type: 'string' } },
        ],
      },
      { $unset: { anonymousTripId: 1, idempotencyKey: 1 } },
    );
    await service.removeExpiredLinkage(now);
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany.mock.calls[1]).toEqual(updateMany.mock.calls[0]);
  });
});
