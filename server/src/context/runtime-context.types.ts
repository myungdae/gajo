export type Availability = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
export type OperatingState = 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'UNKNOWN';
export type CongestionState = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
export type ReservationState = 'AVAILABLE' | 'REQUIRED' | 'FULL' | 'UNKNOWN';
export type TransportMode = 'WALK' | 'CAR' | 'PUBLIC_TRANSPORT' | 'PUBLIC_TRANSIT' | 'UNKNOWN' | 'OTHER';
export type LocationStatus = 'AVAILABLE' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';
export type WalkingLevel = 'LOW' | 'MODERATE' | 'HIGH';

/** A live observation layered over, but never written into, an ontology entity. */
export interface EntityRuntimeState {
  entityUri: string;
  availability?: Availability;
  operatingState?: OperatingState;
  congestion?: CongestionState;
  reservationState?: ReservationState;
  closingTime?: string;
  estimatedTravelMinutes?: number;
  observedAt?: string;
}

export type RuntimeChangeType =
  | 'WEATHER_CHANGED'
  | 'HEAVY_RAIN'
  | 'CONGESTION_CHANGED'
  | 'FACILITY_UNAVAILABLE'
  | 'CLOSING_SOON'
  | 'DAY_TO_NIGHT'
  | 'RESERVATION_UNAVAILABLE'
  | 'LOCATION_CHANGED';

export type ItineraryItemStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type OperationalWeatherState = 'CLEAR' | 'CLOUDY' | 'LIGHT_RAIN' | 'RAIN' | 'HEAVY_RAIN' | 'THUNDERSTORM' | 'SNOW' | 'UNKNOWN';
export type LiveObservationStatus = 'LIVE' | 'STALE' | 'UNAVAILABLE';

export interface NormalizedWeatherObservation {
  observedAt: string;
  weather: OperationalWeatherState;
  temperature?: number;
  precipitation?: number;
  rain?: number;
  weatherCode?: number;
  windSpeed?: number;
  isDay?: boolean;
  source: 'OPEN_METEO' | 'UNAVAILABLE';
  status: LiveObservationStatus;
  stale: boolean;
}

export type RuntimeEventSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RuntimeImpactLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RuntimeChangeEvent {
  eventType: RuntimeChangeType;
  observedAt: string;
  entityUri?: string;
  previousValue?: unknown;
  currentValue?: unknown;
  severity: RuntimeEventSeverity;
  evidence: string[];
  affectedItineraryItemIds?: string[];
}
