import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NormalizedWeatherObservation, OperationalWeatherState } from './runtime-context.types';

export const DEFAULT_GAJO_LOCATION = { latitude: 35.7423, longitude: 127.9528, timezone: 'Asia/Seoul' } as const;
export const WEATHER_THRESHOLDS = { lightRainMm: 0.1, rainMm: 2.5, heavyRainMm: 15 } as const;

@Injectable()
export class LiveWeatherProviderService {
  private lastKnown?: NormalizedWeatherObservation;
  constructor(private readonly config: ConfigService) {}

  get location() {
    return {
      latitude: Number(this.config.get('GAJO_LATITUDE') ?? DEFAULT_GAJO_LOCATION.latitude),
      longitude: Number(this.config.get('GAJO_LONGITUDE') ?? DEFAULT_GAJO_LOCATION.longitude),
      timezone: this.config.get<string>('GAJO_TIMEZONE') || DEFAULT_GAJO_LOCATION.timezone,
    };
  }

  async getCurrent(): Promise<NormalizedWeatherObservation> {
    const { latitude, longitude, timezone } = this.location;
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), timezone, current: 'temperature_2m,precipitation,rain,weather_code,wind_speed_10m,is_day' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(this.config.get('OPEN_METEO_TIMEOUT_MS') || 3500));
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`weather provider ${response.status}`);
      const body: any = await response.json();
      const observation = this.normalize(body.current || {});
      this.lastKnown = observation;
      return observation;
    } catch {
      if (this.lastKnown) return { ...this.lastKnown, status: 'STALE', stale: true };
      return { observedAt: new Date().toISOString(), weather: 'UNKNOWN', source: 'UNAVAILABLE', status: 'UNAVAILABLE', stale: false };
    } finally {
      clearTimeout(timeout);
    }
  }

  normalize(current: any): NormalizedWeatherObservation {
    const precipitation = this.number(current.precipitation);
    const weatherCode = this.number(current.weather_code);
    return {
      observedAt: current.time || new Date().toISOString(),
      weather: this.normalizeState(weatherCode, precipitation),
      temperature: this.number(current.temperature_2m), precipitation,
      rain: this.number(current.rain), weatherCode, windSpeed: this.number(current.wind_speed_10m),
      isDay: current.is_day === undefined ? undefined : Number(current.is_day) === 1,
      source: 'OPEN_METEO', status: 'LIVE', stale: false,
    };
  }

  private normalizeState(code?: number, precipitation = 0): OperationalWeatherState {
    if (code !== undefined && [95, 96, 99].includes(code)) return 'THUNDERSTORM';
    if (code !== undefined && ((code >= 71 && code <= 77) || [85, 86].includes(code))) return 'SNOW';
    if (precipitation >= WEATHER_THRESHOLDS.heavyRainMm || code === 82) return 'HEAVY_RAIN';
    if (precipitation >= WEATHER_THRESHOLDS.rainMm || (code !== undefined && [55, 56, 57, 63, 65, 66, 67, 80, 81].includes(code))) return 'RAIN';
    if (precipitation >= WEATHER_THRESHOLDS.lightRainMm || (code !== undefined && [51, 53, 61].includes(code))) return 'LIGHT_RAIN';
    if (code === 0) return 'CLEAR';
    if (code !== undefined && [1, 2, 3, 45, 48].includes(code)) return 'CLOUDY';
    return 'UNKNOWN';
  }
  private number(value: unknown): number | undefined { const parsed = Number(value); return value === undefined || value === null || !Number.isFinite(parsed) ? undefined : parsed; }
}
