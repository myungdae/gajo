import { Injectable } from '@nestjs/common';
import { GraphTraversalService } from '../context/graph-traversal.service';
import type { RuntimeChangeEvent, RuntimeImpactLevel } from '../context/runtime-context.types';
import { EntityLocationService } from '../context/entity-location.service';
import { isOperationalLocation } from '../context/location-confidence';

export interface AssessedImpact { event: RuntimeChangeEvent; level: RuntimeImpactLevel; affectedItems: any[]; reasons: string[]; evidence: any[]; }

@Injectable()
export class ImpactAssessmentService {
  constructor(private readonly traversal: GraphTraversalService, private readonly locations: EntityLocationService) {}

  assess(event: RuntimeChangeEvent, itinerary: any, context: any): AssessedImpact {
    const future = (itinerary.steps || []).filter((step: any) => step.status !== 'COMPLETED' && step.status !== 'SKIPPED');
    let affected: any[] = [];
    const reasons: string[] = [];
    const evidence: any[] = [];
    let level: RuntimeImpactLevel = 'NONE';
    if (event.eventType === 'HEAVY_RAIN' || event.eventType === 'WEATHER_CHANGED') {
      affected = future.filter((step: any) => this.isOutdoor(step, event, evidence));
      const unsafeWeather = event.eventType === 'HEAVY_RAIN' || ['RAIN', 'HEAVY_RAIN', 'THUNDERSTORM', 'SNOW'].includes(String(event.currentValue));
      if (affected.length) { level = unsafeWeather ? 'HIGH' : 'MEDIUM'; reasons.push('미완료 야외 활동이 현재 날씨의 영향을 받음'); }
    } else if (event.eventType === 'LOCATION_CHANGED') {
      const next = future[0];
      if (next) {
        const destination = this.locations.coordinatesFor(next.programUri, next.facilityUri);
        const origin = isOperationalLocation(context) ? { latitude: context.latitude, longitude: context.longitude } : undefined;
        const distance = this.locations.distance(origin, destination);
        const travel = this.locations.estimateTravelMinutes(distance.distanceMeters, context.transportMode);
        const now = this.minutes(context.currentTime), stay = this.minutes(context.stayUntil);
        if (travel !== undefined && now !== undefined && stay !== undefined && now + travel + (next.durationMinutes || 0) > stay) { affected = [next]; level = 'HIGH'; reasons.push('현재 위치에서 이동하면 체류 종료 전 이용이 어려움'); }
        else if (distance.distanceStatus === 'AVAILABLE') { affected = [next]; level = 'LOW'; reasons.push('현재 위치 변화로 다음 일정까지의 이동 부담이 달라짐'); }
      }
    } else if (event.entityUri) {
      affected = future.filter((step: any) => step.facilityUri === event.entityUri || step.programUri === event.entityUri);
      if (event.eventType === 'RESERVATION_UNAVAILABLE') affected = affected.filter((step: any) => step.requiresReservation);
      if (affected.length && ['FACILITY_UNAVAILABLE', 'RESERVATION_UNAVAILABLE'].includes(event.eventType)) { level = 'CRITICAL'; reasons.push('해당 일정은 객관적으로 이용할 수 없음'); }
      else if (affected.length && event.eventType === 'CLOSING_SOON') {
        const state = (context.runtimeStates || []).find((item: any) => item.entityUri === event.entityUri);
        const now = this.minutes(context.currentTime); const close = this.minutes(state?.closingTime);
        const impossible = now !== undefined && close !== undefined && affected.some((step: any) => now + (state?.estimatedTravelMinutes || 0) + (step.durationMinutes || 0) > close);
        level = impossible ? 'HIGH' : 'LOW'; reasons.push(impossible ? '도착 또는 이용 완료 전에 마감됨' : '마감이 임박했지만 현재는 이용 가능함');
      }
      else if (affected.length && event.eventType === 'CONGESTION_CHANGED') {
        const vulnerable = (context.companionConstraints || []).length > 0 || (context.expandedConditions || []).some((u: string) => /shortWalkingDistance|limitedMobility/.test(u));
        level = vulnerable ? 'HIGH' : 'MEDIUM'; reasons.push(vulnerable ? '동반자 및 이동 제약에 높은 혼잡도가 부담됨' : '미완료 일정의 혼잡도가 높아짐');
      }
    }
    event.affectedItineraryItemIds = affected.map((step) => step.itemId || String(step.order));
    return { event, level, affectedItems: affected, reasons, evidence };
  }

  private isOutdoor(step: any, event: RuntimeChangeEvent, evidence: any[]) {
    const facilityLiterals = step.facilityUri ? this.traversal.literalProps(step.facilityUri) : {};
    const programProps = step.programUri ? this.traversal.objectProps(step.programUri) : {};
    const affectedBy = programProps.affectedByEnvironment || [];
    const outdoor = facilityLiterals.isIndoor === 'false' || affectedBy.some((uri) => /rainyWeather/.test(uri));
    if (outdoor) evidence.push({ subject: step.programUri || step.facilityUri, predicate: 'affectedByEnvironment/isIndoor', object: event.eventType });
    return outdoor;
  }
  private minutes(value?: string) { const match = value?.match(/(?:T|^)(\d{1,2}):(\d{2})/); return match ? Number(match[1]) * 60 + Number(match[2]) : undefined; }
}
