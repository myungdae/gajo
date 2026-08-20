import type { TripSession } from "./tripSession.ts";
const steps = (s: TripSession) =>
  Array.isArray((s.itinerary as any)?.steps) ? (s.itinerary as any).steps : [];
const id = (x: any) =>
  x.entityId || x.entityUri || x.programUri || x.facilityUri;
const places = (s: TripSession) =>
  Array.isArray(s.savedPlaces)
    ? s.savedPlaces
    : (s.itinerary as any)?.savedAsFullJourney
      ? []
      : steps(s);
const unique = (values: any[]) => {
  const seen = new Set<string>();
  return values.filter((x) => {
    const key = id(x);
    return key && !seen.has(key) && (seen.add(key), true);
  });
};
export function itineraryItemCount(s?: TripSession) {
  return s
    ? new Set([...steps(s), ...places(s)].map(id).filter(Boolean)).size
    : 0;
}
export function reconcileTrip(local: TripSession, remote: TripSession) {
  if (
    local.regionId !== remote.regionId ||
    local.anonymousTripId !== remote.anonymousTripId
  )
    return local;
  const newer =
      Date.parse(remote.updatedAt) > Date.parse(local.updatedAt)
        ? remote
        : local,
    older = newer === remote ? local : remote,
    mergedPlaces = unique([...places(newer), ...places(older)]),
    full = (newer.itinerary as any)?.savedAsFullJourney
      ? newer.itinerary
      : (older.itinerary as any)?.savedAsFullJourney
        ? older.itinerary
        : undefined;
  return {
    ...newer,
    itinerary: full,
    savedPlaces: mergedPlaces,
    execution: {
      ...older.execution,
      ...newer.execution,
      statusByEntityId: {
        ...older.execution?.statusByEntityId,
        ...newer.execution?.statusByEntityId,
      },
    },
  };
}
