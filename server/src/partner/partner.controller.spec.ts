import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  PartnerAdminController,
  PartnerController,
} from './partner.controller';
import { PartnerService } from './partner.service';
import { AdminTokenGuard } from '../regional-data/admin-token.guard';
import {
  InMemoryPublicWriteRateLimitStore,
  PUBLIC_WRITE_RATE_LIMIT_STORE,
  PublicClientIdentityService,
  PublicWriteRateLimitGuard,
} from './public-write-security';

describe('Partner HTTP API boundaries', () => {
  let app: INestApplication;
  const service: any = {
    apply: jest.fn(),
    publicEntry: jest.fn(),
    recordEntry: jest.fn(),
    visit: jest.fn(),
    requestRedemption: jest.fn(),
    createBenefit: jest.fn(),
    confirm: jest.fn(),
    metrics: jest.fn(),
    qrAsset: jest.fn(),
    recommendationShown: jest.fn(),
    recommendationsShownForEntities: jest.fn(),
    adminList: jest.fn(),
    adminPartner: jest.fn(),
    adminBenefit: jest.fn(),
    adminIssueManagementKey: jest.fn(),
    adminRevokeManagementKey: jest.fn(),
  };
  beforeAll(async () => {
    process.env.ADMIN_WRITE_TOKEN = 'admin-secret';
    const module = await Test.createTestingModule({
      controllers: [PartnerController, PartnerAdminController],
      providers: [
        { provide: PartnerService, useValue: service },
        AdminTokenGuard,
        PublicClientIdentityService,
        PublicWriteRateLimitGuard,
        InMemoryPublicWriteRateLimitStore,
        {
          provide: PUBLIC_WRITE_RATE_LIMIT_STORE,
          useExisting: InMemoryPublicWriteRateLimitStore,
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    delete process.env.ADMIN_WRITE_TOKEN;
  });
  beforeEach(() => jest.clearAllMocks());
  it('routes public entry by slug and propagates hidden-partner 404', async () => {
    service.publicEntry.mockResolvedValueOnce({
      partnerId: 'p1',
      partnerSlug: 'one',
    });
    await request(app.getHttpServer())
      .get('/api/partners/public/one')
      .expect(200)
      .expect({ partnerId: 'p1', partnerSlug: 'one' });
    service.publicEntry.mockRejectedValueOnce(new NotFoundException('hidden'));
    await request(app.getHttpServer())
      .get('/api/partners/public/draft')
      .expect(404);
  });
  it('passes region and anonymous identity to QR entry without an owner header', async () => {
    service.recordEntry.mockResolvedValue({ partnerId: 'p1' });
    await request(app.getHttpServer())
      .post('/api/partners/public/one/entries')
      .send({
        regionId: 'hapcheon',
        anonymousTripId: '11111111-1111-4111-8111-111111111111',
      })
      .expect(201);
    expect(service.recordEntry).toHaveBeenCalledWith(
      'one',
      expect.objectContaining({ regionId: 'hapcheon' }),
    );
  });
  it('requires the partner key at the service boundary for owner operations', async () => {
    service.metrics.mockRejectedValueOnce(new ForbiddenException('forbidden'));
    await request(app.getHttpServer())
      .get('/api/partners/one/metrics')
      .expect(403);
    expect(service.metrics).toHaveBeenCalledWith('one', undefined);
    service.metrics.mockResolvedValueOnce({ partnerId: 'p1', qrVisits: 0 });
    await request(app.getHttpServer())
      .get('/api/partners/one/metrics')
      .set('x-partner-key', 'owner')
      .expect(200);
    expect(service.metrics).toHaveBeenLastCalledWith('one', 'owner');
  });
  it('keeps admin mutations behind the existing admin token guard', async () => {
    service.adminPartner.mockResolvedValue({
      partnerId: 'p1',
      status: 'UNDER_REVIEW',
    });
    await request(app.getHttpServer())
      .patch('/api/admin/partners/p1/status')
      .send({ status: 'UNDER_REVIEW' })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/admin/partners/p1/status')
      .set('x-admin-token', 'admin-secret')
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    expect(service.adminPartner).toHaveBeenCalledTimes(1);
  });
  it('keeps management key rotation and revocation behind the admin guard', async () => {
    service.adminIssueManagementKey.mockResolvedValue({
      partnerId: 'p1',
      managementKey: 'one-time-key',
    });
    service.adminRevokeManagementKey.mockResolvedValue({
      partnerId: 'p1',
      managementKeyVersion: 2,
    });
    await request(app.getHttpServer())
      .post('/api/admin/partners/p1/management-key')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/admin/partners/p1/management-key')
      .set('x-admin-token', 'admin-secret')
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/admin/partners/p1/management-key/revoke')
      .set('x-admin-token', 'admin-secret')
      .expect(201);
    expect(service.adminIssueManagementKey).toHaveBeenCalledWith('p1');
    expect(service.adminRevokeManagementKey).toHaveBeenCalledWith('p1');
  });
  it('routes redemption idempotency and owner decision payloads unchanged', async () => {
    service.requestRedemption.mockResolvedValue({
      redemptionId: 'r1',
      status: 'REQUESTED',
    });
    await request(app.getHttpServer())
      .post('/api/partners/benefits/b1/redemptions')
      .send({
        regionId: 'hapcheon',
        anonymousTripId: '11111111-1111-4111-8111-111111111111',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      })
      .expect(201);
    expect(service.requestRedemption).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      }),
    );
    service.confirm.mockResolvedValue({
      redemptionId: 'r1',
      status: 'CONFIRMED',
    });
    await request(app.getHttpServer())
      .patch('/api/partners/one/redemptions/r1')
      .set('x-partner-key', 'owner')
      .send({ decision: 'CONFIRM' })
      .expect(200);
    expect(service.confirm).toHaveBeenCalledWith(
      'one',
      'r1',
      'owner',
      'CONFIRM',
    );
  });
});
