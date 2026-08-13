import { MasterDataService, DEFAULT_CLOSING_SOON_MINUTES } from './master-data.service';
import type { RealPlaceRecord } from './master-data.records';
const GAJO='https://gajo-wellness.kr/ontology#';
const facilities=[`${GAJO}antiAgingHealingLand`,`${GAJO}gajoHotSpringComplex`,`${GAJO}localFoodRestaurant`,`${GAJO}wellnessLounge`,`${GAJO}indoorHotSpringBath`];
const programs=[`${GAJO}lowIntensityHotSpringCourse`,`${GAJO}meditationLoungeProgram`,`${GAJO}localFoodHealingMeal`,`${GAJO}shortIndoorSeniorCourse`];
const graph:any={individualsOfIncludingSubclasses:jest.fn((type:string)=>type.includes('Program')?programs:facilities),label:jest.fn((uri:string)=>uri.split('#')[1])};
describe('MasterDataService',()=>{const service=new MasterDataService(graph);
 it('requires provenance for VERIFIED entities',()=>expect(service.validate([{...base(),verificationStatus:'VERIFIED'}])).toContain(`VERIFIED_WITHOUT_PROVENANCE:${base().entityUri}`));
 it('detects duplicate canonical ID',()=>expect(service.validate([base(),base()])).toContain(`DUPLICATE_CANONICAL_ID:${base().canonicalId}`));
 it('detects normalized Korean label duplicates',()=>expect(service.validate([base(),{...base(),canonicalId:'two',entityUri:'test:two',canonicalLabelKo:'테 스-트'}])).toContain('DUPLICATE_NORMALIZED_LABEL:테스트'));
 it('accepts valid government-verified coordinates',()=>expect(service.verifiedCoordinates(`${GAJO}antiAgingHealingLand`)).toMatchObject({latitude:35.73662049,longitude:128.0408983}));
 it('hydrates verified Baekdusan coordinates on a PARTIAL entity',()=>expect(service.verifiedCoordinates(`${GAJO}gajoHotSpringComplex`)).toMatchObject({latitude:35.698758,longitude:128.023103}));
 it('rejects suspicious coordinates outside Korea',()=>expect(service.validate([{...base(),latitude:40,longitude:140}])).toEqual(expect.arrayContaining([expect.stringContaining('SUSPICIOUS_LATITUDE'),expect.stringContaining('SUSPICIOUS_LONGITUDE')])));
 it('derives seasonal summer and winter schedules',()=>{expect(service.deriveOperatingState(`${GAJO}antiAgingHealingLand`,'TUESDAY','17:30','2026-08-09').operatingState).toBe('CLOSING_SOON');expect(service.deriveOperatingState(`${GAJO}antiAgingHealingLand`,'TUESDAY','17:30','2026-12-09').operatingState).toBe('CLOSED')});
 it('uses a documented configurable closing-soon threshold',()=>expect(service.closingSoonMinutes()).toBe(DEFAULT_CLOSING_SOON_MINUTES));
 it('does not falsely derive OPEN for unknown hours',()=>expect(service.deriveOperatingState(`${GAJO}gajoHotSpringComplex`,'TUESDAY','14:00').operatingState).toBe('UNKNOWN'));
 it('keeps every ontology course AI-composed',()=>expect(service.programs().every(p=>p.nature==='AI_COMPOSED')).toBe(true));
 it('canonicalizes a promoted restaurant without duplication',()=>expect(service.resolveCanonical('미가 추어탕')?.canonicalId).toBe('gajo-miga-chueotang'));
 it('returns both independently coordinate-verified places for map markers',()=>expect(service.mapEligiblePlaces().map(p=>p.canonicalId)).toEqual(['geochang-anti-aging-healing-land','gajo-baekdusan-cheonji-hot-spring']));
 it('retains unresolved reliable-source conflicts',()=>expect(service.place(`${GAJO}antiAgingHealingLand`)?.sourceConflicts?.[0]).toMatchObject({field:'telephone',reviewed:false,values:expect.any(Array)}));
 it('shows verified hot-spring fields while retaining missing current hours',()=>{const quality=service.quality();const hotSpring=quality.entities.find(e=>e.entityUri===`${GAJO}gajoHotSpringComplex`)!;expect(hotSpring.flags).not.toContain('MISSING_COORDINATES');expect(hotSpring.flags).toEqual(expect.arrayContaining(['MISSING_HOURS','PARTIAL']));expect(hotSpring.fieldVerification).toMatchObject({coordinates:'VERIFIED',address:'VERIFIED',telephone:'VERIFIED',operatingHours:'UNVERIFIED'})});
 it('never treats historical hot-spring hours as current hours',()=>{const hotSpring=service.place(`${GAJO}gajoHotSpringComplex`)!;expect(hotSpring.operatingHours).toBeUndefined();expect(hotSpring.historicalOperatingHours?.every(h=>h.currentVerificationRequired&&h.confidence==='HISTORICAL')).toBe(true);expect(service.deriveOperatingState(hotSpring.entityUri,'SATURDAY','10:00').operatingState).toBe('UNKNOWN')});
 it('does not fabricate restaurant or cafe coordinates',()=>{expect(service.verifiedCoordinates(`${GAJO}localFoodRestaurant`)).toBeUndefined();expect(service.verifiedCoordinates(`${GAJO}wellnessLounge`)).toBeUndefined()});
 it('validates all ontology and heldAtFacility mappings',()=>expect(service.validateOntologyLinks()).toEqual([]));
 it('rejects overlapping contradictory seasonal periods',()=>{const record={...base(),operatingHours:[hours('09:00','18:00'),hours('10:00','17:00')]};expect(service.validate([record])).toContain(`CONTRADICTORY_SEASONAL_HOURS:${record.entityUri}`)});
 it('keeps demo data out of live master records',()=>expect(service.places().some(p=>p.demoOnly)).toBe(false));
});
function provenance(){return {sourceName:'official',sourceUrl:'https://example.gov',retrievedAt:'2026-01-01',verificationStatus:'PARTIAL' as const}}
function base():RealPlaceRecord{return {canonicalId:'test-place',entityUri:'test:place',canonicalLabelKo:'테스트',category:'test',verificationStatus:'PARTIAL',detailsProvenance:provenance()}}
function hours(openTime:string,closeTime:string){return {days:['TUESDAY'],validMonths:[8],openTime,closeTime,provenance:provenance()}}
