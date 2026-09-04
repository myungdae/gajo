import {
  nextVisit,
  analyticsScreen,
  type VisitState,
} from "./visitorAnalyticsSession.ts";
import { currentVisitorLocale } from "./visitorRouting.ts";
type EventType =
  | "PAGE_VIEWED"
  | "REGION_HOME_VIEWED"
  | "NEARBY_SEARCH_SUBMITTED"
  | "SEARCH_RESULTS_SHOWN"
  | "PLACE_DETAIL_OPENED"
  | "PHONE_CLICKED"
  | "DIRECTIONS_CLICKED"
  | "ITINERARY_SAVE_SUCCEEDED";
type Detail = {
  searchId?: string;
  resultSetId?: string;
  actionId?: string;
  placeKey?: string;
  placeProof?: string;
  resultCount?: number;
  provider?: string;
};
const memory = new Map<string, VisitState>(),
  proofs = new Map<string, string>(),
  contexts = new Map<string, Detail>();
const guards = new Map<
  string,
  { at: number; event: Record<string, unknown> }
>();
let pagePath = "",
  pageViewId = "";
const uuid = () => crypto.randomUUID();
export function visitFor(regionId: string, now = Date.now()) {
  const key = `visitor-analytics-v2:${regionId}`;
  let prior = memory.get(key) || null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const v = JSON.parse(raw);
      if (
        typeof v.visitSessionId === "string" &&
        typeof v.lastActiveAt === "number"
      )
        prior = v;
    }
  } catch {
    /* Optional storage. */
  }
  const next = nextVisit(prior, now, uuid);
  memory.set(key, next);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* In-memory fallback. */
  }
  return next;
}
export function startAnalyticsTestVisit(regionId: string) {
  const state = { visitSessionId: uuid(), lastActiveAt: Date.now() };
  memory.set(`visitor-analytics-v2:${regionId}`, state);
  localStorage.setItem(
    `visitor-analytics-v2:${regionId}`,
    JSON.stringify(state),
  );
  return state;
}
export function setEntry(regionId: string, entryId: string) {
  try {
    const state = visitFor(regionId);
    state.entryId = entryId;
    memory.set(`visitor-analytics-v2:${regionId}`, state);
    localStorage.setItem(
      `visitor-analytics-v2:${regionId}`,
      JSON.stringify(state),
    );
  } catch {
    /* Never interrupt entry. */
  }
}
export function analyticsPlaceKey(place: any) {
  return place.provider === "KAKAO" || place.transient
    ? `provider:kakao:${place.providerPlaceId || place.id}`
    : place.canonicalEntityUri ||
        place.entityUri ||
        place.entityId ||
        place.canonicalId;
}
export function rememberPlace(
  regionId: string,
  place: any,
  context: Detail = {},
) {
  const key = analyticsPlaceKey(place);
  if (!key) return;
  if (proofs.size > 200) proofs.clear();
  if (contexts.size > 200) contexts.clear();
  if (place.analyticsProof)
    proofs.set(regionId + "|" + key, place.analyticsProof);
  contexts.set(regionId + "|" + key, context);
}
async function deliver(event: Record<string, unknown>, marker: string | null) {
  const send = () =>
    fetch("/api/analytics/v2/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(marker ? { "x-analytics-marker": marker } : {}),
      },
      body: JSON.stringify(event),
      keepalive: true,
    });
  try {
    const response = await send();
    if (response.status >= 500) await send();
  } catch {
    try {
      await send();
    } catch {
      /* Best effort: no UI dependency. */
    }
  }
}
export function visitorTrack(
  eventType: EventType,
  regionId: string,
  anonymousTripId: string,
  detail: Detail = {},
) {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(anonymousTripId)) return;
    const screen = analyticsScreen(window.location.pathname, regionId);
    if (screen === "UNKNOWN") return;
    const visit = visitFor(regionId),
      path = window.location.pathname;
    if (pagePath !== path || !pageViewId) {
      pagePath = path;
      pageViewId = uuid();
    }
    const placeKey = detail.placeKey,
      key = regionId + "|" + placeKey;
    const event: Record<string, unknown> = {
      schemaVersion: 2,
      eventId: uuid(),
      eventType,
      regionId,
      anonymousTripId,
      visitSessionId: visit.visitSessionId,
      pageViewId,
      screen,
      uiLocale: currentVisitorLocale(),
      occurredAt: new Date().toISOString(),
      ...(placeKey ? contexts.get(key) : {}),
      ...detail,
      ...(placeKey && proofs.has(key) ? { placeProof: proofs.get(key) } : {}),
      ...(visit.entryId ? { entryId: visit.entryId } : {}),
    };
    if (
      [
        "PHONE_CLICKED",
        "DIRECTIONS_CLICKED",
        "ITINERARY_SAVE_SUCCEEDED",
      ].includes(eventType)
    )
      event.actionId ||= uuid();
    const guardKey = [
      visit.visitSessionId,
      pageViewId,
      eventType,
      placeKey || "",
      detail.searchId || "",
      detail.provider || "",
      currentVisitorLocale(),
    ].join("|");
    const prior = guards.get(guardKey),
      now = Date.now();
    if (prior && now - prior.at < 1000) return;
    if (guards.size > 200) guards.clear();
    guards.set(guardKey, { at: now, event });
    let marker: string | null = null;
    try {
      marker = sessionStorage.getItem(`analytics-marker:${regionId}`);
    } catch {
      /* Optional storage. */
    }
    void deliver(event, marker);
  } catch {
    /* Analytics must never interrupt a visitor action. */
  }
}
export function bridgeVisitorEvent(
  type: string,
  regionId: string,
  tripId: string,
  metadata: Record<string, any>,
) {
  const map: Record<string, EventType> = {
    ENTITY_DETAIL_OPENED: "PLACE_DETAIL_OPENED",
    PLACE_DETAIL_OPENED: "PLACE_DETAIL_OPENED",
    PHONE_HANDOFF: "PHONE_CLICKED",
    NAVIGATION_HANDOFF: "DIRECTIONS_CLICKED",
    ITINERARY_ITEM_ADDED: "ITINERARY_SAVE_SUCCEEDED",
    FULL_ITINERARY_SAVED: "ITINERARY_SAVE_SUCCEEDED",
  };
  const event = map[type];
  if (!event) return;
  // Legacy metadata is never copied wholesale into the strict contract.
  if (event !== "ITINERARY_SAVE_SUCCEEDED" && !metadata.entityId) return;
  const provider = String(
    metadata.provider || metadata.actionType || "",
  ).toLowerCase();
  visitorTrack(event, regionId, tripId, {
    ...(metadata.entityId ? { placeKey: metadata.entityId } : {}),
    ...(["naver", "kakao", "tmap"].includes(provider) ? { provider } : {}),
  });
}
