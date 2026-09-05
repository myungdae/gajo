import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RegionalDataController } from './regional-data.controller';
import { RegionalDataService } from './regional-data.service';
import { FacilityController } from '../facility/facility.controller';
import { FacilityService } from '../facility/facility.service';

describe('public versus administrator HTTP identity boundary', () => {
  let app: any;
  const previousToken = process.env.ADMIN_WRITE_TOKEN;
  const previousActor = process.env.ADMIN_ACTOR_ID;
  const row = { id: 'private-review', canonicalEntityId: 'urn:test:private', regionId: 'hapcheon',
    displayName: '검토 전용 이름', aliases: ['검토 전용 별칭'], lifecycleStatus: 'ACTIVE', verificationStatus: 'PARTIAL',
    proposedFacts: { displayName: '검토 전용 이름', aliases: ['검토 전용 별칭'] },
    fieldEvidence: { coordinates: { status: 'APPROVED' } }, latitude: 36, longitude: 128 };
  beforeAll(async () => {
    process.env.ADMIN_WRITE_TOKEN = 'public-boundary-test-token';
    process.env.ADMIN_ACTOR_ID = 'PUBLIC_BOUNDARY_TEST';
    const model = { find: (query: any = {}) => {
      const values = Object.entries(query).every(([key, value]) => row[key] === value) ? [row] : [];
      return { lean: async () => values, sort: () => ({ lean: async () => values }) };
    } };
    const regional = new RegionalDataService(model as any);
    // The facade exposes only read methods; no bootstrap lifecycle runs in this app.
    const module = await Test.createTestingModule({
      controllers: [RegionalDataController, FacilityController],
      providers: [
        { provide: RegionalDataService, useValue: {
          list: regional.list.bind(regional), quality: regional.quality.bind(regional),
          operationalReadiness: regional.operationalReadiness.bind(regional),
        } },
        { provide: FacilityService, useValue: new FacilityService({} as any, {} as any, {} as any, regional) },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (previousToken === undefined) delete process.env.ADMIN_WRITE_TOKEN; else process.env.ADMIN_WRITE_TOKEN = previousToken;
    if (previousActor === undefined) delete process.env.ADMIN_ACTOR_ID; else process.env.ADMIN_ACTOR_ID = previousActor;
  });
  it.each(['/api/admin/regional-data', '/api/admin/regional-data/operational-readiness?regionId=hapcheon'])('refuses anonymous review access: %s', async path => {
    await request(app.getHttpServer()).get(path).expect(403);
  });
  it('preserves proposed facts for an authenticated operator', async () => {
    const response = await request(app.getHttpServer()).get('/api/admin/regional-data?regionId=hapcheon')
      .set('x-admin-token', 'public-boundary-test-token').expect(200);
    expect(response.body.records[0].proposedFacts).toEqual(row.proposedFacts);
  });
  it.each(['/api/facilities', '/api/operational-places'])('public projection excludes unapproved identity: %s', async path => {
    const response = await request(app.getHttpServer()).get(`${path}?regionId=hapcheon`).expect(200);
    expect(response.text).not.toContain(row.displayName);
    expect(response.text).not.toContain(row.aliases[0]);
    expect(response.text).not.toContain(row.canonicalEntityId);
    expect(response.text).not.toContain('proposedFacts');
  });
});
