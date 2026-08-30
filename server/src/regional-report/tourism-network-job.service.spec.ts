import {
  TourismNetworkJobService,
  NETWORK_REGIONS,
} from './tourism-network-job.service';

describe('TourismNetworkJobService', () => {
  it('recomputes deterministic rolling and grace-month snapshots before unlinking', async () => {
    const generate = jest.fn().mockResolvedValue({}),
      removeExpiredLinkage = jest.fn().mockResolvedValue({ modifiedCount: 2 }),
      service = new TourismNetworkJobService(
        { generate } as any,
        { removeExpiredLinkage } as any,
      ),
      now = new Date('2026-08-03T01:00:00Z');
    const result = await service.runDaily(now, 5);
    expect(generate).toHaveBeenCalledTimes(NETWORK_REGIONS.length * 2);
    expect(generate).toHaveBeenCalledWith(
      'hapcheon',
      'ROLLING_30D',
      undefined,
      now,
      5,
    );
    expect(generate).toHaveBeenCalledWith(
      'hapcheon',
      'MONTHLY',
      '2026-07',
      now,
      5,
    );
    expect(removeExpiredLinkage).toHaveBeenCalledWith(now);
    expect(
      generate.mock.invocationCallOrder[
        generate.mock.invocationCallOrder.length - 1
      ],
    ).toBeLessThan(removeExpiredLinkage.mock.invocationCallOrder[0]);
    expect(result.unlinkModified).toBe(2);
  });
  it('does not unlink redemption identities after a partial aggregation failure', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('aggregate failed')),
      removeExpiredLinkage = jest.fn(),
      service = new TourismNetworkJobService(
        { generate } as any,
        { removeExpiredLinkage } as any,
      );
    await expect(service.runDaily(new Date(), 5)).rejects.toThrow(
      'aggregate failed',
    );
    expect(removeExpiredLinkage).not.toHaveBeenCalled();
  });
});
