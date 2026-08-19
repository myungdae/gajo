import { RecommendationService } from './recommendation.service';
import { DecisionPipelineService } from './decision-pipeline.service';
import { regionalCandidateDataset } from '../regions/regional-candidate.registry';

const document = (value: any) => ({ ...value, toObject: () => value });

function service() {
  const recModel = { create: jest.fn(async (value: any) => document(value)) };
  const itineraryModel = {
    create: jest.fn(async (value: any) => document(value)),
  };
  const traversal = {
    findSuitablePrograms: jest.fn(() => []),
    findEnvironmentAffected: jest.fn(() => []),
    findRiskMitigations: jest.fn(() => []),
    label: jest.fn((uri: string) => uri),
    objectProps: jest.fn(() => ({})),
    literalProps: jest.fn(() => ({})),
  };
  return {
    instance: new RecommendationService(
      recModel as any,
      itineraryModel as any,
      traversal as any,
      new DecisionPipelineService(),
      {} as any,
      {} as any,
    ),
    recModel,
    itineraryModel,
    traversal,
  };
}

describe('regional recommendation ownership', () => {
  it('keeps the exact Okcheon must-visit request in an Okcheon-only candidate pool with unknown operations and movement', async () => {
    const { instance, recModel, itineraryModel, traversal } = service();
    const result = await instance.buildRecommendation({
      contextNo: 'RC-OK',
      regionId: 'okcheon',
      activityPreferences: [
        'LITERATURE_CULTURE',
        'TRADITIONAL_CULTURE',
        'NATURE',
      ],
      mustVisitPlaces: [
        {
          entityId: 'https://okcheon.example/ontology#jeongJiyongBirthplace',
          label: '정지용 생가',
          resolved: true,
        },
      ],
      healthConditions: [],
      wellnessGoals: [],
      expandedConditions: [],
      environmentConditions: [],
      risks: [],
      runtimeStates: [],
      transportMode: 'CAR',
    });
    expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();
    expect(result.regionId).toBe('okcheon');
    expect(result.candidateRegionIds).toEqual(['okcheon']);
    expect(result.itinerary.steps[0].programLabel).toBe('정지용 생가');
    expect(
      result.itinerary.steps.every((step: any) =>
        step.programUri.startsWith('https://okcheon.example/ontology#'),
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /거창|가조|항노화힐링랜드|백두산천지온천/,
    );
    expect(
      result.itinerary.steps.every(
        (step: any) =>
          step.distanceMeters === undefined &&
          step.estimatedTravelMinutes === undefined &&
          step.durationMinutes === undefined,
      ),
    ).toBe(true);
    expect(result.reasonSummary).toContain(
      '운영시간과 이동시간은 추가 확인이 필요',
    );
    expect(itineraryModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ regionId: 'okcheon' }),
    );
    expect(recModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        regionId: 'okcheon',
        candidateRegionIds: ['okcheon'],
      }),
    );
  });

  it('maps Okcheon interests to regional metadata without introducing unsupported candidates', () => {
    const { instance } = service();
    const candidates = (instance as any).buildRegionalCandidates(
      { activityPreferences: ['DAECHEONG_LAKE', 'FOOD'], mustVisitPlaces: [] },
      regionalCandidateDataset('okcheon'),
    );
    expect(candidates).toEqual([]);
    const nature = (instance as any).buildRegionalCandidates(
      { activityPreferences: ['NATURE'], mustVisitPlaces: [] },
      regionalCandidateDataset('okcheon'),
    );
    expect(nature.length).toBeGreaterThan(0);
    expect(
      nature.every(
        (candidate: any) =>
          candidate.regionId === 'okcheon' &&
          candidate.distanceStatus === 'UNKNOWN',
      ),
    ).toBe(true);
  });

  it('makes an ACTIVE DB-only Lowful record fairly eligible for a Hapcheon cafe/rest request',()=>{
    const {instance}=service();
    const base=regionalCandidateDataset('hapcheon')!;
    const lowful={entityUri:'urn:regional:hapcheon:lowful',canonicalLabelKo:'로우풀',alternateLabels:[],entityType:'CAFE',category:'CAFE',tags:['CAFE','REST','HAPCHEON_LAKE'],runtimeDataStatus:'VERIFIED' as const,areaLabel:'합천호 권역 · 대병면 · 회양관광단지권',latitude:35.525488,longitude:128.018877,actions:{navigate:{latitude:35.525488,longitude:128.018877}}};
    const candidates=(instance as any).buildRegionalCandidates({activityPreferences:['CAFE','REST_AND_RECOVERY'],mustVisitPlaces:[],accommodationIntents:[]},{...base,records:[...base.records,lowful]});
    const candidate=candidates.find((x:any)=>x.programUri===lowful.entityUri);
    expect(candidate).toMatchObject({programLabel:'로우풀',entityType:'CAFE',regionId:'hapcheon'});expect(candidate.matchedLabels).toEqual(expect.arrayContaining(['카페','편안한 휴식']));expect(candidate.coordinates).toEqual({latitude:35.525488,longitude:128.018877,sourceUri:lowful.entityUri});
  });

  it('keeps the exact Muan plan anchored and excludes every Gajo and Okcheon candidate and runtime fallback', async () => {
    const { instance, traversal } = service();
    const result = await instance.buildRecommendation({
      contextNo: 'RC-MUAN',
      regionId: 'muan',
      companions: [{ relationship: 'parent', healthConditions: [] }],
      transportMode: 'CAR',
      walkingLevel: 'LOW',
      companionConstraints: ['shortWalkingDistance'],
      activityPreferences: [
        'LOTUS_ECOLOGY',
        'NATURE',
        'FOOD',
        'REST_AND_RECOVERY',
      ],
      mustVisitPlaces: [
        {
          entityId: 'https://muan.example/ontology#hoesanWhiteLotusPond',
          label: '회산백련지',
          resolved: true,
        },
      ],
      healthConditions: [],
      wellnessGoals: [],
      expandedConditions: [],
      environmentConditions: [],
      risks: [],
      runtimeStates: [],
    });
    expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();
    expect(result.regionId).toBe('muan');
    expect(result.candidateRegionIds).toEqual(['muan']);
    expect(
      result.itinerary.steps.map((step: any) => step.programLabel),
    ).toEqual(['회산백련지', '회산백련지 일대']);
    expect(
      result.itinerary.steps.every((step: any) =>
        step.programUri.startsWith('https://muan.example/ontology#'),
      ),
    ).toBe(true);
    expect(
      result.itinerary.steps.every(
        (step: any) =>
          step.distanceMeters === undefined &&
          step.estimatedTravelMinutes === undefined &&
          step.durationMinutes === undefined,
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /거창|가조|항노화힐링랜드|백두산천지온천|정지용|옥천|대청호/,
    );
    expect(result.reasonSummary).toContain(
      '운영시간과 이동시간은 추가 확인이 필요',
    );
  });

  it('keeps the Gyeryong public event anchored without fabricating schedule availability or military access', async () => {
    const { instance, traversal } = service();
    const result = await instance.buildRecommendation({
      contextNo: 'RC-GY',
      regionId: 'gyeryong',
      companions: [{ relationship: 'parent', healthConditions: [] }],
      transportMode: 'CAR',
      walkingLevel: 'LOW',
      companionConstraints: ['shortWalkingDistance'],
      activityPreferences: [
        'MILITARY_CULTURE_HISTORY',
        'FESTIVAL_EVENT',
        'FOOD',
        'REST_AND_RECOVERY',
      ],
      mustVisitPlaces: [
        {
          entityId: 'https://gyeryong.example/ontology#militaryCultureFestival',
          label: '계룡 군문화축제',
          resolved: true,
        },
      ],
      healthConditions: [],
      wellnessGoals: [],
      expandedConditions: [],
      environmentConditions: [],
      risks: [],
      runtimeStates: [],
    });
    expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();
    expect(result.candidateRegionIds).toEqual(['gyeryong']);
    expect(result.itinerary.steps[0]).toMatchObject({
      programLabel: '계룡 군문화축제',
      entityType: 'EVENT',
      eventAvailability: 'UNKNOWN',
      accessStatus: 'PUBLIC_EVENT_UNVERIFIED',
    });
    expect(result.itinerary.steps[0].accessNotice).toContain(
      '공개구역 관람 가능 여부',
    );
    expect(
      result.itinerary.steps.every(
        (step: any) =>
          step.programUri.startsWith('https://gyeryong.example/ontology#') &&
          step.distanceMeters === undefined &&
          step.estimatedTravelMinutes === undefined,
      ),
    ).toBe(true);
    expect(result.reasonSummary).toContain('관람 가능 여부');
    expect(JSON.stringify(result)).not.toMatch(
      /거창|가조|백두산천지온천|항노화힐링랜드|정지용|옥천|대청호|회산백련지|무안/,
    );
  });

  it('keeps the exact Hapcheon operational plan and supported pension actions in a Hapcheon-only pool', async () => {
    const { instance, traversal } = service();
    const result = await instance.buildRecommendation({
      contextNo: 'RC-HC',
      regionId: 'hapcheon',
      duration: '1N2D',
      companions: [{ relationship: 'family', healthConditions: [] }],
      transportMode: 'CAR',
      walkingLevel: 'LOW',
      companionConstraints: ['shortWalkingDistance'],
      activityPreferences: [
        'HAPCHEON_LAKE',
        'NATURE',
        'FOOD',
        'CAFE',
        'ACCOMMODATION',
        'REST_AND_RECOVERY',
      ],
      mustVisitPlaces: [
        {
          entityId: 'https://hapcheon.example/ontology#hapcheonLake',
          label: '합천호',
          resolved: true,
        },
      ],
      accommodationIntents: [
        {
          entityId:
            'https://hapcheon.example/ontology#hapcheonLakeSmilePension',
          label: '합천호 스마일펜션',
          resolved: true,
        },
      ],
      healthConditions: [],
      wellnessGoals: [],
      expandedConditions: [],
      environmentConditions: [],
      risks: [],
      runtimeStates: [],
    });
    expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();
    expect(result.regionId).toBe('hapcheon');
    expect(result.candidateRegionIds).toEqual(['hapcheon']);
    const steps = result.itinerary.steps;
    expect(steps.map((step: any) => step.programLabel)).toEqual(
      expect.arrayContaining(['합천호', '합천호 스마일펜션']),
    );
    const pension = steps.find(
      (step: any) => step.programLabel === '합천호 스마일펜션',
    );
    expect(pension).toMatchObject({
      entityType: 'ACCOMMODATION',
      accommodationType: 'PENSION',
      areaLabel: '합천호 권역',
      telephone: '055-931-1638',
      reservationUrl: 'https://rev.yapen.co.kr/',
      latitude: 35.524485899856,
      longitude: 128.01578179029,
    });
    expect(pension.actions).toHaveProperty('reserve');
    expect(pension.actions).toHaveProperty('call');
    expect(pension.actions.navigate).toEqual({
      latitude: 35.524485899856,
      longitude: 128.01578179029,
    });
    expect(
      steps.every((step: any) =>
        step.programUri.startsWith('https://hapcheon.example/ontology#'),
      ),
    ).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(
      /거창 항노화힐링랜드|백두산천지온천|정지용 생가|회산백련지|계룡 군문화축제|roomPrice|bookingAvailability|reviewScore/,
    );
  });

  it('never exposes Hapcheon entities in another regional candidate pool', () => {
    for (const regionId of ['okcheon', 'muan', 'gyeryong'])
      expect(
        regionalCandidateDataset(regionId)?.records.some((record) =>
          record.entityUri.includes('hapcheon'),
        ),
      ).toBe(false);
  });

  it('composes the exact overnight Hapcheon interests and honors a pension-first NOW override', async () => {
    const base = {
      contextNo: 'RC-HC-COMPOSE',
      regionId: 'hapcheon',
      duration: '1N2D',
      companions: [{ relationship: 'family', healthConditions: [] }],
      transportMode: 'CAR',
      walkingLevel: 'LOW',
      companionConstraints: ['shortWalkingDistance'],
      activityPreferences: [
        'HAPCHEON_LAKE',
        'NATURE',
        'FOOD',
        'CAFE',
        'ACCOMMODATION',
        'REST_AND_RECOVERY',
      ],
      mustVisitPlaces: [
        {
          entityId: 'https://hapcheon.example/ontology#hapcheonLake',
          label: '합천호',
          resolved: true,
        },
      ],
      accommodationIntents: [
        {
          entityId:
            'https://hapcheon.example/ontology#hapcheonLakeSmilePension',
          label: '합천호 스마일펜션',
          resolved: true,
        },
      ],
      healthConditions: [],
      wellnessGoals: [],
      expandedConditions: [],
      environmentConditions: [],
      risks: [],
      runtimeStates: [],
    };
    const normal = await service().instance.buildRecommendation(base);
    const steps = normal.itinerary.steps;
    expect(
      steps.map((step: any) => [step.programLabel, step.itineraryRole]),
    ).toEqual([
      ['합천호', 'ANCHOR'],
      ['씨파크', 'ACTIVITY'],
      ['북어마을', 'MEAL'],
      ['카페모이다', 'CAFE_BREAK'],
      ['합천호 스마일펜션', 'ACCOMMODATION'],
    ]);
    expect(steps.at(-1).actions).toEqual(
      expect.objectContaining({
        reserve: expect.any(Object),
        call: expect.any(Object),
        website: expect.any(Object),
        navigate: expect.any(Object),
      }),
    );
    expect(normal.interestCoverage.uncovered).toEqual([]);
    expect(normal.candidateRegionIds).toEqual(['hapcheon']);
    const now = await service().instance.buildRecommendation({
      ...base,
      contextNo: 'RC-HC-NOW',
      rawMessage: '많이 피곤해서 펜션으로 먼저 가고 싶어요.',
    });
    expect(now.itinerary.steps[0]).toMatchObject({
      programLabel: '합천호 스마일펜션',
      itineraryRole: 'ACCOMMODATION',
    });
    expect(
      now.itinerary.steps.slice(1).map((step: any) => step.programLabel),
    ).toEqual(steps.slice(0, -1).map((step: any) => step.programLabel));
  });

  it('keeps the exact Daejeon Jung-gu urban plan district-scoped with unknown movement operations', async () => {
    const { instance, traversal } = service();
    const result = await instance.buildRecommendation({
      contextNo: 'RC-DJ',
      regionId: 'daejeon-junggu',
      duration: 'DAY',
      companions: [{ relationship: 'parent', healthConditions: [] }],
      transportMode: 'PUBLIC_TRANSPORT',
      walkingLevel: 'LOW',
      companionConstraints: ['shortWalkingDistance'],
      activityPreferences: [
        'URBAN_CULTURE',
        'TRADITIONAL_MARKET',
        'FOOD',
        'CAFE',
        'REST_AND_RECOVERY',
      ],
      mustVisitPlaces: [
        {
          entityId:
            'https://daejeon-junggu.example/ontology#eunhaengJungangroCulturalArea',
          label: '은행동·중앙로 문화권',
          resolved: true,
        },
      ],
      healthConditions: [],
      wellnessGoals: [],
      expandedConditions: [],
      environmentConditions: [],
      risks: [],
      runtimeStates: [],
    });
    expect(traversal.findSuitablePrograms).not.toHaveBeenCalled();
    expect(result.regionId).toBe('daejeon-junggu');
    expect(result.candidateRegionIds).toEqual(['daejeon-junggu']);
    expect(result.itinerary.steps[0].programLabel).toBe('은행동·중앙로 문화권');
    expect(
      result.itinerary.steps.every(
        (step: any) =>
          step.programUri.startsWith(
            'https://daejeon-junggu.example/ontology#',
          ) &&
          step.distanceMeters === undefined &&
          step.estimatedTravelMinutes === undefined &&
          step.durationMinutes === undefined,
      ),
    ).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(
      /거창 항노화힐링랜드|백두산천지온천|정지용 생가|정지용문학관|회산백련지|계룡 군문화축제|합천호|스마일펜션/,
    );
    expect(serialized).not.toMatch(
      /walkingDistance|parkingAvailability|publicTransportTime|latitude|longitude|temperature/,
    );
  });

  it('never exposes Daejeon Jung-gu entities in another regional pool', () => {
    for (const regionId of ['okcheon', 'muan', 'gyeryong', 'hapcheon'])
      expect(
        regionalCandidateDataset(regionId)?.records.some((record) =>
          record.entityUri.includes('daejeon-junggu'),
        ),
      ).toBe(false);
  });

  it('leaves Gajo candidate discovery on the existing ontology traversal', async () => {
    const { instance, traversal } = service();
    await instance.buildRecommendation({
      contextNo: 'RC-GAJO',
      regionId: 'gajo',
      healthConditions: [],
      wellnessGoals: [],
      expandedConditions: [],
      environmentConditions: [],
      risks: [],
      runtimeStates: [],
    });
    expect(traversal.findSuitablePrograms).toHaveBeenCalledTimes(1);
  });
});
