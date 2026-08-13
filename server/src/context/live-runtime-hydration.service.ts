import { Injectable } from '@nestjs/common';
import { LiveWeatherProviderService } from './live-weather-provider.service';
import { gajo } from '../ontology/ontology.constants';
import type { NormalizedWeatherObservation } from './runtime-context.types';

@Injectable()
export class LiveRuntimeHydrationService {
  constructor(private readonly weatherProvider: LiveWeatherProviderService) {}

  async hydrateLiveRuntimeContext(baseContext: any = {}, now = new Date()) {
    const observation = await this.weatherProvider.getCurrent();
    return this.hydrate(baseContext, observation, now);
  }

  hydrate(baseContext: any, observation: NormalizedWeatherObservation, now: Date) {
    const time = this.seoulTime(now);
    const environment = [...(baseContext.environmentConditions || [])].filter((uri: string) => !/clearWeather|rainyWeather/.test(uri));
    if (['CLEAR', 'CLOUDY'].includes(observation.weather)) environment.push(gajo('clearWeather'));
    if (['LIGHT_RAIN', 'RAIN', 'HEAVY_RAIN', 'THUNDERSTORM'].includes(observation.weather)) environment.push(gajo('rainyWeather'));
    return {
      context: {
        ...baseContext,
        weather: observation.weather,
        weatherState: observation.weather,
        temperature: observation.temperature,
        precipitation: observation.precipitation,
        rain: observation.rain,
        windSpeed: observation.windSpeed,
        isDay: observation.isDay,
        currentTime: time.currentTime,
        currentDate: time.currentDate,
        dayOfWeek: time.dayOfWeek,
        environmentConditions: observation.status === 'UNAVAILABLE' ? (baseContext.environmentConditions || []) : Array.from(new Set(environment)),
      },
      metadata: {
        observedAt: observation.observedAt,
        source: observation.source,
        status: observation.status,
        stale: observation.stale,
        location: this.weatherProvider.location,
      },
    };
  }

  seoulTime(date: Date) {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: this.weatherProvider.location.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'long' });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return { currentDate: `${parts.year}-${parts.month}-${parts.day}`, currentTime: `${parts.hour}:${parts.minute}:${parts.second}`, dayOfWeek: parts.weekday };
  }
}
