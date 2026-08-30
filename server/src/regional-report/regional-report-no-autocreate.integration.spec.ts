/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import request from 'supertest';
import { RegionalReportModule } from './regional-report.module';

jest.setTimeout(120_000);

describe('Regional Report MongoDB bootstrap boundary', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let client: MongoClient;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      instance: { dbName: 'regional_report_bootstrap' },
    });
    const uri = mongo.getUri('regional_report_bootstrap');
    process.env.REGIONAL_REPORT_CREDENTIALS_JSON = JSON.stringify([
      { regionId: 'hapcheon', token: 'h'.repeat(32) },
    ]);
    client = new MongoClient(uri);
    await client.connect();
    expect(await client.db().listCollections().toArray()).toEqual([]);

    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri, {
          autoIndex: false,
          autoCreate: false,
        }),
        RegionalReportModule,
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('does not create collections or indexes during module bootstrap and empty reads', async () => {
    expect(await client.db().listCollections().toArray()).toEqual([]);

    await request(app.getHttpServer())
      .get('/api/regional-report/network')
      .expect(403)
      .expect('Content-Type', /json/);
    const response = await request(app.getHttpServer())
      .get('/api/regional-report/network')
      .set('x-regional-report-token', 'h'.repeat(32))
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toMatchObject({
      region: { id: 'hapcheon' },
      period: { key: '30d', timeZone: 'Asia/Seoul' },
      network: {
        status: 'PREPARING',
        notice: '연결 데이터 준비 중',
        nodes: [],
        edges: [],
      },
    });
    expect(await client.db().listCollections().toArray()).toEqual([]);
  });

  afterAll(async () => {
    delete process.env.REGIONAL_REPORT_CREDENTIALS_JSON;
    await app?.close();
    await client?.close();
    await mongo?.stop();
  });
});
