import type { TripSession } from "./tripSession.ts";
import { canonicalEntityId } from "./recommendationItem.ts";
const steps = (s: TripSession) =>
  Array.isArray((s.itinerary as any)?.steps) ? (s.itinerary as any).steps : [];
const id = (x: any) => canonicalEntityId(x);
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
const itemCount=(itinerary:any)=>Array.isArray(itinerary?.steps)?itinerary.steps.length:0;
const contextScore=(value:any)=>value&&typeof value==='object'?Object.keys(value).filter(key=>value[key]!==undefined).length:0;
const richer=(local:any,remote:any,newer:any)=>{const localScore=contextScore(local),remoteScore=contextScore(remote);return localScore===remoteScore?newer===remote?remote:local:localScore>remoteScore?local:remote};
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
    localSteps=itemCount(local.itinerary),remoteSteps=itemCount(remote.itinerary),
    full=localSteps===remoteSteps
      ? (newer.itinerary||older.itinerary)
      : localSteps>remoteSteps?local.itinerary:remote.itinerary;
  return {
    ...newer,
    itinerary: full,
    savedPlaces: mergedPlaces,
    plannedContext:richer(local.plannedContext,remote.plannedContext,newer),
    runtimeContext:richer(local.runtimeContext,remote.runtimeContext,newer),
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
