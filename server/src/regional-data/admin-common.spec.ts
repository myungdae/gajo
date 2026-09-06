import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AdminRegionsController } from './admin-regions.controller';
import { RegionalDataController } from './regional-data.controller';
import { RegionalDataService } from './regional-data.service';
import { RegionalDataRecord } from './regional-data.schema';
import { REGION_CONFIGS } from '../region/region-config.service';

describe('common admin authorization boundary', () => {
  let app: INestApplication;
  const saved = {
    token: process.env.ADMIN_WRITE_TOKEN,
    regions: process.env.ADMIN_REGION_IDS,
    secret: process.env.COPILOT_JWT_SECRET,
  };
  const service = {
    list: jest.fn(async () => []),
    quality: jest.fn(async () => ({})),
    action: jest.fn(),
  };
  const bearer = (role: string, regions: string[] = []) =>
    jwt.sign(
      { sub: role.toLowerCase(), username: role, role, regions },
      'fixture-jwt-secret',
      { algorithm: 'HS256', expiresIn: '1h' },
    );

  beforeAll(async () => {
    process.env.ADMIN_WRITE_TOKEN = 'fixture-common';
    process.env.ADMIN_REGION_IDS = 'hapcheon,future-region';
    process.env.COPILOT_JWT_SECRET = 'fixture-jwt-secret';
    REGION_CONFIGS['future-region'] = {
      ...REGION_CONFIGS.gajo,
      id: 'future-region',
      regionName: '신규 지역',
    };
    const module = await Test.createTestingModule({
      controllers: [AdminRegionsController, RegionalDataController],
      providers: [
        { provide: RegionalDataService, useValue: service },
        {
          provide: getModelToken(RegionalDataRecord.name),
          useValue: {
            findOne: () => ({ lean: async () => ({ regionId: 'okcheon' }) }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete REGION_CONFIGS['future-region'];
    for (const [key, value] of [
      ['ADMIN_WRITE_TOKEN', saved.token],
      ['ADMIN_REGION_IDS', saved.regions],
      ['COPILOT_JWT_SECRET', saved.secret],
    ])
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
  });

  it('preserves the legacy token for operational automation', async () => {
    await request(app.getHttpServer()).get('/api/admin/regions').expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/regions')
      .set('x-admin-token', 'wrong')
      .expect(401);
    const result = await request(app.getHttpServer())
      .get('/api/admin/regions')
      .set('x-admin-token', 'fixture-common')
      .expect(200);
    expect(result.body.map((row) => row.id)).toEqual([
      'hapcheon',
      'future-region',
    ]);
    expect(JSON.stringify(result.body)).not.toContain('fixture-common');
  });

  it('gives platform administrators every registered region', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/admin/regions')
      .set('Authorization', `Bearer ${bearer('PLATFORM_ADMIN')}`)
      .expect(200);
    expect(result.body.map((row) => row.id)).toEqual(
      expect.arrayContaining(['gajo', 'hapcheon', 'future-region']),
    );
  });

  it('limits regional managers and rejects viewers', async () => {
    const manager = await request(app.getHttpServer())
      .get('/api/admin/regions')
      .set(
        'Authorization',
        `Bearer ${bearer('REGIONAL_MANAGER', ['hapcheon', 'not-configured'])}`,
      )
      .expect(200);
    expect(manager.body.map((row) => row.id)).toEqual(['hapcheon']);

    await request(app.getHttpServer())
      .get('/api/admin/regions')
      .set('Authorization', `Bearer ${bearer('VIEWER', ['hapcheon'])}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/regions')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });

  it('query, payload and ID do not grant regional-data authority', async () => {
    const token = bearer('REGIONAL_MANAGER', ['hapcheon']);
    await request(app.getHttpServer())
      .get('/api/admin/regional-data?regionId=okcheon')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/regional-data')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/admin/regional-data/other/actions/APPROVE?regionId=hapcheon')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/admin/regional-data/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ package: { regionId: 'okcheon' } })
      .expect(403);
    expect(service.action).not.toHaveBeenCalled();
    expect(service.list).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get('/api/admin/regional-data?regionId=hapcheon')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ regionId: 'hapcheon' }),
    );
  });
});
