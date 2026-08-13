export type LocationConfidence = 'HIGH'|'MEDIUM'|'LOW'|'UNUSABLE';

export const LOCATION_CONFIDENCE_THRESHOLDS = {
  highMaxMeters: 100,
  mediumMaxMeters: 500,
  lowMaxMeters: 1500,
} as const;

export function locationConfidence(accuracy?:number):LocationConfidence {
  const meters=Number(accuracy);
  if(!Number.isFinite(meters)||meters<0||meters>LOCATION_CONFIDENCE_THRESHOLDS.lowMaxMeters)return 'UNUSABLE';
  if(meters<=LOCATION_CONFIDENCE_THRESHOLDS.highMaxMeters)return 'HIGH';
  if(meters<=LOCATION_CONFIDENCE_THRESHOLDS.mediumMaxMeters)return 'MEDIUM';
  return 'LOW';
}

export function isOperationalLocation(value:any) {
  return value?.locationStatus==='AVAILABLE'&&locationConfidence(Number(value.locationAccuracy))!=='UNUSABLE'&&Number.isFinite(Number(value.latitude))&&Number.isFinite(Number(value.longitude));
}
