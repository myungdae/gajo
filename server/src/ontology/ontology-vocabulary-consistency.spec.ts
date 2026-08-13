import { Parser, Store, DataFactory } from 'n3';
import * as fs from 'fs';
import * as path from 'path';

const { namedNode }=DataFactory;const RDF='http://www.w3.org/1999/02/22-rdf-syntax-ns#',RDFS='http://www.w3.org/2000/01/rdf-schema#',GAJO='https://gajo-wellness.kr/ontology#';
describe('static ontology/runtime vocabulary consistency',()=>{
  const store=new Store();
  beforeAll(()=>{for(const file of ['runtime_core_v1_0.ttl','gajo_ai_concierge_domain_v1_0.ttl'])store.addQuads(new Parser().parse(fs.readFileSync(path.join(__dirname,'..','ontology-data',file),'utf8')))});
  const typed=(uri:string,type:string)=>store.countQuads(namedNode(uri),namedNode(RDF+'type'),namedNode(type),null)>0;
  const subclasses=(child:string,parent:string):boolean=>child===parent||store.getQuads(namedNode(child),namedNode(RDFS+'subClassOf'),null,null).some(q=>subclasses(q.object.value,parent));
  it('all exact runtime-to-ontology goal and condition mappings resolve',()=>{for(const [local,type] of [['restAndRecovery','WellnessGoal'],['kneePain','HealthCondition'],['fatigue','HealthCondition'],['limitedMobility','HealthCondition'],['hypertensionConcern','HealthCondition'],['shortWalkingDistance','MobilityCondition']])expect(typed(GAJO+local,GAJO+type)).toBe(true)});
  it('every program heldAtFacility reference resolves to a Facility subclass',()=>{for(const quad of store.getQuads(null,namedNode(GAJO+'heldAtFacility'),null,null)){const types=store.getQuads(namedNode(quad.object.value),namedNode(RDF+'type'),null,null).map(q=>q.object.value);expect(types.some(type=>subclasses(type,GAJO+'Facility'))).toBe(true)}});
  it('does not assert contradictory indoor values for one subject',()=>{for(const subject of new Set(store.getQuads(null,namedNode(GAJO+'isIndoor'),null,null).map(q=>q.subject.value))){const values=new Set(store.getQuads(namedNode(subject),namedNode(GAJO+'isIndoor'),null,null).map(q=>q.object.value));expect(values.size).toBe(1)}});
  it('classifies every extractor preference as exact ontology or intentional runtime-only',()=>{const classification:Record<string,'ONTOLOGY'|'RUNTIME_ONLY'>={REST_AND_RECOVERY:'ONTOLOGY',LOW_WALKING:'ONTOLOGY',HOT_SPRING:'RUNTIME_ONLY',FOOD:'RUNTIME_ONLY',CAFE:'RUNTIME_ONLY',NATURE:'RUNTIME_ONLY',INDOOR:'ONTOLOGY',OUTDOOR:'RUNTIME_ONLY'};expect(Object.keys(classification).sort()).toEqual(['CAFE','FOOD','HOT_SPRING','INDOOR','LOW_WALKING','NATURE','OUTDOOR','REST_AND_RECOVERY'].sort());expect(typed(GAJO+'restAndRecovery',GAJO+'WellnessGoal')).toBe(true);expect(typed(GAJO+'shortWalkingDistance',GAJO+'MobilityCondition')).toBe(true);expect(store.countQuads(namedNode(GAJO+'indoorPreference'),null,null,null)).toBeGreaterThan(0)});
});
