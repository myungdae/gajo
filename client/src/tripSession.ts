import type { CreateContextInput } from "./api/client";
export interface PlannedPlace {
  label: string;
  entityId?: string;
  regionId?: string;
  resolved: boolean;
}
export interface PlannedContext {
  duration?: "DAY" | "1N2D" | "2N3D" | "CUSTOM";
  startDate?: string;
  arrivalPeriod?: string;
  departurePeriod?: string;
  companions?: CreateContextInput["companions"];
  mobilityConstraints?: string[];
  walkingLevel?: CreateContextInput["walkingLevel"];
  transportMode?: CreateContextInput["transportMode"];
  interests?: string[];
  mustVisitPlaces?: PlannedPlace[];
  accommodationIntents?: PlannedPlace[];
}
export interface TripSession {
  id: string;
  anonymousTripId: string;
  regionId: string;
  mode: "PLAN" | "NOW";
  plannedContext?: PlannedContext;
  runtimeContext?: any;
  itinerary?: unknown;
  savedPlaces?: any[];
  execution?: {
    currentEntityId?: string;
    statusByEntityId?: Record<string, "PLANNED" | "READY" | "EN_ROUTE">;
  };
  createdAt: string;
  updatedAt: string;
}
const key = (regionId: string) =>
  `regional-concierge-trip-session-v1:${regionId}`;
const archivePrefix = (regionId: string) =>
  `regional-concierge-trip-archive-v1:${regionId}:`;
const privacySafe = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (name, field) =>
      ["rawMessage", "freeText", "text", "message"].includes(name)
        ? undefined
        : field,
    ),
  );
export function createTripSession(
  regionId = "gajo",
  now = new Date(),
): TripSession {
  const iso = now.toISOString(),
    id = crypto.randomUUID();
  return {
    id,
    anonymousTripId: id,
    regionId,
    mode: "NOW",
    createdAt: iso,
    updatedAt: iso,
  };
}
export function loadTripSession(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  regionId = "gajo",
): TripSession | undefined {
  try {
    const storageKey = key(regionId),
      value =
        storage.getItem(storageKey) ||
        (typeof sessionStorage !== "undefined" &&
        typeof localStorage !== "undefined" &&
        storage === localStorage
          ? sessionStorage.getItem(storageKey)
          : null);
    if (!value) return undefined;
    const session = JSON.parse(value) as TripSession;
    if (session.regionId !== regionId) return undefined;
    session.anonymousTripId ||= session.id;
    if (
      session.runtimeContext?.regionId !== undefined &&
      session.runtimeContext.regionId !== regionId
    )
      return { ...session, runtimeContext: undefined };
    return session;
  } catch {
    return undefined;
  }
}
export function saveTripSession(
  session: TripSession,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  const next = {
      ...session,
      anonymousTripId: session.anonymousTripId || session.id,
      updatedAt: new Date().toISOString(),
    },
    serialized = JSON.stringify(privacySafe(next));
  try {
    storage.setItem(key(session.regionId), serialized);
  } catch {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(key(session.regionId), serialized);
  }
  if (typeof window !== "undefined" && storage === localStorage)
    window.dispatchEvent(
      new CustomEvent("regional-trip-saved", {
        detail: { regionId: session.regionId },
      }),
    );
  return next;
}
export function ensureTripSession(
  regionId = "gajo",
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  return (
    loadTripSession(storage, regionId) ||
    saveTripSession(createTripSession(regionId), storage)
  );
}
export function hasSavedTrip(session?: TripSession) {
  return Boolean(
    session &&
    ((session.itinerary as any)?.steps?.length || session.savedPlaces?.length),
  );
}
export function archiveAndStartNewTrip(
  regionId: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  const current = loadTripSession(storage, regionId);
  if (current)
    storage.setItem(
      `regional-concierge-trip-archive-v1:${regionId}:${current.anonymousTripId}`,
      JSON.stringify(privacySafe(current)),
    );
  return saveTripSession(createTripSession(regionId), storage);
}
export function updateTripRuntimeContext(
  regionId: string,
  runtimeContext: any,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  const current = loadTripSession(storage, regionId);
  if (!current) return undefined;
  return saveTripSession({ ...current, runtimeContext }, storage);
}
export interface TripRestorationDiagnostics {
  regionId: string;
  activeStorageKey: string;
  activeAnonymousTripId?: string;
  hasStructuredJourney: boolean;
  savedPlaceCount: number;
  archiveCount?: number;
  activeSessionPointer: "REGIONAL_STORAGE_KEY";
  restorationSource: "LOCAL" | "SESSION_FALLBACK" | "EMPTY";
  uiState: "CONTINUE" | "EMPTY";
}
export function tripRestorationDiagnostics(
  regionId: string,
  storage: Pick<Storage, "getItem" | "setItem"> &
    Partial<Pick<Storage, "length" | "key">> = localStorage,
): TripRestorationDiagnostics {
  const storageKey = key(regionId),
    localValue = storage.getItem(storageKey),
    session = loadTripSession(storage, regionId),
    length = typeof storage.length === "number" ? storage.length : undefined;
  let archiveCount: number | undefined;
  if (length !== undefined && typeof storage.key === "function") {
    archiveCount = 0;
    for (let index = 0; index < length; index += 1)
      if (storage.key(index)?.startsWith(archivePrefix(regionId))) archiveCount += 1;
  }
  return {
    regionId,
    activeStorageKey: storageKey,
    activeAnonymousTripId: session?.anonymousTripId,
    hasStructuredJourney: Boolean((session?.itinerary as any)?.steps?.length),
    savedPlaceCount: session?.savedPlaces?.length || 0,
    archiveCount,
    activeSessionPointer: "REGIONAL_STORAGE_KEY",
    restorationSource: session ? (localValue ? "LOCAL" : "SESSION_FALLBACK") : "EMPTY",
    uiState: hasSavedTrip(session) ? "CONTINUE" : "EMPTY",
  };
}
export function safeTripState(session: TripSession) {
  return privacySafe(session);
}
export function sessionContext(s: TripSession): CreateContextInput {
  const p = s.plannedContext || {};
  return {
    companions: p.companions,
    companionConstraints: p.mobilityConstraints,
    walkingLevel: p.walkingLevel,
    transportMode: p.transportMode,
    activityPreferences: p.interests,
    mustVisitPlaces: p.mustVisitPlaces?.map((place) => ({
      entityId: place.entityId,
      label: place.label,
      resolved: place.resolved,
    })),
    accommodationIntents: p.accommodationIntents?.map((place) => ({
      entityId: place.entityId,
      label: place.label,
      resolved: place.resolved,
    })),
  };
}
export function mergeTravelContext(
  carried: CreateContextInput,
  explicit: CreateContextInput,
): CreateContextInput {
  return {
    ...carried,
    ...explicit,
    companions: explicit.companions ?? carried.companions,
    companionConstraints:
      explicit.companionConstraints ?? carried.companionConstraints,
    activityPreferences:
      explicit.activityPreferences ?? carried.activityPreferences,
    mustVisitPlaces: explicit.mustVisitPlaces ?? carried.mustVisitPlaces,
    accommodationIntents:
      explicit.accommodationIntents ?? carried.accommodationIntents,
  };
}
export function resolveMustVisit(
  value: string,
  suggestions: Array<{ id: string; label: string; aliases?: string[] }>,
): PlannedPlace | undefined {
  const label = value.trim();
  if (!label) return undefined;
  const normalized = label.replace(/\s/g, "").toLowerCase();
  const match = suggestions.find((p) =>
    [p.label, ...(p.aliases || [])].some(
      (v) => v.replace(/\s/g, "").toLowerCase() === normalized,
    ),
  );
  if (!match) return { label, resolved: false };
  const regionId = match.id.includes("daejeon-junggu")
    ? "daejeon-junggu"
    : match.id.includes("okcheon")
      ? "okcheon"
      : match.id.includes("muan")
        ? "muan"
        : match.id.includes("gyeryong")
          ? "gyeryong"
          : match.id.includes("hapcheon")
            ? "hapcheon"
            : "gajo";
  return { label: match.label, entityId: match.id, regionId, resolved: true };
}
export function currentTravelContext(
  planned: CreateContextInput,
  runtime: CreateContextInput,
  explicit: CreateContextInput,
): CreateContextInput {
  return mergeTravelContext(mergeTravelContext(planned, runtime), explicit);
}
