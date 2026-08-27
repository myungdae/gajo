import {
  ensureTripSession,
  loadTripSession,
  saveTripSession,
  type TripSession,
} from "./tripSession.ts";
import {
  canonicalEntityId,
  itemBelongsToRegion,
  recommendationItemLabel,
} from "./recommendationItem.ts";
import {
  navigationDestination,
  type NavigationDestination,
} from "./utils/placeNavigation.ts";
export type ExecutionStatus = "PLANNED" | "READY" | "EN_ROUTE" | "COMPLETED" | "SKIPPED";
export const visitorExecutionLabel = (status?: string) => ({
  PLANNED: "예정", READY: "현재", EN_ROUTE: "현재",
  COMPLETED: "방문 완료 ✓", SKIPPED: "건너뜀",
  REPLACED_BY_REPLAN: "일정 변경으로 교체됨",
  NEWLY_ADDED: "새 일정에 추가됨",
} as Record<string, string>)[status || "PLANNED"] || "예정";
export function itinerarySteps(itinerary: unknown): any[] {
  return Array.isArray((itinerary as any)?.steps)
    ? (itinerary as any).steps
    : [];
}
export function savedPlaceItems(session?: TripSession): any[] {
  if (!session) return [];
  if (Array.isArray(session.savedPlaces)) return session.savedPlaces;
  return (session.itinerary as any)?.savedAsFullJourney
    ? []
    : itinerarySteps(session.itinerary);
}
export function removeSavedPlace(
  regionId: string,
  entityId: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  const session = loadTripSession(storage, regionId);
  if (!session) return undefined;
  const places = savedPlaceItems(session),
    nextPlaces = places.filter((item) => canonicalEntityId(item) !== entityId);
  if (nextPlaces.length === places.length) return session;
  return saveTripSession(
    {
      ...session,
      savedPlaces: nextPlaces,
      ...(!(session.itinerary as any)?.savedAsFullJourney
        ? { itinerary: undefined }
        : {}),
    },
    storage,
  );
}
export function clearRegionalSavedPlaces(
  regionId: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  const session = loadTripSession(storage, regionId);
  if (!session) return undefined;
  const hasFullJourney = Boolean((session.itinerary as any)?.savedAsFullJourney);
  return saveTripSession(
    {
      ...session,
      savedPlaces: [],
      ...(hasFullJourney ? {} : { itinerary: undefined }),
    },
    storage,
  );
}
export function verifiedNavigation(item: any): NavigationDestination | null {
  const navigate = item?.actions?.navigate;
  if (!navigate) return null;
  return navigationDestination({
    name: recommendationItemLabel(item),
    lat: navigate.latitude,
    lng: navigate.longitude,
  });
}
export function appendItineraryItem(session: TripSession, item: any) {
  const entityId = canonicalEntityId(item);
  if (!entityId) return { session, added: false };
  const steps = itinerarySteps(session.itinerary);
  if (steps.some((step) => canonicalEntityId(step) === entityId))
    return { session, added: false };
  const next = {
    ...item,
    entityId,
    status: "PLANNED",
    order: steps.length + 1,
  };
  return {
    added: true,
    session: {
      ...session,
      itinerary: {
        ...((session.itinerary as object) || {}),
        steps: [...steps, next],
      },
    },
  };
}
export function executionState(
  session: TripSession,
  entityId: string,
  status: ExecutionStatus,
  now = new Date(),
) {
  const occurredAt = now.toISOString();
  return {
    ...session,
    execution: {
      ...session.execution,
      currentEntityId: entityId,
      statusByEntityId: {
        ...session.execution?.statusByEntityId,
        [entityId]: status,
      },
      completedAtByEntityId: status === "COMPLETED" ? { ...session.execution?.completedAtByEntityId, [entityId]: occurredAt } : session.execution?.completedAtByEntityId,
      skippedAtByEntityId: status === "SKIPPED" ? { ...session.execution?.skippedAtByEntityId, [entityId]: occurredAt } : session.execution?.skippedAtByEntityId,
    },
  };
}
export function currentAndNext(steps: any[], currentEntityId?: string, statusByEntityId: Record<string, string> = {}) {
  const active = steps.filter(
    (step) => !["COMPLETED", "SKIPPED"].includes(statusByEntityId[canonicalEntityId(step) || ""] || step.status),
  );
  const found = currentEntityId
      ? active.findIndex((step) => canonicalEntityId(step) === currentEntityId)
      : -1,
    index = found >= 0 ? found : 0;
  return { current: active[index], next: active[index + 1] };
}
export type ItineraryAddResult = {
  status: "added" | "duplicate" | "error";
  entityId?: string;
  session?: TripSession;
  item?: any;
};
export function addEntityToRegionalItinerary(
  regionId: string,
  item: any,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  emit?: (
    type: "ITINERARY_ITEM_ADDED",
    sessionId: string,
    metadata: Record<string, string>,
  ) => void,
): ItineraryAddResult {
  const entityId = canonicalEntityId(item);
  try {
    const owned = item.regionId
      ? item.regionId === regionId
      : itemBelongsToRegion(item, regionId);
    if (!entityId || !owned) return { status: "error" };
    const normalized = {
        ...item,
        entityId,
        entityUri: item.entityUri || entityId,
        regionId,
        label: recommendationItemLabel(item),
      },
      session = ensureTripSession(regionId, storage),
      places = savedPlaceItems(session);
    if (
      [...itinerarySteps(session.itinerary), ...places].some(
        (place) => canonicalEntityId(place) === entityId,
      )
    )
      return { status: "duplicate", entityId, session, item: normalized };
    const persisted = saveTripSession(
        {
          ...session,
          savedPlaces: [...places, normalized],
          ...(!(session.itinerary as any)?.savedAsFullJourney
            ? { itinerary: undefined }
            : {}),
        },
        storage,
      ),
      matches = savedPlaceItems(persisted).filter(
        (place) => canonicalEntityId(place) === entityId,
      );
    if (matches.length !== 1)
      throw new Error("saved place write verification failed");
    emit?.("ITINERARY_ITEM_ADDED", persisted.id, {
      entityId,
      source: "entity-action",
    });
    return { status: "added", entityId, session: persisted, item: matches[0] };
  } catch (error) {
    console.warn("[itinerary] add failed", {
      regionId,
      entityId,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return { status: "error", entityId };
  }
}
