import { LiveWeatherProviderService } from './live-weather-provider.service';

const config: any = { get: (key: string) => ({ GAJO_LATITUDE: undefined, GAJO_LONGITUDE: undefined, GAJO_TIMEZONE: undefined, OPEN_METEO_TIMEOUT_MS: 1000 } as any)[key] };

describe('LiveWeatherProviderService', () => {
  afterEach(() => jest.restoreAllMocks());
  it('normalizes Open-Meteo observations into operational weather states', () => {
    const service = new LiveWeatherProviderService(config);
    expect(service.normalize({ time: '2026-08-09T10:00', temperature_2m: 27, precipitation: 20, rain: 20, weather_code: 65, wind_speed_10m: 4, is_day: 1 })).toMatchObject({ weather: 'HEAVY_RAIN', temperature: 27, precipitation: 20, status: 'LIVE', source: 'OPEN_METEO' });
    expect(service.normalize({ weather_code: 0, precipitation: 0 }).weather).toBe('CLEAR');
    expect(service.normalize({ weather_code: 95, precipitation: 1 }).weather).toBe('THUNDERSTORM');
  });
  it('returns the last usable observation as STALE after provider failure', async () => {
    const service = new LiveWeatherProviderService(config);
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ current: { time: '2026-08-09T10:00', weather_code: 0, precipitation: 0 } }) } as any).mockRejectedValueOnce(new Error('offline'));
    await service.getCurrent();
    expect(await service.getCurrent()).toMatchObject({ weather: 'CLEAR', status: 'STALE', stale: true });
  });
  it('returns UNKNOWN safely when no observation has ever succeeded', async () => {
    const service = new LiveWeatherProviderService(config);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await service.getCurrent()).toMatchObject({ weather: 'UNKNOWN', status: 'UNAVAILABLE', source: 'UNAVAILABLE' });
  });
});
