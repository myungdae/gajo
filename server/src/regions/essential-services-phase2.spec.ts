import { OKCHEON_PHASE2_ESSENTIAL_SERVICES, PHASE2_SOURCE_ADAPTERS, parseOkcheonSmartMapRows } from './essential-services-phase2';
import { REGIONAL_CANDIDATE_DATASETS } from './regional-candidate.registry';
import { essentialServiceReadiness, safeEssentialActions } from '../concierge/essential-services';

describe('Phase 2 official essential-service onboarding', () => {
  it('parses supported rows, rejects invalid coordinates, and deduplicates locNo/category', () => {
    const row = {locNo:1,ctgryNm:'공중화장실',title:'테스트 화장실',address:'옥천읍 중앙로 1',local:'옥천읍',lat:'36.3',lng:'127.57'};
    expect(parseOkcheonSmartMapRows([row,row,{...row,locNo:2,lat:'bad'}])).toHaveLength(1);
  });

  it('retains municipal provenance and evidence-ready, non-approved lifecycle semantics', () => {
    expect(OKCHEON_PHASE2_ESSENTIAL_SERVICES).toHaveLength(16);
    for (const record of OKCHEON_PHASE2_ESSENTIAL_SERVICES) {
      expect(record.runtimeDataStatus).toBe('PARTIAL');
      expect(record.source).toMatchObject({sourceType:'MUNICIPAL_OFFICIAL',evidenceStatus:'EVIDENCE_READY'});
      expect(record.actions).not.toHaveProperty('navigate');
      expect(safeEssentialActions(record).navigate).toBeUndefined();
    }
  });

  it('validates selected coordinates inside conservative Okcheon county bounds and without duplicate entity coordinates', () => {
    const coordinates = new Set<string>();
    for (const record of OKCHEON_PHASE2_ESSENTIAL_SERVICES) {
      expect(record.latitude).toBeGreaterThanOrEqual(36.15);
      expect(record.latitude).toBeLessThanOrEqual(36.45);
      expect(record.longitude).toBeGreaterThanOrEqual(127.45);
      expect(record.longitude).toBeLessThanOrEqual(127.85);
      const key = `${record.latitude},${record.longitude},${record.entityType}`;
      expect(coordinates.has(key)).toBe(false);
      coordinates.add(key);
    }
  });

  it('keeps evidence isolated to Okcheon and reports discovery without navigation readiness', () => {
    for (const regionId of ['gajo','hapcheon'])
      expect(REGIONAL_CANDIDATE_DATASETS[regionId].records.some((r) => r.entityUri.includes('smartMap-'))).toBe(false);
    const readiness = essentialServiceReadiness(REGIONAL_CANDIDATE_DATASETS.okcheon.records);
    for (const category of ['PUBLIC_TOILET','PARKING','GAS_STATION','EV_CHARGER'] as const)
      expect(readiness[category]).toMatchObject({status:'PARTIAL',navigationEligibleCount:0});
  });

  it('models credential-gated national sources without claiming live data', () => {
    expect(PHASE2_SOURCE_ADAPTERS.find((x) => x.id === 'opinet-api')).toMatchObject({credentialStatus:'CREDENTIAL_REQUIRED'});
    expect(PHASE2_SOURCE_ADAPTERS.find((x) => x.id === 'environment-ev-api')).toMatchObject({credentialStatus:'CREDENTIAL_REQUIRED'});
    expect(PHASE2_SOURCE_ADAPTERS.some((x) => x.refreshCadence === 'LIVE')).toBe(false);
  });
});
