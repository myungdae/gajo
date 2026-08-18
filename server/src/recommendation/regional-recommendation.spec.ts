import { RecommendationService } from './recommendation.service';
import { DecisionPipelineService } from './decision-pipeline.service';
import { regionalCandidateDataset } from '../regions/regional-candidate.registry';

const document = (value: any) => ({ ...value, toObject: () => value });

function service() {
  const recModel = { create: jest.fn(async (value: any) => document(value)) };
  const itineraryModel = { create: jest.fn(async (value: any) => document(value)) };
  const traversal = {
    findSuitablePrograms: jest.fn(() => []), findEnvironmentAffected: jest.fn(() => []),
    findRiskMitigations: jest.fn(() => []), label: jest.fn((uri: string) => uri),
    objectProps: jest.fn(() => ({})), literalProps: jest.fn(() => ({})),
  };
  return { instance: new RecommendationService(recModel as any, itineraryModel as any, traversal as any, new DecisionPipelineService(), {} as any, {} as any), recModel, itineraryModel, traversal };
}

describe('regional recommendation ownership', () => {
  it('keeps the exact Okcheon must-visit request in an Okcheon-only candidate pool with unknown operations and movement', async () => {
    const { instance, recModel, itineraryModel, traversal } = service();
    const result = await instance.buildRecommendation({
      contextNo: 'RC-OK', regionId: 'okcheon', activityPreferences: ['LITERATURE_CULTURE', 'TRADITIONAL_CULTURE', 'NATURE'],
      mustVisitPlaces: [{ entityId: 'https://okcheon.example/ontology#jeongJiyongBirthplace', label: '정지용 생가', resolved: true }],
      healthConditions: [], wellnessGoals: [], expandedConditions: [], environmentConditions: [], risks: [], runtimeStates: [], transportMode: 'CAR',
    });
    expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();
    expect(result.regionId).toBe('okcheon');
    expect(result.candidateRegionIds).toEqual(['okcheon']);
    expect(result.itinerary.steps[0].programLabel).toBe('정지용 생가');
    expect(result.itinerary.steps.every((step: any) => step.programUri.startsWith('https://okcheon.example/ontology#'))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/거창|가조|항노화힐링랜드|백두산천지온천/);
    expect(result.itinerary.steps.every((step: any) => step.distanceMeters === undefined && step.estimatedTravelMinutes === undefined && step.durationMinutes === undefined)).toBe(true);
    expect(result.reasonSummary).toContain('운영시간과 이동시간은 추가 확인이 필요');
    expect(itineraryModel.create).toHaveBeenCalledWith(expect.objectContaining({ regionId: 'okcheon' }));
    expect(recModel.create).toHaveBeenCalledWith(expect.objectContaining({ regionId: 'okcheon', candidateRegionIds: ['okcheon'] }));
  });

  it('maps Okcheon interests to regional metadata without introducing unsupported candidates', () => {
    const { instance } = service();
    const candidates = (instance as any).buildRegionalCandidates({ activityPreferences: ['DAECHEONG_LAKE', 'FOOD'], mustVisitPlaces: [] }, regionalCandidateDataset('okcheon'));
    expect(candidates).toEqual([]);
    const nature = (instance as any).buildRegionalCandidates({ activityPreferences: ['NATURE'], mustVisitPlaces: [] }, regionalCandidateDataset('okcheon'));
    expect(nature.length).toBeGreaterThan(0);
    expect(nature.every((candidate: any) => candidate.regionId === 'okcheon' && candidate.distanceStatus === 'UNKNOWN')).toBe(true);
  });

  it('keeps the exact Muan plan anchored and excludes every Gajo and Okcheon candidate and runtime fallback', async () => {
    const { instance, traversal } = service();
    const result = await instance.buildRecommendation({contextNo:'RC-MUAN',regionId:'muan',companions:[{relationship:'parent',healthConditions:[]}],transportMode:'CAR',walkingLevel:'LOW',companionConstraints:['shortWalkingDistance'],activityPreferences:['LOTUS_ECOLOGY','NATURE','FOOD','REST_AND_RECOVERY'],mustVisitPlaces:[{entityId:'https://muan.example/ontology#hoesanWhiteLotusPond',label:'회산백련지',resolved:true}],healthConditions:[],wellnessGoals:[],expandedConditions:[],environmentConditions:[],risks:[],runtimeStates:[]});
    expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();
    expect(result.regionId).toBe('muan');expect(result.candidateRegionIds).toEqual(['muan']);
    expect(result.itinerary.steps.map((step:any)=>step.programLabel)).toEqual(['회산백련지','회산백련지 일대']);
    expect(result.itinerary.steps.every((step:any)=>step.programUri.startsWith('https://muan.example/ontology#'))).toBe(true);
    expect(result.itinerary.steps.every((step:any)=>step.distanceMeters===undefined&&step.estimatedTravelMinutes===undefined&&step.durationMinutes===undefined)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/거창|가조|항노화힐링랜드|백두산천지온천|정지용|옥천|대청호/);
    expect(result.reasonSummary).toContain('운영시간과 이동시간은 추가 확인이 필요');
  });

  it('keeps the Gyeryong public event anchored without fabricating schedule availability or military access',async()=>{const{instance,traversal}=service();const result=await instance.buildRecommendation({contextNo:'RC-GY',regionId:'gyeryong',companions:[{relationship:'parent',healthConditions:[]}],transportMode:'CAR',walkingLevel:'LOW',companionConstraints:['shortWalkingDistance'],activityPreferences:['MILITARY_CULTURE_HISTORY','FESTIVAL_EVENT','FOOD','REST_AND_RECOVERY'],mustVisitPlaces:[{entityId:'https://gyeryong.example/ontology#militaryCultureFestival',label:'계룡 군문화축제',resolved:true}],healthConditions:[],wellnessGoals:[],expandedConditions:[],environmentConditions:[],risks:[],runtimeStates:[]});expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();expect(result.candidateRegionIds).toEqual(['gyeryong']);expect(result.itinerary.steps[0]).toMatchObject({programLabel:'계룡 군문화축제',entityType:'EVENT',eventAvailability:'UNKNOWN',accessStatus:'PUBLIC_EVENT_UNVERIFIED'});expect(result.itinerary.steps[0].accessNotice).toContain('공개구역 관람 가능 여부');expect(result.itinerary.steps.every((step:any)=>step.programUri.startsWith('https://gyeryong.example/ontology#')&&step.distanceMeters===undefined&&step.estimatedTravelMinutes===undefined)).toBe(true);expect(result.reasonSummary).toContain('관람 가능 여부');expect(JSON.stringify(result)).not.toMatch(/거창|가조|백두산천지온천|항노화힐링랜드|정지용|옥천|대청호|회산백련지|무안/)});

  it('keeps the exact Hapcheon lake and accommodation plan in a Hapcheon-only candidate pool',async()=>{const{instance,traversal}=service();const result=await instance.buildRecommendation({contextNo:'RC-HC',regionId:'hapcheon',duration:'1N2D',companions:[{relationship:'family',healthConditions:[]}],transportMode:'CAR',walkingLevel:'LOW',companionConstraints:['shortWalkingDistance'],activityPreferences:['HAPCHEON_LAKE','NATURE','FOOD','ACCOMMODATION','REST_AND_RECOVERY'],mustVisitPlaces:[{entityId:'https://hapcheon.example/ontology#hapcheonLake',label:'합천호',resolved:true},{entityId:'https://hapcheon.example/ontology#jeonwonPension',label:'전원펜션',resolved:true}],healthConditions:[],wellnessGoals:[],expandedConditions:[],environmentConditions:[],risks:[],runtimeStates:[]});expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();expect(result.regionId).toBe('hapcheon');expect(result.candidateRegionIds).toEqual(['hapcheon']);expect(result.itinerary.steps.map((step:any)=>step.programLabel)).toEqual(['합천호','전원펜션','합천호 주변 관광권']);expect(result.itinerary.steps[1]).toMatchObject({entityType:'ACCOMMODATION',accommodationType:'PENSION',areaLabel:'합천호 권역'});expect(result.itinerary.steps.every((step:any)=>step.programUri.startsWith('https://hapcheon.example/ontology#')&&step.distanceMeters===undefined&&step.estimatedTravelMinutes===undefined&&step.durationMinutes===undefined)).toBe(true);expect(result.reasonSummary).toContain('운영 및 예약 정보는 추가 확인');const serialized=JSON.stringify(result);expect(serialized).not.toMatch(/거창 항노화힐링랜드|백두산천지온천|정지용 생가|정지용문학관|옥천|대청호|회산백련지|무안|계룡 군문화축제/);expect(serialized).not.toMatch(/latitude|longitude|roomPrice|bookingAvailability|reviewScore/)});

  it('never exposes Hapcheon entities in another regional candidate pool',()=>{for(const regionId of ['okcheon','muan','gyeryong'])expect(regionalCandidateDataset(regionId)?.records.some(record=>record.entityUri.includes('hapcheon'))).toBe(false)});

  it('keeps the exact Daejeon Jung-gu urban plan district-scoped with unknown movement operations',async()=>{const{instance,traversal}=service();const result=await instance.buildRecommendation({contextNo:'RC-DJ',regionId:'daejeon-junggu',duration:'DAY',companions:[{relationship:'parent',healthConditions:[]}],transportMode:'PUBLIC_TRANSPORT',walkingLevel:'LOW',companionConstraints:['shortWalkingDistance'],activityPreferences:['URBAN_CULTURE','TRADITIONAL_MARKET','FOOD','CAFE','REST_AND_RECOVERY'],mustVisitPlaces:[{entityId:'https://daejeon-junggu.example/ontology#eunhaengJungangroCulturalArea',label:'은행동·중앙로 문화권',resolved:true}],healthConditions:[],wellnessGoals:[],expandedConditions:[],environmentConditions:[],risks:[],runtimeStates:[]});expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();expect(result.regionId).toBe('daejeon-junggu');expect(result.candidateRegionIds).toEqual(['daejeon-junggu']);expect(result.itinerary.steps[0].programLabel).toBe('은행동·중앙로 문화권');expect(result.itinerary.steps.every((step:any)=>step.programUri.startsWith('https://daejeon-junggu.example/ontology#')&&step.distanceMeters===undefined&&step.estimatedTravelMinutes===undefined&&step.durationMinutes===undefined)).toBe(true);const serialized=JSON.stringify(result);expect(serialized).not.toMatch(/거창 항노화힐링랜드|백두산천지온천|정지용 생가|정지용문학관|회산백련지|계룡 군문화축제|합천호|전원펜션/);expect(serialized).not.toMatch(/walkingDistance|parkingAvailability|publicTransportTime|latitude|longitude|temperature/)});

  it('never exposes Daejeon Jung-gu entities in another regional pool',()=>{for(const regionId of ['okcheon','muan','gyeryong','hapcheon'])expect(regionalCandidateDataset(regionId)?.records.some(record=>record.entityUri.includes('daejeon-junggu'))).toBe(false)});

  it('leaves Gajo candidate discovery on the existing ontology traversal', async () => {
    const { instance, traversal } = service();
    await instance.buildRecommendation({ contextNo: 'RC-GAJO', regionId: 'gajo', healthConditions: [], wellnessGoals: [], expandedConditions: [], environmentConditions: [], risks: [], runtimeStates: [] });
    expect(traversal.findSuitablePrograms).toHaveBeenCalledTimes(1);
  });
});
