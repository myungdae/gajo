import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PublicRegionalNetworkController } from './public-regional-network.controller';
import { RegionalReportService } from './regional-report.service';

describe('Public Hapcheon regional network', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicRegionalNetworkController],
      providers: [
        {
          provide: RegionalReportService,
          useValue: {
            ecosystem: (regionId: string) => ({
              region: { id: regionId },
              status: 'AVAILABLE',
              nodes: [],
              edges: [],
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  it('allows an anonymous read of only the Hapcheon network', async () => {
    await request(app.getHttpServer())
      .get('/api/public/regional-network/hapcheon')
      .expect(200)
      .expect(({ body }) => expect(body.region.id).toBe('hapcheon'));
    await request(app.getHttpServer())
      .get('/api/public/regional-network/okcheon')
      .expect(404);
  });
  afterAll(() => app.close());
});
