import { Injectable } from '@nestjs/common';
import type { LocationStatus } from './runtime-context.types';
import { locationConfidence } from './location-confidence';

export interface LocationObservation { latitude?: number; longitude?: number; accuracy?: number; observedAt?: string; status?: LocationStatus }

@Injectable()
export class LocationHydrationService {
  hydrate(base: any, observation: LocationObservation = {}) {
    const status = observation.status || 'UNKNOWN';
    const available = status === 'AVAILABLE' && Number.isFinite(observation.latitude) && Number.isFinite(observation.longitude);
    const confidence = available ? locationConfidence(observation.accuracy) : 'UNUSABLE';
    return {
      ...base,
      ...(available ? { latitude: observation.latitude, longitude: observation.longitude, locationAccuracy: observation.accuracy, locationObservedAt: observation.observedAt } : {}),
      locationStatus: status,
      locationConfidence: confidence,
      locationOperational: available && confidence !== 'UNUSABLE',
    };
  }
}
