import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RegionalReportGuard } from './regional-report.guard';
const context = (token?: string, regionId?: string) => {
  const request = {
    headers: token ? { 'x-regional-report-token': token } : {},
    query: regionId ? { regionId } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
};
describe('RegionalReportGuard', () => {
  const guard = new RegionalReportGuard();
  beforeEach(
    () =>
      (process.env.REGIONAL_REPORT_CREDENTIALS_JSON = JSON.stringify([
        { regionId: 'hapcheon', token: 'hapcheon-read-token-12345678901234' },
        { regionId: 'okcheon', token: 'okcheon-read-token-12345678901234' },
      ])),
  );
  afterEach(() => delete process.env.REGIONAL_REPORT_CREDENTIALS_JSON);
  it('fails closed for missing, invalid, admin, and cross-region credentials', () => {
    for (const c of [
      context(),
      context('wrong-token-value'),
      context('admin-write-token'),
      context('hapcheon-read-token-12345678901234', 'okcheon'),
    ])
      expect(() => guard.canActivate(c)).toThrow(ForbiddenException);
  });
  it('scopes each valid credential on the server', () => {
    for (const [token, region] of [
      ['hapcheon-read-token-12345678901234', 'hapcheon'],
      ['okcheon-read-token-12345678901234', 'okcheon'],
    ]) {
      const c = context(token),
        req = c.switchToHttp().getRequest() as any;
      expect(guard.canActivate(c)).toBe(true);
      expect(req.regionalReportAccess.regionId).toBe(region);
    }
  });
  it('fails closed for missing or malformed config', () => {
    delete process.env.REGIONAL_REPORT_CREDENTIALS_JSON;
    expect(() =>
      guard.canActivate(context('hapcheon-read-token-12345678901234')),
    ).toThrow(ForbiddenException);
    process.env.REGIONAL_REPORT_CREDENTIALS_JSON = '{';
    expect(() =>
      guard.canActivate(context('hapcheon-read-token-12345678901234')),
    ).toThrow(ForbiddenException);
  });
  it.each([
    [[{ regionId: 'hapcheon', token: ' short ' }]],
    [[{ regionId: 'unknown', token: 'x'.repeat(32) }]],
    [
      [
        { regionId: 'hapcheon', token: 'x'.repeat(32) },
        { regionId: 'okcheon', token: 'x'.repeat(32) },
      ],
    ],
    [
      [
        { regionId: 'hapcheon', token: 'x'.repeat(32) },
        { regionId: 'hapcheon', token: 'y'.repeat(32) },
      ],
    ],
  ])(
    'fails closed for invalid or duplicate credential configuration',
    (config) => {
      process.env.REGIONAL_REPORT_CREDENTIALS_JSON = JSON.stringify(config);
      expect(() => guard.canActivate(context('x'.repeat(32)))).toThrow(
        ForbiddenException,
      );
    },
  );
});
