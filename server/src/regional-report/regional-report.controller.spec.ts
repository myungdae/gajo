import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RegionalReportController } from './regional-report.controller';
import { RegionalReportGuard } from './regional-report.guard';
import { RegionalReportRateLimitGuard } from './regional-report-rate-limit.guard';
import { RegionalReportService } from './regional-report.service';
import { TourismNetworkAggregationService } from './tourism-network-aggregation.service';

describe('RegionalReportController boundary', () => {
  let app: INestApplication;
  const report = jest.fn((regionId: string, period: string) => ({
      region: { id: regionId },
      period: { key: period },
    })),
    latestPublicRolling = jest.fn((regionId: string) => ({
      regionId,
      windowStart: new Date('2026-07-01T15:00:00Z'),
      windowEndExclusive: new Date('2026-07-31T15:00:00Z'),
      snapshotAt: new Date('2026-08-01T00:00:00Z'),
      minimumCellSize: 5,
      released: { status: 'PREPARING', nodes: [], edges: [], stageTotals: [] },
    }));
  beforeAll(async () => {
    process.env.REGIONAL_REPORT_CREDENTIALS_JSON = JSON.stringify([
      { regionId: 'hapcheon', token: 'h'.repeat(32) },
      { regionId: 'okcheon', token: 'o'.repeat(32) },
    ]);
    const module = await Test.createTestingModule({
      controllers: [RegionalReportController],
      providers: [
        RegionalReportGuard,
        RegionalReportRateLimitGuard,
        { provide: RegionalReportService, useValue: { report } },
        {
          provide: TourismNetworkAggregationService,
          useValue: { latestPublicRolling },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  it('protects the fixed 30-day network with the same credential-derived region', async () => {
    await request(app.getHttpServer())
      .get('/api/regional-report/network')
      .expect(403);
    const response = await request(app.getHttpServer())
      .get('/api/regional-report/network')
      .set('x-regional-report-token', 'h'.repeat(32))
      .expect(200);
    expect(response.body).toMatchObject({
      region: { id: 'hapcheon' },
      period: { key: '30d', timeZone: 'Asia/Seoul' },
    });
    expect(latestPublicRolling).toHaveBeenCalledWith('hapcheon');
    expect(JSON.stringify(response.body)).not.toMatch(
      /sourceRevision|eventCount|activityCount|distinctSession|jobId|sessionId|anonymousTripId|redemptionId|eventId|coordinates|latitude|longitude|query|raw/i,
    );
  });
  it('keeps the network period fixed and rejects query scope mismatch', async () => {
    await request(app.getHttpServer())
      .get('/api/regional-report/network?period=7d')
      .set('x-regional-report-token', 'h'.repeat(32))
      .expect(200)
      .expect((response) => {
        expect((response.body as { period: { key: string } }).period.key).toBe(
          '30d',
        );
      });
    await request(app.getHttpServer())
      .get('/api/regional-report/network?regionId=okcheon')
      .set('x-regional-report-token', 'h'.repeat(32))
      .expect(403);
  });
  afterAll(async () => {
    delete process.env.REGIONAL_REPORT_CREDENTIALS_JSON;
    await app.close();
  });
  it('rejects missing, invalid, and cross-region access', async () => {
    await request(app.getHttpServer()).get('/api/regional-report').expect(403);
    await request(app.getHttpServer())
      .get('/api/regional-report')
      .set('x-regional-report-token', 'x'.repeat(32))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/regional-report?regionId=okcheon')
      .set('x-regional-report-token', 'h'.repeat(32))
      .expect(403);
  });
  it('derives region scope from the credential', async () => {
    await request(app.getHttpServer())
      .get('/api/regional-report?period=30d')
      .set('x-regional-report-token', 'h'.repeat(32))
      .expect(200, { region: { id: 'hapcheon' }, period: { key: '30d' } });
    expect(report).toHaveBeenCalledWith('hapcheon', '30d');
  });
  it('accepts a matching canonical region and ignores body scope', async () => {
    await request(app.getHttpServer())
      .get('/api/regional-report?period=7d&regionId=hapcheon')
      .send({ regionId: 'okcheon' })
      .set('x-regional-report-token', 'h'.repeat(32))
      .expect(200, { region: { id: 'hapcheon' }, period: { key: '7d' } });
    expect(report).toHaveBeenCalledWith('hapcheon', '7d');
  });
});
