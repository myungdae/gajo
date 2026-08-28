export type LocationStatus =
  "AVAILABLE" | "DENIED" | "UNAVAILABLE" | "TIMEOUT" | "UNKNOWN";
export type LocationConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNUSABLE";
export const LOCATION_CONFIDENCE_THRESHOLDS = {
  highMaxMeters: 100,
  mediumMaxMeters: 500,
  lowMaxMeters: 1500,
} as const;
export function locationConfidence(accuracy?: number): LocationConfidence {
  const meters = Number(accuracy);
  if (
    !Number.isFinite(meters) ||
    meters < 0 ||
    meters > LOCATION_CONFIDENCE_THRESHOLDS.lowMaxMeters
  )
    return "UNUSABLE";
  if (meters <= LOCATION_CONFIDENCE_THRESHOLDS.highMaxMeters) return "HIGH";
  if (meters <= LOCATION_CONFIDENCE_THRESHOLDS.mediumMaxMeters) return "MEDIUM";
  return "LOW";
}
export function isOperationalLocation(
  location: VisitorLocation | null | undefined,
) {
  return (
    location?.status === "AVAILABLE" &&
    locationConfidence(location.accuracy) !== "UNUSABLE" &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  );
}
export interface VisitorLocation {
  status: LocationStatus;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  observedAt: string;
}
let current: VisitorLocation | null = null;
export const getSessionLocation = () => current;
export function shouldOfferLocationForRequest(input: {
  hasTripEvidence: boolean;
  requestText?: string;
  location?: VisitorLocation | null;
  result?: any;
}) {
  if (isOperationalLocation(input.location)) return false;
  if (!input.requestText) return false;
  const proximity = /(?:가까운|가까워|가까이|근처|주변|거리|얼마나\s*멀)/.test(
    input.requestText || "",
  );
  if (!proximity) return false;
  return (
    input.result?.distanceInfo?.status === "NEEDS_CLARIFICATION" ||
    input.result?.discovery?.relation === "REGIONAL"
  );
}
export function observeVisitorLocation(): Promise<VisitorLocation> {
  return new Promise((resolve) => {
    const finish = (v: VisitorLocation) => {
      current = v;
      resolve(v);
    };
    if (!navigator.geolocation)
      return finish({
        status: "UNAVAILABLE",
        observedAt: new Date().toISOString(),
      });
    navigator.geolocation.getCurrentPosition(
      (p) =>
        finish({
          status: "AVAILABLE",
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          observedAt: new Date(p.timestamp).toISOString(),
        }),
      (e) =>
        finish({
          status:
            e.code === e.PERMISSION_DENIED
              ? "DENIED"
              : e.code === e.TIMEOUT
                ? "TIMEOUT"
                : "UNAVAILABLE",
          observedAt: new Date().toISOString(),
        }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}
export function approximateDistance(
  from: VisitorLocation | null,
  latitude: number,
  longitude: number,
) {
  if (
    !isOperationalLocation(from) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  )
    return undefined;
  const rad = (x: number) => (x * Math.PI) / 180,
    dLat = rad(latitude - from!.latitude!),
    dLon = rad(longitude - from!.longitude!);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from!.latitude!)) *
      Math.cos(rad(latitude)) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
export function estimatedTravelMinutes(
  distanceMeters: number | undefined,
  mode?: string,
) {
  if (distanceMeters === undefined) return undefined;
  const km = distanceMeters / 1000;
  if (mode === "WALK") return Math.max(1, Math.ceil((km / 4) * 60));
  if (mode === "CAR") return Math.max(5, Math.ceil((km / 30) * 60 + 5));
  if (mode === "PUBLIC_TRANSPORT" || mode === "PUBLIC_TRANSIT")
    return Math.max(8, Math.ceil((km / 20) * 60 + 8));
  return undefined;
}
