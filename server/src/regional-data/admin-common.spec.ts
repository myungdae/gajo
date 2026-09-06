import {Test} from '@nestjs/testing';
import {INestApplication} from '@nestjs/common';
import {getModelToken} from '@nestjs/mongoose';
import request from 'supertest';
import {AdminRegionsController} from './admin-regions.controller';
import {RegionalDataController} from './regional-data.controller';
import {RegionalDataService} from './regional-data.service';
import {RegionalDataRecord} from './regional-data.schema';
import {REGION_CONFIGS} from '../region/region-config.service';

describe('common admin authorization boundary',()=>{
 let app:INestApplication;
 const saved={token:process.env.ADMIN_WRITE_TOKEN,regions:process.env.ADMIN_REGION_IDS};
 const service={list:jest.fn(async()=>[]),quality:jest.fn(async()=>({})),action:jest.fn()};
 beforeAll(async()=>{
  process.env.ADMIN_WRITE_TOKEN='fixture-common';process.env.ADMIN_REGION_IDS='hapcheon,future-region';
  REGION_CONFIGS['future-region']={...REGION_CONFIGS.gajo,id:'future-region',regionName:'신규 지역'};
  const module=await Test.createTestingModule({controllers:[AdminRegionsController,RegionalDataController],providers:[
   {provide:RegionalDataService,useValue:service},
   {provide:getModelToken(RegionalDataRecord.name),useValue:{findOne:()=>({lean:async()=>({regionId:'okcheon'})})}}
  ]}).compile();
  app=module.createNestApplication();await app.init();
 });
 afterAll(async()=>{
  await app.close();delete REGION_CONFIGS['future-region'];
  for(const [key,value] of [['ADMIN_WRITE_TOKEN',saved.token],['ADMIN_REGION_IDS',saved.regions]])if(value===undefined)delete process.env[key!];else process.env[key!]=value;
 });
 it('only authenticated allowed registered regions, including additions, appear',async()=>{
  await request(app.getHttpServer()).get('/api/admin/regions').expect(403);
  await request(app.getHttpServer()).get('/api/admin/regions').set('x-admin-token','wrong').expect(403);
  const result=await request(app.getHttpServer()).get('/api/admin/regions').set('x-admin-token','fixture-common').expect(200);
  expect(result.body.map(r=>r.id)).toEqual(['hapcheon','future-region']);
  expect(JSON.stringify(result.body)).not.toContain('fixture-common');
 });
 it('query, payload and ID do not grant regional-data authority',async()=>{
  await request(app.getHttpServer()).get('/api/admin/regional-data?regionId=okcheon').set('x-admin-token','fixture-common').expect(403);
  await request(app.getHttpServer()).get('/api/admin/regional-data').set('x-admin-token','fixture-common').expect(403);
  await request(app.getHttpServer()).post('/api/admin/regional-data/other/actions/APPROVE?regionId=hapcheon').set('x-admin-token','fixture-common').send({}).expect(403);
  await request(app.getHttpServer()).post('/api/admin/regional-data/import/preview').set('x-admin-token','fixture-common').send({package:{regionId:'okcheon'}}).expect(403);
  expect(service.action).not.toHaveBeenCalled();expect(service.list).not.toHaveBeenCalled();
  await request(app.getHttpServer()).get('/api/admin/regional-data?regionId=hapcheon').set('x-admin-token','fixture-common').expect(200);
  expect(service.list).toHaveBeenCalledWith(expect.objectContaining({regionId:'hapcheon'}));
 });
});
