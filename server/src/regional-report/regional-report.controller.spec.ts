import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RegionalReportController } from './regional-report.controller';
import { RegionalReportGuard } from './regional-report.guard';
import { RegionalReportService } from './regional-report.service';

describe('RegionalReportController boundary', () => {
  let app: INestApplication;
  const report = jest.fn(async (regionId: string, period: string) => ({
    region: { id: regionId },
    period: { key: period },
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
        { provide: RegionalReportService, useValue: { report } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
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
});
