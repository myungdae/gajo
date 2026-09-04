import { bridgeVisitorEvent } from './visitorAnalytics';
import { api } from "./api/client";
export type PilotEventType =
  | "MY_TRIP_OPENED"
  | "SAVED_TRIP_LOADED"
  | "SAVED_PLACE_REMOVED"
  | "FULL_ITINERARY_SAVED"
  | "FULL_ITINERARY_RESTORED"
  | "FULL_ITINERARY_UPDATED"
  | "TRIP_RESTORED"
  | "TRIP_CONTINUED"
  | "NEW_TRIP_STARTED"
  | "TRIP_MANAGEMENT_OPENED"
  | "SAVED_PLACES_CLEARED"
  | "NATURAL_LANGUAGE_ENTRY_SELECTED"
  | "SESSION_STARTED"
  | "SESSION_RESUMED"
  | "PLAN_SESSION_STARTED"
  | "PLAN_COMPLETED"
  | "PLAN_RESUMED"
  | "NOW_SESSION_STARTED"
  | "PLAN_NOW_CONTINUED"
  | "RUNTIME_HYDRATED"
  | "ENTRY_SOURCE"
  | "QUICK_INTENT_SELECTED"
  | "STRUCTURED_RECOMMENDATION_REQUESTED"
  | "FREE_LANGUAGE_REQUEST"
  | "INTENT_ROUTED"
  | "RECOMMENDATION_SHOWN"
  | "AI_RESPONSE_ACTION_SHOWN"
  | "AI_NEXT_ACTION_SELECTED"
  | "PLACE_DETAIL_OPENED"
  | "ENTITY_DETAIL_OPENED"
  | "BOOKING_HANDOFF"
  | "PHONE_HANDOFF"
  | "WEBSITE_HANDOFF"
  | "MAP_OPENED"
  | "NAVIGATION_HANDOFF"
  | "ITINERARY_ADD"
  | "ITINERARY_ITEM_ADDED"
  | "ITINERARY_VIEWED"
  | "JOURNEY_START_ACTION"
  | "NEARBY_FROM_ITINERARY"
  | "REPLAN_FROM_ITINERARY"
  | "REPLAN_REQUESTED"
  | "RETRY_ERROR"
  | "SEARCH_FALLBACK_USED"
  | "SEARCH_ENTITY_RESOLVED"
  | "SEARCH_ENTITY_UNVERIFIED"
  | "SEARCH_TO_ACTION_CONTINUED"
  | "PWA_INSTALL_OFFERED"
  | "PWA_INSTALL_ACCEPTED"
  | "PWA_INSTALL_DISMISSED"
  | "PWA_STANDALONE_OPEN";
export type VoiceUxEventType =
  | "VOICE_STARTED" | "VOICE_STATE_CHANGED" | "VOICE_COMPLETED" | "VOICE_ABANDONED"
  | "VOICE_FULL_RETRY" | "VOICE_PARTIAL_EDIT" | "VOICE_PARTIAL_EDIT_COMPLETED"
  | "VOICE_INPUT_SWITCHED" | "VOICE_PERMISSION_DENIED" | "VOICE_DUPLICATE_BLOCKED";
let activeRegionId = "gajo";
let activeRegionMetadata: Record<string, string> = {};
export function setAnalyticsRegion(
  regionId: string,
  metadata: Record<string, string | undefined> = {},
) {
  activeRegionId = regionId;
  activeRegionMetadata = Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}
export function track(
  eventType: PilotEventType | VoiceUxEventType,
  sessionId: string,
  metadata: Record<string, string | number | boolean | undefined> = {},
) {
  bridgeVisitorEvent(eventType, activeRegionId, sessionId, metadata);
  const safe = Object.fromEntries(
    Object.entries({
      ...activeRegionMetadata,
      ...metadata,
      regionId: activeRegionId,
    }).filter(
      ([key]) => !["rawMessage", "text", "message", "freeText"].includes(key),
    ),
  );
  void api
    .post("/analytics/events", {
      eventType,
      sessionId,
      regionId: activeRegionId,
      metadata: safe,
    })
    .catch(() => undefined);
}
