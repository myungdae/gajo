export type OperationalWeather = 'CLEAR'|'CLOUDY'|'LIGHT_RAIN'|'RAIN'|'HEAVY_RAIN'|'THUNDERSTORM'|'SNOW';
export interface OperationalTipTrigger {
  weather?: OperationalWeather[];
  temperatureAtMost?: number;
  temperatureAtLeast?: number;
  windSpeedAtLeast?: number;
  operatingStates?: Array<'OPEN'|'CLOSING_SOON'|'CLOSED'>;
  minutesToCloseAtMost?: number;
  companionTags?: Array<'ELDERLY'|'CHILD'|'FAMILY'>;
  walkingLevels?: Array<'LOW'|'MODERATE'|'HIGH'>;
}
export interface OperationalTip {
  id:string;
  trigger:OperationalTipTrigger;
  priority:number;
  message:string;
  actionSuggestion?:string;
  provenance:{sourceType:string;sourceName:string;sourceUrl:string;verifiedAt:string};
  realtimeRequired?:boolean;
  maxAgeMinutes?:number;
  validFrom?:string;
  validUntil?:string;
}
export interface SelectedPlaceGuidance {
  shortDescription?:string;
  situationalMessage?:string;
  actionSuggestion?:string;
  tipId?:string;
  realtime:boolean;
  observedAt?:string;
  evidenceLabel?:string;
}
