import { LiveRuntimeHydrationService } from './live-runtime-hydration.service';

const observation: any = { observedAt: '2026-08-09T09:42', weather: 'RAIN', temperature: 24, precipitation: 3, source: 'OPEN_METEO', status: 'LIVE', stale: false };
const provider: any = { location: { latitude: 35.7423, longitude: 127.9528, timezone: 'Asia/Seoul',sourceId:'gajo-weather-reference' },locationFor:jest.fn(()=>({latitude:35.7423,longitude:127.9528,timezone:'Asia/Seoul',sourceId:'gajo-weather-reference'})), getCurrent: jest.fn(async () => observation) };

describe('LiveRuntimeHydrationService', () => {
  const service = new LiveRuntimeHydrationService(provider);
  it('hydrates actual Seoul local date, time, and weekday', () => {
    expect(service.seoulTime(new Date('2026-08-09T00:42:30Z'))).toEqual({ currentDate: '2026-08-09', currentTime: '09:42:30', dayOfWeek: 'Sunday' });
  });
  it('enriches weather while preserving visitor and companion constraints', () => {
    const base = { contextNo: 'RC-1', healthConditions: ['kneePain'], companionConstraints: ['elderlyCompanion'], transportMode: 'CAR', walkingLevel: 'LOW', stayUntil: '17:00', latitude: 35.7, longitude: 127.9 };
    const result = service.hydrate(base, observation, new Date('2026-08-09T00:42:30Z'));
    expect(result.context).toMatchObject({ weather: 'RAIN', temperature: 24, precipitation: 3, healthConditions: ['kneePain'], companionConstraints: ['elderlyCompanion'], transportMode: 'CAR', walkingLevel: 'LOW', stayUntil: '17:00', latitude: 35.7, longitude: 127.9 });
    expect(result.context.environmentConditions.some((uri: string) => uri.endsWith('#rainyWeather'))).toBe(true);
  });
  it('keeps live hydration separate from and non-mutating to demo context input', () => {
    const demo = { contextNo: 'DEMO', weather: 'clearWeather', precipitation: 0 };
    service.hydrate(demo, observation, new Date('2026-08-09T00:42:30Z'));
    expect(demo).toEqual({ contextNo: 'DEMO', weather: 'clearWeather', precipitation: 0 });
  });
  it('marks unavailable non-Gajo hydration with the requested region and no live weather values',()=>{const unavailable={...observation,weather:'UNKNOWN',temperature:undefined,precipitation:undefined,source:'UNAVAILABLE',status:'UNAVAILABLE'}as any;const result=service.hydrate({regionId:'hapcheon',temperature:23,weatherState:'CLOUDY'},unavailable,new Date('2026-08-09T00:42:30Z'),{regionId:'hapcheon'});expect(result.metadata).toMatchObject({regionId:'hapcheon',status:'UNAVAILABLE'});expect(result.context).toMatchObject({regionId:'hapcheon',weather:'UNKNOWN',weatherState:'UNKNOWN'});expect(result.context.temperature).toBeUndefined()});
});
