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
    statusByEntityId?: Record<string, "PLANNED" | "READY" | "EN_ROUTE" | "COMPLETED" | "SKIPPED">;
    completedAtByEntityId?: Record<string, string>;
    skippedAtByEntityId?: Record<string, string>;
  };
  replanHistory?: Array<{
    replannedAt: string;
    replacedSteps: any[];
    newlyAddedEntityIds: string[];
  }>;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  archiveReason?: "EXPLICIT_NEW_TRIP";
  restorationPending?: boolean;
}
export const tripStorageKey = (regionId: string) =>
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
  regionId: string,
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
  storage: Pick<Storage, "getItem" | "setItem">,
  regionId: string,
): TripSession | undefined {
  try {
    const storageKey = tripStorageKey(regionId),
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
  storage: Pick<Storage, "setItem"> & Partial<Pick<Storage,"getItem">> = localStorage,
  options: { allowIdentityReplacement?: boolean } = {},
):TripSession {
  if (session.restorationPending) return session;
  const storageKey=tripStorageKey(session.regionId),existing=storage.getItem?.(storageKey);
  if(existing){try{const parsed=JSON.parse(existing) as TripSession;if(parsed?.regionId!==session.regionId)return{...session,restorationPending:true};const activeId=parsed.anonymousTripId||parsed.id, incomingId=session.anonymousTripId||session.id;if(activeId&&incomingId&&activeId!==incomingId&&!options.allowIdentityReplacement)return parsed}catch{return{...session,restorationPending:true}}}
  const next = {
      ...session,
      anonymousTripId: session.anonymousTripId || session.id,
      updatedAt: new Date().toISOString(),
    },
    serialized = JSON.stringify(privacySafe(next));
  try {
    storage.setItem(storageKey, serialized);
  } catch {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(tripStorageKey(session.regionId), serialized);
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
  regionId: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
):TripSession {
  const restored=loadTripSession(storage,regionId);
  if(restored)return restored;
  const storageKey=tripStorageKey(regionId),stored=storage.getItem(storageKey)||(typeof sessionStorage!=="undefined"&&typeof localStorage!=="undefined"&&storage===localStorage?sessionStorage.getItem(storageKey):null);
  if(stored)return{id:`restoration-pending:${regionId}`,anonymousTripId:`restoration-pending:${regionId}`,regionId,mode:"NOW",createdAt:"1970-01-01T00:00:00.000Z",updatedAt:"1970-01-01T00:00:00.000Z",restorationPending:true};
  return saveTripSession(createTripSession(regionId),storage);
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
  if (current && hasTripEvidence(current))
    storage.setItem(
      `regional-concierge-trip-archive-v1:${regionId}:${current.anonymousTripId}`,
      JSON.stringify(privacySafe({ ...current, archivedAt: new Date().toISOString(), archiveReason: "EXPLICIT_NEW_TRIP" })),
    );
  return saveTripSession(createTripSession(regionId), storage, { allowIdentityReplacement: true });
}
export function hasTripEvidence(session: TripSession) {
  return Boolean(
    (session.itinerary as any)?.steps?.length ||
      session.savedPlaces?.length ||
      Object.keys(session.execution?.statusByEntityId || {}).length ||
      session.replanHistory?.length ||
      session.plannedContext,
  );
}
export function listArchivedTripSessions(
  regionId: string,
  storage: Pick<Storage, "getItem" | "length" | "key"> = localStorage,
) {
  const archived: TripSession[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(archivePrefix(regionId))) continue;
    try {
      const session = JSON.parse(storage.getItem(key) || "") as TripSession;
      if (session.regionId === regionId) archived.push(session);
    } catch {
      // Preserve unreadable evidence in storage; do not mutate it from the UI.
    }
  }
  return archived.sort(
    (a, b) =>
      Date.parse(b.archivedAt || b.updatedAt) -
      Date.parse(a.archivedAt || a.updatedAt),
  );
}
export type ArchiveLifecycleClassification = "EXPLICIT_NEW_TRIP" | "UNINTENDED_NEW_SESSION" | "DUPLICATE_ARCHIVE" | "RESTORE_REPLACEMENT" | "REPLAN_FRAGMENTATION" | "EMPTY_SESSION_FRAGMENT" | "OTHER";
export function auditArchivedTripLifecycle(
  regionId: string,
  storage: Pick<Storage, "getItem" | "length" | "key"> = localStorage,
) {
  const records: Array<{ key: string; session: TripSession; classification: ArchiveLifecycleClassification }> = [];
  const ids = new Map<string, number>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(archivePrefix(regionId))) continue;
    try {
      const session = JSON.parse(storage.getItem(key) || "") as TripSession;
      if (session.regionId !== regionId) continue;
      const id = session.anonymousTripId || session.id;
      ids.set(id, (ids.get(id) || 0) + 1);
      records.push({ key, session, classification: session.archiveReason === "EXPLICIT_NEW_TRIP" ? "EXPLICIT_NEW_TRIP" : hasTripEvidence(session) ? "OTHER" : "EMPTY_SESSION_FRAGMENT" });
    } catch { /* Preserve unreadable legacy evidence. */ }
  }
  for (const record of records) if ((ids.get(record.session.anonymousTripId || record.session.id) || 0) > 1) record.classification = "DUPLICATE_ARCHIVE";
  const sameDayGroups = new Map<string, string[]>();
  for (const record of records) {
    const day = (record.session.plannedContext?.startDate || record.session.createdAt || "unknown").slice(0, 10), key = `${regionId}:${day}`;
    sameDayGroups.set(key, [...(sameDayGroups.get(key) || []), record.session.anonymousTripId || record.session.id]);
  }
  return {
    regionId,
    archiveCount: records.length,
    duplicateSessionIds: [...ids].filter(([, count]) => count > 1).map(([id]) => id),
    sameDayGroups: [...sameDayGroups].filter(([, sessionIds]) => sessionIds.length > 1).map(([day, sessionIds]) => ({ day, sessionIds })),
    records,
  };
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
export function preserveTripForEssentialDetour(
  session: TripSession,
  detour: { category: string; entityId?: string },
): TripSession {
  return {
    ...session,
    runtimeContext: { ...session.runtimeContext, essentialServiceDetour: detour },
  };
}
export interface TripRestorationDiagnostics {
  regionId: string;
  activeStorageKey: string;
  anonymousTripIdPresent: boolean;
  anonymousTripIdHint?: string;
  hasStructuredJourney: boolean;
  itineraryStepCount: number;
  savedPlaceCount: number;
  executionStatePresent: boolean;
  archiveCount?: number;
  activeSessionPointer: "REGIONAL_STORAGE_KEY";
  restorationSource: "LOCAL" | "SESSION_FALLBACK" | "EMPTY";
  uiState: "CONTINUE" | "EMPTY";
  localStorageKeyFound: boolean;
  sessionStorageFallbackFound: boolean;
  storedValueStatus: "VALID" | "REJECTED" | "MISSING";
  newSessionWouldBeCreated: boolean;
  persistenceBlocked: boolean;
  newSessionCreated: boolean;
  persistenceOccurredBeforeRestoration: boolean;
}
export function tripRestorationDiagnostics(
  regionId: string,
  storage: Pick<Storage, "getItem" | "setItem"> &
    Partial<Pick<Storage, "length" | "key">> = localStorage,
): TripRestorationDiagnostics {
  const storageKey = tripStorageKey(regionId),
    localValue = storage.getItem(storageKey),
    fallbackValue=typeof sessionStorage!=="undefined"&&typeof localStorage!=="undefined"&&storage===localStorage?sessionStorage.getItem(storageKey):null,
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
    anonymousTripIdPresent: Boolean(session?.anonymousTripId),
    anonymousTripIdHint: session?.anonymousTripId ? `…${session.anonymousTripId.slice(-6)}` : undefined,
    hasStructuredJourney: Boolean((session?.itinerary as any)?.steps?.length),
    itineraryStepCount:Array.isArray((session?.itinerary as any)?.steps)?(session!.itinerary as any).steps.length:0,
    savedPlaceCount: session?.savedPlaces?.length || 0,
    executionStatePresent: Boolean(session?.execution?.currentEntityId||Object.keys(session?.execution?.statusByEntityId||{}).length),
    archiveCount,
    activeSessionPointer: "REGIONAL_STORAGE_KEY",
    restorationSource: session ? (localValue ? "LOCAL" : "SESSION_FALLBACK") : "EMPTY",
    uiState: hasSavedTrip(session) ? "CONTINUE" : "EMPTY",
    localStorageKeyFound:Boolean(localValue),
    sessionStorageFallbackFound:Boolean(fallbackValue),
    storedValueStatus:session?"VALID":localValue||fallbackValue?"REJECTED":"MISSING",
    newSessionWouldBeCreated:!session&&!localValue&&!fallbackValue,
    persistenceBlocked:!session&&Boolean(localValue||fallbackValue),
    newSessionCreated:false,
    persistenceOccurredBeforeRestoration:false,
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
