import { HttpException } from '@nestjs/common';
import { RegionalReportRateLimitGuard } from './regional-report-rate-limit.guard';

describe('RegionalReportRateLimitGuard', () => {
  it('limits repeated reads without retaining the credential itself', () => {
    const guard = new RegionalReportRateLimitGuard(),
      context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-regional-report-token': 'sensitive-token' },
          }),
        }),
      } as never;
    for (let index = 0; index < 60; index += 1)
      expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    expect(JSON.stringify(guard)).not.toContain('sensitive-token');
  });
});
