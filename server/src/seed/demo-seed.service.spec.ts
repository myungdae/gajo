import { DemoSeedService } from './demo-seed.service';

describe('DemoSeedService runtime re-planning scenario', () => {
  it('creates a clear-weather itinerary with completed history and a future outdoor activity', async () => {
    const contextService: any = { createContext: jest.fn(async (input) => ({ context: { contextNo: 'RC-DEMO', operationUri: 'operation', ...input, environmentConditions: ['clearWeather'], expandedConditions: ['shortWalkingDistance'] }, evidence: [], firedRules: [] })) };
    const orchestrator: any = { run: jest.fn(async () => ({ recommendation: { itineraryNo: 'IT-DEMO', itinerary: { steps: [] } } })) };
    const labels: Record<string, string> = { lowIntensityHotSpringCourse: '저강도 실내 온천 힐링 코스', indoorHotSpringBath: '실내 온천탕', localFoodHealingMeal: '지역 약선식 힐링 식사', localFoodRestaurant: '지역 약선식 식당', healingWalkingTrail: '힐링 산책로', wellnessLounge: '웰니스 라운지' };
    const traversal: any = { label: (uri: string) => labels[uri.split('#').pop() || ''] || uri };
    let update: any;
    const itineraryModel: any = { findOneAndUpdate: jest.fn((_filter, value) => { update = value; return { lean: async () => ({ itineraryNo: 'IT-DEMO', steps: value.$set.steps }) }; }) };
    const service = new DemoSeedService(contextService, orchestrator, traversal, itineraryModel);
    const result = await service.runDemoScenario();
    expect(contextService.createContext).toHaveBeenCalledWith(expect.objectContaining({ weather: 'clearWeather', precipitation: 0, transportMode: 'CAR', stayUntil: '17:00' }));
    expect(update.$set.steps.slice(0, 2).map((step: any) => step.status)).toEqual(['COMPLETED', 'COMPLETED']);
    expect(update.$set.steps[2]).toMatchObject({ facilityLabel: '힐링 산책로', status: 'PLANNED' });
    expect(result.runResult.recommendation.itinerary.steps[2].programLabel).toBe('힐링 산책로');
    expect(result.runResult.recommendation.itinerary.steps.some((step: any) => step.programUri?.endsWith('#shortIndoorSeniorCourse'))).toBe(false);
  });
});
