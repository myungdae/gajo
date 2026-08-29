import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AdminTokenGuard } from '../regional-data/admin-token.guard';
import { PublicWriteRateLimitGuard } from '../partner/public-write-security';

describe('AnalyticsController security boundary',()=>{
  let app:INestApplication;
  const summary={totalTripSessions:1,sessionsByRegion:[{label:'hapcheon',total:1}]};
  beforeAll(async()=>{process.env.ADMIN_WRITE_TOKEN='test-admin-token';const module=await Test.createTestingModule({controllers:[AnalyticsController],providers:[AdminTokenGuard,{provide:AnalyticsService,useValue:{summary:jest.fn().mockResolvedValue(summary),record:jest.fn()}}]}).overrideGuard(PublicWriteRateLimitGuard).useValue({canActivate:()=>true}).compile();app=module.createNestApplication();await app.init()});
  afterAll(async()=>{delete process.env.ADMIN_WRITE_TOKEN;await app.close()});
  it('rejects a missing administrator token',()=>request(app.getHttpServer()).get('/api/analytics/summary').expect(403));
  it('rejects an invalid administrator token',()=>request(app.getHttpServer()).get('/api/analytics/summary').set('x-admin-token','wrong').expect(403));
  it('returns the existing aggregate schema for a valid administrator token',()=>request(app.getHttpServer()).get('/api/analytics/summary').set('x-admin-token','test-admin-token').expect(200,summary));
});
