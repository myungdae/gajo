import {
  canonicalEntityId,
  recommendationItemLabel,
} from "./recommendationItem.ts";
import {
  loadTripSession,
  saveTripSession,
  type TripSession,
} from "./tripSession.ts";
import { itinerarySteps } from "./journeyExecution.ts";
export type FullJourneySaveResult = {
  status: "saved" | "identical" | "different" | "error";
  session?: TripSession;
  itemCount: number;
  dayCounts: number[];
};
const structure = (itinerary: any) =>
  itinerarySteps(itinerary).map((step, index) => ({
    id: canonicalEntityId(step),
    day: Number(step.dayIndex) || 1,
    order: Number(step.order) || index + 1,
  }));
export function journeyDayCounts(itinerary: any) {
  const counts = new Map<number, number>();
  for (const step of structure(itinerary))
    counts.set(step.day, (counts.get(step.day) || 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, count]) => count);
}
export function sameJourney(a: any, b: any) {
  return JSON.stringify(structure(a)) === JSON.stringify(structure(b));
}
export function saveFullJourney(
  regionId: string,
  itinerary: any,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  update = false,
): FullJourneySaveResult {
  const current = loadTripSession(storage, regionId),
    raw = itinerarySteps(itinerary),
    dayCounts = journeyDayCounts(itinerary);
  if (!current || raw.length < 2)
    return { status: "error", itemCount: 0, dayCounts: [] };
  const normalized = raw.map((step, index) => ({
    ...step,
    entityId: canonicalEntityId(step),
    regionId: step.regionId || regionId,
    displayName: recommendationItemLabel(step),
    dayIndex: Number(step.dayIndex) || 1,
    order: Number(step.order) || index + 1,
    status: step.status || "PLANNED",
  }));
  if (normalized.some((step) => !step.entityId || step.regionId !== regionId))
    return { status: "error", itemCount: 0, dayCounts: [] };
  if (itinerarySteps(current.itinerary).length) {
    if (sameJourney(current.itinerary, { steps: normalized }))
      return {
        status: "identical",
        session: current,
        itemCount: normalized.length,
        dayCounts,
      };
    if (!update)
      return {
        status: "different",
        session: current,
        itemCount: normalized.length,
        dayCounts,
      };
  }
  const next = saveTripSession(
    {
      ...current,
      itinerary: {
        ...itinerary,
        regionId,
        journeyId:
          itinerary.itineraryNo || itinerary.journeyId || crypto.randomUUID(),
        savedAsFullJourney: true,
        steps: normalized,
      },
    },
    storage,
  );
  return {
    status: update ? "saved" : "saved",
    session: next,
    itemCount: normalized.length,
    dayCounts,
  };
}

export function applyReplannedJourney(
  regionId: string,
  itinerary: any,
  runtimeContext: any,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  const current = loadTripSession(storage, regionId), revised = itinerarySteps(itinerary);
  if (!current || !revised.length) return undefined;
  const oldSteps = itinerarySteps(current.itinerary), status = current.execution?.statusByEntityId || {};
  const historical = oldSteps.filter((step) => {
    const entityId = canonicalEntityId(step), value = (entityId ? status[entityId] : undefined) || step.status;
    return value === "COMPLETED" || value === "SKIPPED";
  });
  const historicalIds = new Set(historical.map(canonicalEntityId));
  const oldFuture = oldSteps.filter((step) => !historicalIds.has(canonicalEntityId(step)));
  const oldFutureById = new Map(oldFuture.map((step) => [canonicalEntityId(step), step]));
  const future = revised
    .filter((step) => !historicalIds.has(canonicalEntityId(step)))
    .map((step) => {
      const entityId = canonicalEntityId(step), existing = oldFutureById.get(entityId);
      return {
        ...existing,
        ...step,
        entityId,
        regionId: step.regionId || regionId,
        status: existing?.status || "NEWLY_ADDED",
      };
    });
  if (future.some((step) => !step.entityId || step.regionId !== regionId)) return undefined;
  const futureIds = new Set(future.map(canonicalEntityId));
  const replacedSteps = oldFuture
    .filter((step) => !futureIds.has(canonicalEntityId(step)))
    .map((step) => ({ ...step, status: "REPLACED_BY_REPLAN" }));
  const steps = [...historical, ...future].map((step, index) => ({ ...step, order: index + 1 }));
  const currentEntityId = current.execution?.currentEntityId;
  const nextCurrentEntityId = currentEntityId && steps.some((step) => canonicalEntityId(step) === currentEntityId)
    ? currentEntityId
    : canonicalEntityId(future[0]);
  return saveTripSession({
    ...current,
    runtimeContext: runtimeContext || current.runtimeContext,
    itinerary: {
      ...((current.itinerary as object) || {}),
      ...itinerary,
      regionId,
      journeyId: (current.itinerary as any)?.journeyId || itinerary.itineraryNo || itinerary.journeyId,
      savedAsFullJourney: Boolean((current.itinerary as any)?.savedAsFullJourney),
      steps,
    },
    execution: {
      ...current.execution,
      currentEntityId: nextCurrentEntityId,
      statusByEntityId: current.execution?.statusByEntityId,
    },
    replanHistory: [...(current.replanHistory || []), {
      replannedAt: new Date().toISOString(),
      replacedSteps,
      newlyAddedEntityIds: future
        .filter((step) => !oldFutureById.has(canonicalEntityId(step)))
        .map(canonicalEntityId)
        .filter((entityId): entityId is string => Boolean(entityId)),
    }],
  }, storage);
}
