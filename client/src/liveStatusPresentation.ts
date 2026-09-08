import { findRegionConfig, getRegionalHomeEnglish } from './regionConfig.ts';
import type { VisitorLocale } from './visitorLocaleContract.ts';

const WEATHER = [
  ['CLEAR', '맑음', 'Clear'], ['CLOUDY', '흐림', 'Cloudy'],
  ['PARTLY_CLOUDY', '구름 많음', 'Mostly cloudy'],
  ['LIGHT_RAIN', '약한 비', 'Light rain'], ['RAIN', '비', 'Rain'],
  ['HEAVY_RAIN', '강한 비', 'Heavy rain'], ['SHOWER', '소나기', 'Showers'],
  ['THUNDERSTORM', '뇌우', 'Thunderstorm'], ['SNOW', '눈', 'Snow'],
  ['FOG', '안개', 'Fog'], ['STRONG_WIND', '강풍', 'Strong winds'],
  ['UNKNOWN', '날씨 정보 없음', 'Weather unavailable'],
] as const;

export function weatherStatusIcon(value: unknown): string {
  const aliases: Record<string,string> = {
    SHOWERS:'SHOWER',
    WIND:'STRONG_WIND',
    WINDY:'STRONG_WIND',
  };
  const raw=typeof value==='string'?value.trim():'';
  const key=aliases[raw]||raw;

  if(key==='CLEAR'||raw==='맑음') return '☀️';
  if(key==='PARTLY_CLOUDY'||raw==='구름 많음') return '🌤️';
  if(key==='CLOUDY'||raw==='흐림') return '☁️';
  if(key==='LIGHT_RAIN'||raw==='약한 비') return '🌦️';
  if(key==='RAIN'||key==='HEAVY_RAIN'||raw==='비'||raw==='강한 비') return '🌧️';
  if(key==='SHOWER'||raw==='소나기') return '🌦️';
  if(key==='THUNDERSTORM'||raw==='뇌우') return '⛈️';
  if(key==='SNOW'||raw==='눈') return '🌨️';
  if(key==='FOG'||raw==='안개') return '🌫️';
  if(key==='STRONG_WIND'||raw==='강풍') return '💨';

  return '🌡️';
}

export function weatherStatusLabel(value: unknown, locale: VisitorLocale): string {
  const aliases: Record<string, string> = { SHOWERS: 'SHOWER', WIND: 'STRONG_WIND', WINDY: 'STRONG_WIND' };
  const key = typeof value === 'string' ? value.trim() : '';
  const row = WEATHER.find(([code, ko]) => code === (aliases[key] || key) || ko === key);
  return row ? row[locale === 'en' ? 2 : 1] : locale === 'en' ? 'Weather unavailable' : '날씨 정보 없음';
}

export function liveRegionName(regionId: string, koreanName: string, locale: VisitorLocale): string {
  const region = findRegionConfig(regionId);
  return locale === 'en' ? (region && getRegionalHomeEnglish(region)?.regionName) || 'this area' : koreanName;
}

export function liveStatusHeading(regionId: string, koreanName: string, locale: VisitorLocale): string {
  const name = liveRegionName(regionId, koreanName, locale);
  return locale === 'en' ? `Now in ${name}` : `지금 ${name}`;
}
