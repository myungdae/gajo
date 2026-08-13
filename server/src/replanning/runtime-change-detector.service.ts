import { Injectable } from '@nestjs/common';
import type { EntityRuntimeState, RuntimeChangeEvent } from '../context/runtime-context.types';
import { isOperationalLocation } from '../context/location-confidence';

export const RUNTIME_THRESHOLDS = { heavyRainPrecipitationMm: 15, dayStartsAtHour: 6, nightStartsAtHour: 18, materialLocationMeters: 150 } as const;

@Injectable()
export class RuntimeChangeDetectorService {
  detect(previous: any, current: any): RuntimeChangeEvent[] {
    const events: RuntimeChangeEvent[] = [];
    const observedAt = current.observedAt || new Date().toISOString();
    const add = (event: Omit<RuntimeChangeEvent, 'observedAt'>) => events.push({ ...event, observedAt });
    const previousRain = Number(previous.precipitation || 0);
    const currentRain = Number(current.precipitation || 0);
    const previousWeather = previous.weatherState || previous.weather;
    const currentWeather = current.weatherState || current.weather;
    if (isOperationalLocation(previous) && isOperationalLocation(current)) {
      const moved = this.distance(previous, current);
      const accuracyAllowance = Math.max(Number(previous.locationAccuracy || 0), Number(current.locationAccuracy || 0));
      if (moved > RUNTIME_THRESHOLDS.materialLocationMeters + accuracyAllowance) add({ eventType: 'LOCATION_CHANGED', previousValue: { status: 'AVAILABLE' }, currentValue: { status: 'AVAILABLE', distanceMeters: moved }, severity: 'MEDIUM', evidence: [`이전 확인 위치에서 약 ${Math.round(moved)}m 이동`] });
    }

    if ((currentRain >= RUNTIME_THRESHOLDS.heavyRainPrecipitationMm && previousRain < RUNTIME_THRESHOLDS.heavyRainPrecipitationMm) || (currentWeather === 'HEAVY_RAIN' && previousWeather !== 'HEAVY_RAIN')) {
      add({ eventType: 'HEAVY_RAIN', previousValue: previousRain, currentValue: currentRain, severity: 'HIGH', evidence: [`강수량 ${currentRain}mm`] });
    } else if (previousWeather && currentWeather && previousWeather !== currentWeather) {
      add({ eventType: 'WEATHER_CHANGED', previousValue: previousWeather, currentValue: currentWeather, severity: 'MEDIUM', evidence: ['날씨 관측값 변경'] });
    }

    const previousStates = new Map<string, EntityRuntimeState>((previous.runtimeStates || []).map((s: EntityRuntimeState) => [s.entityUri, s]));
    for (const state of (current.runtimeStates || []) as EntityRuntimeState[]) {
      const before = previousStates.get(state.entityUri);
      if (!before) continue;
      if (before.congestion !== state.congestion && state.congestion === 'HIGH') add({ eventType: 'CONGESTION_CHANGED', entityUri: state.entityUri, previousValue: before.congestion, currentValue: state.congestion, severity: 'HIGH', evidence: ['혼잡도 HIGH 관측'] });
      const closed = before.operatingState !== state.operatingState && state.operatingState === 'CLOSED';
      const unavailable = before.availability !== state.availability && state.availability === 'UNAVAILABLE';
      if (closed || unavailable) add({ eventType: 'FACILITY_UNAVAILABLE', entityUri: state.entityUri, previousValue: closed ? before.operatingState : before.availability, currentValue: closed ? state.operatingState : state.availability, severity: 'CRITICAL', evidence: ['시설 운영 불가 관측'] });
      if (before.operatingState !== state.operatingState && state.operatingState === 'CLOSING_SOON') add({ eventType: 'CLOSING_SOON', entityUri: state.entityUri, previousValue: before.operatingState, currentValue: state.operatingState, severity: 'HIGH', evidence: [state.closingTime ? `마감 ${state.closingTime}` : '마감 임박 관측'] });
      if (before.reservationState !== state.reservationState && state.reservationState === 'FULL') add({ eventType: 'RESERVATION_UNAVAILABLE', entityUri: state.entityUri, previousValue: before.reservationState, currentValue: state.reservationState, severity: 'CRITICAL', evidence: ['필수 예약 마감 관측'] });
    }

    const previousHour = this.hour(previous.currentTime);
    const currentHour = this.hour(current.currentTime);
    if (previousHour !== undefined && currentHour !== undefined && previousHour < RUNTIME_THRESHOLDS.nightStartsAtHour && currentHour >= RUNTIME_THRESHOLDS.nightStartsAtHour) add({ eventType: 'DAY_TO_NIGHT', previousValue: previous.currentTime, currentValue: current.currentTime, severity: 'MEDIUM', evidence: ['주간에서 야간으로 전환'] });
    return events;
  }

  private hour(value?: string) { const match = value?.match(/(?:T|^)(\d{1,2}):/); return match ? Number(match[1]) : undefined; }
  private distance(a: any, b: any) { const rad=(x:number)=>x*Math.PI/180,dLat=rad(Number(b.latitude)-Number(a.latitude)),dLon=rad(Number(b.longitude)-Number(a.longitude)); const h=Math.sin(dLat/2)**2+Math.cos(rad(Number(a.latitude)))*Math.cos(rad(Number(b.latitude)))*Math.sin(dLon/2)**2; return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)); }
}
