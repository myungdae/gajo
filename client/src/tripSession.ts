import type { CreateContextInput } from "./api/client";
export interface PlannedPlace {
  label: string;
  entityId?: string;
  savedPlaceId?: string;
  regionId?: string;
  resolved: boolean;
  provider?:"KAKAO"|"REGIONAL_DATA";
  providerPlaceId?:string;
  address?:string;
  latitude?:number;
  longitude?:number;
  category?:string;
  provenance?:string;
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
export type TripLocationStatus="UNKNOWN"|"REQUESTING"|"RESOLVED"|"CONFIRMED"|"STALE"|"DENIED"|"ERROR";
export type TripLocationSource="GPS"|"MANUAL"|"SELECTED_PLACE"|"TRIP_CONTEXT";
export interface TripLocation {status:TripLocationStatus;source:TripLocationSource;latitude?:number;longitude?:number;accuracy?:number;label?:string;address?:string;experienceRegionId?:string;searchRegionId?:string|null;regionMembership?:"INSIDE"|"OUTSIDE"|"UNCERTAIN";observedAt:string;confirmedAt?:string}
export const NOW_LOCATION_FRESH_MS=30*60*1000;
export const LOCATION_SENSITIVE_FRESH_MS=5*60*1000;
export function isFreshTripLocation(location?:TripLocation,now=Date.now(),maxAgeMs=NOW_LOCATION_FRESH_MS){const confirmed=Date.parse(location?.confirmedAt||'');return location?.status==='CONFIRMED'&&Number.isFinite(confirmed)&&now-confirmed<=maxAgeMs}
export function isLocationSensitiveRequest(text=""){return /(?:주변|가까운|가까이|근처|거리|지금\s*(?:갈|어디)|다음\s*어디|식당|맛집|밥|카페|커피|마트|슈퍼|편의점|주유소|약국|병원|화장실|주차장|ATM)/i.test(text)}
export interface TripSession {
  id: string;
  anonymousTripId: string;
  deletionToken?: string;
  regionId: string;
  mode: "PLAN" | "NOW";
  partnerEntryContext?: { partnerId:string; partnerSlug:string; partnerName:string; enteredAt:string; source:"PARTNER_QR" };
  plannedContext?: PlannedContext;
  runtimeContext?: any;
  locationContext?: { now?:TripLocation; planStart?:TripLocation; tripBaseline?:TripLocation; pendingReplan?:{createdAt:string;from?:TripLocation;to:TripLocation;distanceMeters?:number;impact:"REVIEW_REMAINING_ROUTE";itineraryPreserved:true} };
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
export function rememberTripAccommodation(session: TripSession, place: PlannedPlace): TripSession {
  return {
    ...session,
    plannedContext: { ...(session.plannedContext || {}), accommodationIntents: [place] },
    updatedAt: new Date().toISOString(),
  };
}
export const tripStorageKey = (regionId: string) =>
  `regional-concierge-trip-session-v1:${regionId}`;
type TripStorageCandidate = { source: "local" | "session"; session: TripSession; timestamp?: number };
const safeTripCandidate = (
  storage: Pick<Storage, "getItem"> | undefined,
  storageKey: string,
  regionId: string,
  source: TripStorageCandidate["source"],
): TripStorageCandidate | undefined => {
  if (!storage) return undefined;
  try {
    const value = storage.getItem(storageKey);
    if (!value) return undefined;
    const session = JSON.parse(value) as TripSession;
    if (!session || typeof session !== "object" || typeof session.id !== "string" || session.regionId !== regionId) return undefined;
    const parsed = Date.parse(session.updatedAt || "");
    return { source, session, ...(Number.isFinite(parsed) ? { timestamp: parsed } : {}) };
  } catch {
    return undefined;
  }
};
export function selectTripStorageCandidate(candidates: TripStorageCandidate[]): TripStorageCandidate | undefined {
  const local = candidates.find((candidate) => candidate.source === "local"),
    session = candidates.find((candidate) => candidate.source === "session");
  if (!local || !session) return local || session;
  const localValid = local.timestamp !== undefined, sessionValid = session.timestamp !== undefined;
  if (localValid !== sessionValid) return localValid ? local : session;
  if (!localValid) return local;
  if (local.timestamp !== session.timestamp) return local.timestamp! > session.timestamp! ? local : session;
  return JSON.stringify(local.session) === JSON.stringify(session.session) ? local : session;
}
const browserSessionStorage = (): Storage | undefined => {
  try { return typeof sessionStorage !== "undefined" ? sessionStorage : undefined; } catch { return undefined; }
};
const isBrowserLocalStorage = (storage: unknown) => {
  try { return typeof localStorage !== "undefined" && storage === localStorage; } catch { return false; }
};
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
    deletionToken: crypto.randomUUID(),
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
    const storageKey = tripStorageKey(regionId), candidates = [safeTripCandidate(storage, storageKey, regionId, "local")];
    if (isBrowserLocalStorage(storage)) candidates.push(safeTripCandidate(browserSessionStorage(), storageKey, regionId, "session"));
    const session = selectTripStorageCandidate(candidates.filter((candidate): candidate is TripStorageCandidate => Boolean(candidate)))?.session;
    if (!session) return undefined;
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
  const incomingTimestamp = Date.parse(session.updatedAt || ""), existingTimestamp = (() => { try { return Date.parse((existing && JSON.parse(existing)?.updatedAt) || ""); } catch { return NaN; } })(),
    nextTimestamp = Math.max(Date.now(), Number.isFinite(incomingTimestamp) ? incomingTimestamp + 1 : 0, Number.isFinite(existingTimestamp) ? existingTimestamp + 1 : 0),
    next = {
      ...session,
      anonymousTripId: session.anonymousTripId || session.id,
      updatedAt: new Date(nextTimestamp).toISOString(),
    },
    serialized = JSON.stringify(privacySafe(next));
  let localSaved = false;
  try {
    storage.setItem(storageKey, serialized);
    localSaved = isBrowserLocalStorage(storage);
  } catch {
    const fallback = browserSessionStorage();
    if (!fallback) throw new Error("trip storage unavailable");
    fallback.setItem(storageKey, serialized);
  }
  if (localSaved) {
    const fallback = browserSessionStorage(), fallbackCandidate = safeTripCandidate(fallback, storageKey, session.regionId, "session");
    if ((fallbackCandidate?.session.anonymousTripId || fallbackCandidate?.session.id) === next.anonymousTripId) {
      try { fallback?.removeItem(storageKey); } catch { /* local save remains authoritative */ }
    }
  }
  if (typeof window !== "undefined" && storage === localStorage)
    window.dispatchEvent(
      new CustomEvent("regional-trip-saved", {
        detail: { regionId: session.regionId },
      }),
    );
  return next;
}
export function updateLatestTripSession(
  regionId: string,
  expectedAnonymousTripId: string,
  updater: (session: TripSession) => TripSession | null | undefined,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): TripSession | undefined {
  const latest = loadTripSession(storage, regionId);
  if (!latest || latest.anonymousTripId !== expectedAnonymousTripId) return undefined;
  const updated = updater(latest);
  if (updated === null) return latest;
  if (
    !updated ||
    updated.regionId !== latest.regionId ||
    updated.id !== latest.id ||
    updated.anonymousTripId !== latest.anonymousTripId
  ) return undefined;
  try {
    return saveTripSession(updated, storage);
  } catch {
    return undefined;
  }
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
export type ArchiveDeleteResult = "DELETED" | "NOT_FOUND" | "FORBIDDEN";
type ArchiveStorage = Pick<Storage, "getItem" | "removeItem" | "length" | "key">;
export function deleteArchivedTripSession(
  regionId: string,
  anonymousTripId: string,
  storage: ArchiveStorage = localStorage,
): ArchiveDeleteResult {
  const active = loadTripSession(storage as any, regionId);
  if (active?.anonymousTripId === anonymousTripId) return "FORBIDDEN";
  const key = `${archivePrefix(regionId)}${anonymousTripId}`;
  const serialized = storage.getItem(key);
  if (!serialized) return "NOT_FOUND";
  try {
    const archived = JSON.parse(serialized) as TripSession;
    if (archived.regionId !== regionId || (archived.anonymousTripId || archived.id) !== anonymousTripId)
      return "FORBIDDEN";
  } catch { return "FORBIDDEN"; }
  storage.removeItem(key);
  if (typeof window !== "undefined" && storage === localStorage)
    window.dispatchEvent(new CustomEvent("regional-trip-saved", { detail: { regionId } }));
  return "DELETED";
}
export function deleteAllArchivedTripSessions(
  regionId: string,
  storage: ArchiveStorage = localStorage,
) {
  const ids = listArchivedTripSessions(regionId, storage).map((trip) => trip.anonymousTripId || trip.id);
  return ids.filter((id) => deleteArchivedTripSession(regionId, id, storage) === "DELETED");
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
export const locationDistance=(a?:TripLocation,b?:TripLocation)=>{if(!Number.isFinite(a?.latitude)||!Number.isFinite(a?.longitude)||!Number.isFinite(b?.latitude)||!Number.isFinite(b?.longitude))return undefined;const rad=(value:number)=>value*Math.PI/180,dLat=rad(b!.latitude!-a!.latitude!),dLng=rad(b!.longitude!-a!.longitude!),h=Math.sin(dLat/2)**2+Math.cos(rad(a!.latitude!))*Math.cos(rad(b!.latitude!))*Math.sin(dLng/2)**2;return Math.round(12742000*Math.asin(Math.sqrt(h)))};
export function isMaterialLocationMove(previous?:TripLocation,next?:TripLocation){const distance=locationDistance(previous,next),threshold=Math.max(250,(previous?.accuracy||0)+(next?.accuracy||0));return distance!==undefined&&distance>threshold}
export function confirmTripLocation(regionId:string,mode:"NOW"|"PLAN",location:TripLocation,storage:Pick<Storage,"getItem"|"setItem">=localStorage){const current=loadTripSession(storage,regionId);if(!current)return undefined;const confirmed={...location,status:"CONFIRMED" as const,confirmedAt:new Date().toISOString()},prior=mode==="NOW"?current.locationContext?.now:current.locationContext?.planStart,distanceMeters=locationDistance(prior,confirmed),movementThreshold=Math.max(250,(prior?.accuracy||0)+(confirmed.accuracy||0)),materialMove=distanceMeters!==undefined&&distanceMeters>movementThreshold,pendingDistance=locationDistance(current.locationContext?.pendingReplan?.to,confirmed),sameProposal=pendingDistance!==undefined&&pendingDistance<=movementThreshold,pendingReplan=mode==="NOW"&&prior?.status==="CONFIRMED"&&current.itinerary&&materialMove&&!sameProposal?{createdAt:new Date().toISOString(),from:prior,to:confirmed,distanceMeters,impact:"REVIEW_REMAINING_ROUTE" as const,itineraryPreserved:true as const}:current.locationContext?.pendingReplan;return saveTripSession({...current,locationContext:{...current.locationContext,...(mode==="NOW"?{now:confirmed}:{planStart:confirmed}),...(!current.locationContext?.tripBaseline?{tripBaseline:confirmed}:{}),...(pendingReplan?{pendingReplan}:{})}},storage)}
export function clearPendingLocationReplan(regionId:string,storage:Pick<Storage,"getItem"|"setItem">=localStorage){const current=loadTripSession(storage,regionId);if(!current)return undefined;const locationContext={...current.locationContext};delete locationContext.pendingReplan;return saveTripSession({...current,locationContext},storage)}
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
  const steps = Array.isArray((s.itinerary as any)?.steps) ? (s.itinerary as any).steps : [];
  const entityId = (item: any) => item?.entityId || item?.programUri || item?.facilityUri;
  const itineraryEntityIds = steps.map(entityId).filter(Boolean);
  const completedEntityIds = Object.entries(s.execution?.statusByEntityId || {}).filter(([, status]) => status === "COMPLETED").map(([id]) => id);
  const skippedEntityIds = Object.entries(s.execution?.statusByEntityId || {}).filter(([, status]) => status === "SKIPPED").map(([id]) => id);
  const savedEntityIds = (s.savedPlaces || []).map(entityId).filter(Boolean);
  const currentIndex = s.execution?.currentEntityId ? itineraryEntityIds.indexOf(s.execution.currentEntityId) : -1;
  const nextEntityId = itineraryEntityIds.slice(Math.max(0, currentIndex + 1)).find((id: string) => !completedEntityIds.includes(id) && !skippedEntityIds.includes(id));
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
    tripContext: {
      anonymousTripId: s.anonymousTripId,
      currentEntityId: s.execution?.currentEntityId,
      nextEntityId,
      completedEntityIds,
      skippedEntityIds,
      savedEntityIds,
      itineraryEntityIds,
      excludedEntityIds: [...new Set([...completedEntityIds, ...skippedEntityIds])],
    },
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
