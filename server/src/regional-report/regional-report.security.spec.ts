import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { AdminTokenGuard } from '../regional-data/admin-token.guard';

describe('Regional report write isolation', () => {
  it('public analytics rejects a fabricated BENEFIT_USE_CONFIRMED event', async () => {
    const create = jest.fn(),
      service = new AnalyticsService({ create } as any);
    await expect(
      service.record({
        eventType: 'BENEFIT_USE_CONFIRMED',
        sessionId: 's1',
        regionId: 'hapcheon',
        metadata: { entityId: 'invented' },
      }),
    ).resolves.toEqual({ accepted: false });
    expect(create).not.toHaveBeenCalled();
  });
  it('regional read credentials do not authorize admin write guards', () => {
    process.env.ADMIN_WRITE_TOKEN = 'admin-only-secret';
    const request = {
      headers: {
        'x-regional-report-token': 'regional-read-only-secret-value-123',
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    expect(() => new AdminTokenGuard().canActivate(context)).toThrow(
      ForbiddenException,
    );
    delete process.env.ADMIN_WRITE_TOKEN;
  });
});
