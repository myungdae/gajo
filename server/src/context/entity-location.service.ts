import { Injectable } from '@nestjs/common';
import { GraphTraversalService } from './graph-traversal.service';
import type { TransportMode } from './runtime-context.types';
import { MasterDataService } from '../master-data/master-data.service';

export interface Coordinates { latitude: number; longitude: number; sourceUri?: string }
export interface DistanceResult { distanceStatus: 'AVAILABLE' | 'UNKNOWN'; distanceMeters?: number; distanceKm?: number }
export const TRAVEL_ASSUMPTIONS = { WALK_KMH: 4, CAR_KMH: 30, CAR_OVERHEAD_MINUTES: 5, PUBLIC_TRANSPORT_KMH: 20, PUBLIC_TRANSPORT_OVERHEAD_MINUTES: 8 } as const;

@Injectable()
export class EntityLocationService {
  constructor(private readonly traversal: GraphTraversalService, private readonly masterData?: MasterDataService) {}

  coordinatesForFacility(uri?: string): Coordinates | undefined {
    if (!uri) return undefined;
    const master = this.masterData?.verifiedCoordinates(uri);
    if (master) return master;
    // In the live application, master data is the coordinate confidence gate.
    // Raw ontology literals remain useful in isolated fixtures, but must not
    // activate map/distance planning without field-level verification.
    if (this.masterData) return undefined;
    const literals = this.traversal.literalProps(uri);
    const latitude = Number(literals.latitude ?? literals.lat);
    const longitude = Number(literals.longitude ?? literals.lng ?? literals.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude, sourceUri: uri } : undefined;
  }

  coordinatesForProgram(uri?: string): Coordinates | undefined {
    if (!uri) return undefined;
    const facilityUri = (this.traversal.objectProps(uri).heldAtFacility || [])[0];
    return this.coordinatesForFacility(facilityUri);
  }

  coordinatesFor(programUri?: string, facilityUri?: string) {
    return this.coordinatesForFacility(facilityUri) || this.coordinatesForProgram(programUri);
  }

  distance(from?: Coordinates, to?: Coordinates): DistanceResult {
    if (!from || !to) return { distanceStatus: 'UNKNOWN' };
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const dLat = radians(to.latitude - from.latitude);
    const dLon = radians(to.longitude - from.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
    const distanceMeters = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    return { distanceStatus: 'AVAILABLE', distanceMeters, distanceKm: Number((distanceMeters / 1000).toFixed(2)) };
  }

  estimateTravelMinutes(distanceMeters: number | undefined, mode: TransportMode | undefined) {
    if (!Number.isFinite(distanceMeters) || mode === 'UNKNOWN' || mode === 'OTHER' || !mode) return undefined;
    const km = (distanceMeters || 0) / 1000;
    if (mode === 'WALK') return Math.max(1, Math.ceil(km / TRAVEL_ASSUMPTIONS.WALK_KMH * 60));
    if (mode === 'CAR') return Math.max(TRAVEL_ASSUMPTIONS.CAR_OVERHEAD_MINUTES, Math.ceil(km / TRAVEL_ASSUMPTIONS.CAR_KMH * 60 + TRAVEL_ASSUMPTIONS.CAR_OVERHEAD_MINUTES));
    return Math.max(TRAVEL_ASSUMPTIONS.PUBLIC_TRANSPORT_OVERHEAD_MINUTES, Math.ceil(km / TRAVEL_ASSUMPTIONS.PUBLIC_TRANSPORT_KMH * 60 + TRAVEL_ASSUMPTIONS.PUBLIC_TRANSPORT_OVERHEAD_MINUTES));
  }
}
