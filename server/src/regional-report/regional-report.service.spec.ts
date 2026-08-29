import {
  RegionalReportService,
  minimumCellSize,
  safeCell,
  seoulWindow,
} from './regional-report.service';
const model = (rows: any[]) => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(rows) })),
});
describe('RegionalReportService', () => {
  it('uses fixed Seoul calendar windows', () => {
    const now = new Date('2026-08-30T05:00:00Z');
    expect(seoulWindow('today', now)).toEqual({
      start: new Date('2026-08-29T15:00:00Z'),
      end: new Date('2026-08-30T15:00:00Z'),
    });
    expect(seoulWindow('7d', now).start).toEqual(
      new Date('2026-08-23T15:00:00Z'),
    );
    expect(seoulWindow('30d', now).start).toEqual(
      new Date('2026-07-31T15:00:00Z'),
    );
  });
  it('suppresses detail cells below the configured threshold and preserves zero top-line values', () => {
    expect(safeCell(4, 5)).toEqual({ status: 'SUPPRESSED', label: '5건 미만' });
    expect(safeCell(5, 5)).toEqual({ status: 'AVAILABLE', total: 5 });
  });
  it('uses a bounded conservative minimum cell size', () => {
    for (const raw of ['0', '-1', '1', '1.5', '101', 'oops']) {
      process.env.REGIONAL_REPORT_MIN_CELL_SIZE = raw;
      expect(minimumCellSize()).toBe(5);
    }
    process.env.REGIONAL_REPORT_MIN_CELL_SIZE = '8';
    expect(minimumCellSize()).toBe(8);
    delete process.env.REGIONAL_REPORT_MIN_CELL_SIZE;
  });
  it('returns aggregate fields only and keeps unsupported field stages distinct from zero', async () => {
    const events = [
        {
          eventType: 'SESSION_STARTED',
          sessionId: 's1',
          regionId: 'hapcheon',
          metadata: {},
        },
        {
          eventType: 'RECOMMENDATION_SHOWN',
          sessionId: 's1',
          regionId: 'hapcheon',
          metadata: {},
        },
      ],
      service = new RegionalReportService(
        model(events) as any,
        model([]) as any,
        model([]) as any,
      ),
      result: any = await service.report(
        'hapcheon',
        '7d',
        new Date('2026-08-30T05:00:00Z'),
      );
    expect(result.summary).toMatchObject({
      anonymousSessions: 1,
      aiGuideStarts: 1,
      recommendationImpressions: 1,
      movementIntent: 0,
    });
    expect(result.funnel[2].status).toBe('PREPARING');
    expect(JSON.stringify(result)).not.toMatch(
      /sessionId|anonymousTripId|latitude|longitude|createdAt|userAgent|ipAddress|events/,
    );
  });
  it('queries only the authenticated region and rejects flexible periods', async () => {
    const events = model([]),
      service = new RegionalReportService(
        events as any,
        model([]) as any,
        model([]) as any,
      );
    await service.report('okcheon', 'today');
    expect(events.find).toHaveBeenCalledWith(
      expect.objectContaining({ regionId: 'okcheon' }),
    );
    await expect(service.report('okcheon', '2d')).rejects.toThrow();
  });
  it('excludes activities from non-public partners and exposes no raw suppressed value', async () => {
    const activities = [
        {
          eventType: 'QR_VISIT_CONFIRMED',
          partnerId: 'draft',
          regionId: 'hapcheon',
        },
        {
          eventType: 'BENEFIT_USE_CONFIRMED',
          partnerId: 'live',
          regionId: 'hapcheon',
        },
      ],
      partners = [
        {
          partnerId: 'live',
          canonicalEntityId: 'stable-live',
          displayName: '공개 업소',
        },
      ],
      service = new RegionalReportService(
        model([]) as any,
        model(activities) as any,
        model(partners) as any,
      ),
      result: any = await service.report('hapcheon', '7d');
    expect(result.funnel[2].total).toBe(0);
    expect(result.funnel[3]).toMatchObject({ total: 1, supported: true });
    expect(result.partners[0].verifiedUses).toEqual({
      status: 'SUPPRESSED',
      label: '5건 미만',
    });
    expect(JSON.stringify(result.partners[0].verifiedUses)).not.toContain(
      '"total":1',
    );
  });
});
