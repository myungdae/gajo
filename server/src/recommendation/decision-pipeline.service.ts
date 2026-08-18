import { Injectable } from '@nestjs/common';
import type { EntityRuntimeState } from '../context/runtime-context.types';
import type { Coordinates } from '../context/entity-location.service';

export interface DecisionCandidate {
  regionId?: string;
  isMustVisit?: boolean;
  allowUnknownDuration?: boolean;
  entityType?: string;
  accommodationType?: string;
  areaLabel?: string;
  eventAvailability?: string;
  accessStatus?: string;
  accessNotice?: string;
  programUri: string;
  programLabel: string;
  facilityUri?: string;
  facilityLabel?: string;
  matchedOn: string[];
  matchedLabels: string[];
  mitigatesRisk: string[];
  mitigationLabels: string[];
  requiredMobility: string[];
  affectedByEnvironment: string[];
  durationMinutes?: number;
  requiresReservation: boolean;
  isIndoor?: boolean;
  isAccessible?: boolean;
  isMeal?: boolean;
  runtime?: EntityRuntimeState;
  score?: number;
  coordinates?: Coordinates;
  distanceStatus?: 'AVAILABLE' | 'UNKNOWN';
  distanceMeters?: number;
  distanceKm?: number;
  estimatedTravelMinutes?: number;
}

export interface DecisionContext {
  currentTime?: string;
  stayUntil?: string;
  environmentConditions: string[];
  expandedConditions: string[];
  walkingLevel?: string;
  latitude?: number;
  longitude?: number;
  transportMode?: string;
  maxWalkingDistanceMeters?: number;
}

export interface FeasibilityRejection {
  candidate: DecisionCandidate;
  reasons: string[];
  reasonCodes: CandidateRejectionCode[];
}

export type CandidateRejectionCode =
  | 'CLOSED'
  | 'UNAVAILABLE'
  | 'TIME_WINDOW'
  | 'RESERVATION_FULL'
  | 'MOBILITY_INCOMPATIBLE'
  | 'NO_DURATION'
  | 'DUPLICATE'
  | 'WEATHER_INCOMPATIBLE';

export interface DecisionPipelineResult {
  feasible: DecisionCandidate[];
  rejected: FeasibilityRejection[];
  ranked: DecisionCandidate[];
  sequenced: DecisionCandidate[];
  reasonSummary: string;
}

function minutes(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

@Injectable()
export class DecisionPipelineService {
  run(candidates: DecisionCandidate[], context: DecisionContext): DecisionPipelineResult {
    const { feasible, rejected } = this.feasibility(candidates, context);
    const ranked = this.suitability(feasible, context);
    const sequenced = this.sequence(ranked, context);
    return { feasible, rejected, ranked, sequenced, reasonSummary: this.explain(sequenced, context) };
  }

  feasibility(candidates: DecisionCandidate[], context: DecisionContext) {
    const feasible: DecisionCandidate[] = [];
    const rejected: FeasibilityRejection[] = [];
    const now = minutes(context.currentTime);
    const stayUntil = minutes(context.stayUntil);
    const mobilityLimited = context.expandedConditions.some((uri) =>
      /shortWalkingDistance|wheelchairAccessible|elevatorAvailable/.test(uri),
    );

    for (const candidate of candidates) {
      const state = candidate.runtime || { entityUri: candidate.facilityUri || candidate.programUri };
      const reasons: string[] = [];
      const reasonCodes: CandidateRejectionCode[] = [];
      if (state.availability === 'UNAVAILABLE') { reasons.push('프로그램 또는 시설을 현재 이용할 수 없음'); reasonCodes.push('UNAVAILABLE'); }
      if (state.operatingState === 'CLOSED') { reasons.push('시설이 현재 폐장 상태임'); reasonCodes.push('CLOSED'); }
      if (candidate.requiresReservation && state.reservationState === 'FULL') { reasons.push('필수 예약이 마감됨'); reasonCodes.push('RESERVATION_FULL'); }
      if (mobilityLimited && candidate.requiredMobility.some((uri) => /stairsRequired/.test(uri))) {
        reasons.push('방문객의 이동 제약과 맞지 않음');
        reasonCodes.push('MOBILITY_INCOMPATIBLE');
      }
      if (!candidate.allowUnknownDuration && (!Number.isFinite(candidate.durationMinutes) || (candidate.durationMinutes || 0) <= 0)) { reasons.push('예상 소요시간 정보가 없음'); reasonCodes.push('NO_DURATION'); }
      const travel = candidate.estimatedTravelMinutes ?? state.estimatedTravelMinutes ?? 0;
      if (context.transportMode === 'WALK' && context.maxWalkingDistanceMeters && candidate.distanceMeters && candidate.distanceMeters > context.maxWalkingDistanceMeters) {
        reasons.push('설정된 최대 보행 거리보다 멂'); reasonCodes.push('MOBILITY_INCOMPATIBLE');
      }
      const finish = now === undefined || !candidate.durationMinutes ? undefined : now + travel + candidate.durationMinutes;
      const close = minutes(state.closingTime);
      if (finish !== undefined && close !== undefined && finish > close) { reasons.push('폐장 전에 이용을 마칠 수 없음'); reasonCodes.push('TIME_WINDOW'); }
      if (finish !== undefined && stayUntil !== undefined && finish > stayUntil) { reasons.push('체류 종료 시간 전에 이용을 마칠 수 없음'); reasonCodes.push('TIME_WINDOW'); }
      if (reasons.length) rejected.push({ candidate, reasons, reasonCodes: Array.from(new Set(reasonCodes)) });
      else feasible.push(candidate);
    }
    return { feasible, rejected };
  }

  suitability(candidates: DecisionCandidate[], context: DecisionContext): DecisionCandidate[] {
    const rainy = context.environmentConditions.some((uri) => /rainyWeather|heavyRain/i.test(uri));
    const mobilityLimited = context.expandedConditions.some((uri) => /shortWalkingDistance|limitedMobility/.test(uri));
    return candidates
      .map((candidate) => {
        let score = candidate.matchedOn.length * 10 + candidate.mitigatesRisk.length * 5;
        if (candidate.isMustVisit) score += 1000;
        if (mobilityLimited && (candidate.isAccessible || candidate.requiredMobility.some((u) => /shortWalkingDistance|elevatorAvailable/.test(u)))) score += 8;
        if (rainy) score += candidate.isIndoor ? 8 : -8;
        if (candidate.runtime?.congestion === 'HIGH') score -= 4;
        if (candidate.runtime?.operatingState === 'CLOSING_SOON') score += 2;
        if (candidate.requiresReservation && candidate.runtime?.reservationState === 'AVAILABLE') score += 2;
        if (candidate.distanceStatus === 'AVAILABLE') {
          if ((candidate.distanceMeters || 0) <= 500) score += mobilityLimited ? 4 : 2;
          else if ((candidate.distanceMeters || 0) <= 1500) score += 1;
          else if (context.transportMode === 'WALK' && mobilityLimited) score -= (candidate.distanceMeters || 0) > 3000 ? 7 : 4;
        }
        return { ...candidate, score };
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0) || a.programUri.localeCompare(b.programUri));
  }

  sequence(candidates: DecisionCandidate[], context: DecisionContext): DecisionCandidate[] {
    const now = minutes(context.currentTime);
    const remaining = [...candidates];
    const result: DecisionCandidate[] = [];
    let current: Coordinates | undefined = Number.isFinite(context.latitude) && Number.isFinite(context.longitude) ? { latitude: context.latitude!, longitude: context.longitude! } : undefined;
    const distance = (to?: Coordinates) => {
      if (!current || !to) return Number.MAX_SAFE_INTEGER;
      const rad = (x: number) => x * Math.PI / 180, dLat = rad(to.latitude-current!.latitude), dLon = rad(to.longitude-current!.longitude);
      const h = Math.sin(dLat/2)**2 + Math.cos(rad(current.latitude))*Math.cos(rad(to.latitude))*Math.sin(dLon/2)**2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
    };
    const compare = (a: DecisionCandidate, b: DecisionCandidate) => {
      const aClose = minutes(a.runtime?.closingTime) ?? Number.MAX_SAFE_INTEGER;
      const bClose = minutes(b.runtime?.closingTime) ?? Number.MAX_SAFE_INTEGER;
      const aUrgent = a.runtime?.operatingState === 'CLOSING_SOON' ? 0 : 1;
      const bUrgent = b.runtime?.operatingState === 'CLOSING_SOON' ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      if (Boolean(a.isMustVisit) !== Boolean(b.isMustVisit)) return a.isMustVisit ? -1 : 1;
      if (aClose !== bClose) return aClose - bClose;
      const mealTime = now !== undefined && now >= 11 * 60 && now <= 14 * 60;
      if (mealTime && Boolean(a.isMeal) !== Boolean(b.isMeal)) return a.isMeal ? -1 : 1;
      const proximity = distance(a.coordinates) - distance(b.coordinates);
      if (proximity !== 0) return proximity;
      return (b.score || 0) - (a.score || 0) || a.programUri.localeCompare(b.programUri);
    };
    while (remaining.length) { remaining.sort(compare); const next = remaining.shift()!; result.push(next); current = next.coordinates || current; }
    return result;
  }

  explain(candidates: DecisionCandidate[], context: DecisionContext): string {
    if (!candidates.length) return '현재 운영 조건과 체류 시간 안에서 이용 가능한 프로그램을 찾지 못했습니다.';
    const first = candidates[0];
    const reasons = [...first.matchedLabels];
    if (first.distanceStatus === 'AVAILABLE' && first.distanceKm !== undefined) reasons.push(`현재 위치에서 약 ${first.distanceKm < 1 ? `${first.distanceMeters}m` : `${first.distanceKm}km`}로 가까움`);
    if (context.environmentConditions.some((u) => /rainyWeather|heavyRain/i.test(u)) && first.isIndoor) reasons.push('비 오는 날씨에 적합한 실내 활동');
    if (context.expandedConditions.some((u) => /shortWalkingDistance/.test(u)) && (first.isAccessible || first.requiredMobility.some((u) => /shortWalkingDistance/.test(u)))) reasons.push('짧은 보행 거리');
    reasons.push(...first.mitigationLabels.map((label) => `${label} 완화`));
    const unique = Array.from(new Set(reasons.filter(Boolean))).slice(0, 4);
    return `${unique.join(', ')} 근거를 고려해 ${first.programLabel}을(를) 우선 추천합니다.`;
  }
}
