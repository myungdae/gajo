import axios from "axios";

// In dev, Vite proxies /api -> http://localhost:3000 (see vite.config.ts).
// In production (Docker/nginx), nginx proxies /api/ -> the api container.
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export interface CompanionInput {
  age?: number;
  relationship?: string;
  healthConditions?: string[];
}

export interface CreateContextInput {
  turnId?: string;
  conversationalAnchor?: {
    entityId: string;
    regionId: string;
    label?: string;
    entityType?: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    source?: "RDM" | "SEARCH";
    sourceTurnId: string;
    role: "RESULT" | "SUBJECT" | "SELECTED";
  };
  discoveryContext?: {
    regionId: string;
    anchor: {
      entityId: string;
      label?: string;
      latitude?: number;
      longitude?: number;
      source?: "RDM" | "SEARCH";
    };
    targetCategory:
      | "FOOD"
      | "CAFE"
      | "LODGING"
      | "HOT_SPRING_WELLNESS"
      | "ACTIVITY"
      | "TOURISM_NATURE"
      | "CONVENIENCE"
      | "ESSENTIAL_SHOPPING"
      | "CONVENIENCE_STORE"
      | "MART_SUPERMARKET"
      | "PARKING"
      | "PUBLIC_TOILET"
      | "HEAT_SHELTER"
      | "GAS_STATION"
      | "EV_CHARGER"
      | "TOURIST_INFORMATION";
    relation: "NEARBY" | "REGIONAL";
    currentResult?: {
      entityId: string;
      label?: string;
      latitude?: number;
      longitude?: number;
      source?: "RDM" | "SEARCH";
    };
    shownEntityIds: string[];
    sourceTurnId: string;
  };
  regionId?: string;
  explicitJourney?: {
    requestedDestinations: NonNullable<
      ConciergeChatResponse["requestedDestinations"]
    >;
    multiDestination: true;
    sourceTurnId: string;
  };
  mustVisitPlaces?: Array<{
    entityId?: string;
    label: string;
    requestedLabel?: string;
    resolved: boolean;
    requested?: boolean;
    source?: "RDM" | "SEARCH" | "SEMANTIC";
    category?: string;
    entityType?: string;
    latitude?: number;
    longitude?: number;
    verificationStatus?: string;
  }>;
  accommodationIntents?: Array<{
    entityId?: string;
    label: string;
    resolved: boolean;
  }>;
  rawMessage?: string;
  visitorNo?: string;
  visitorAge?: number;
  healthConditions?: string[];
  wellnessGoals?: string[];
  companions?: CompanionInput[];
  weather?: string;
  congestion?: string;
  currentTime?: string;
  currentDate?: string;
  dayOfWeek?: string;
  temperature?: number;
  precipitation?: number;
  latitude?: number;
  longitude?: number;
  transportMode?:
    | "WALK"
    | "CAR"
    | "PUBLIC_TRANSPORT"
    | "PUBLIC_TRANSIT"
    | "UNKNOWN"
    | "OTHER";
  locationAccuracy?: number;
  locationObservedAt?: string;
  locationStatus?:
    "AVAILABLE" | "DENIED" | "UNAVAILABLE" | "TIMEOUT" | "UNKNOWN";
  stayUntil?: string;
  walkingLevel?: "LOW" | "MODERATE" | "HIGH";
  companionConstraints?: string[];
  congestionState?: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
  runtimeStates?: EntityRuntimeState[];
  activityPreferences?: string[];
  contextSessionId?: string;
  inputMode?: "STRUCTURED" | "FREE_TEXT";
  isFollowup?: boolean;
  discoveryCategoryHint?:
    | "FOOD"
    | "CAFE"
    | "LODGING"
    | "HOT_SPRING_WELLNESS"
    | "ACTIVITY"
    | "TOURISM_NATURE"
    | "CONVENIENCE"
    | "ESSENTIAL_SHOPPING"
    | "CONVENIENCE_STORE"
    | "MART_SUPERMARKET"
    | "PARKING"
    | "PUBLIC_TOILET"
    | "HEAT_SHELTER"
    | "GAS_STATION"
    | "EV_CHARGER"
    | "TOURIST_INFORMATION";
  tripContext?: {
    anonymousTripId: string;
    currentEntityId?: string;
    nextEntityId?: string;
    completedEntityIds: string[];
    skippedEntityIds: string[];
    savedEntityIds: string[];
    itineraryEntityIds: string[];
    excludedEntityIds: string[];
  };
}

export interface EntityRuntimeState {
  entityUri: string;
  availability?: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  operatingState?: "OPEN" | "CLOSING_SOON" | "CLOSED" | "UNKNOWN";
  congestion?: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
  reservationState?: "AVAILABLE" | "REQUIRED" | "FULL" | "UNKNOWN";
  closingTime?: string;
  estimatedTravelMinutes?: number;
  observedAt?: string;
}

export interface EvidenceStep {
  subject: string;
  subjectLabel: string;
  predicate: string;
  predicateLabel: string;
  object: string;
  objectLabel: string;
}

export interface FiredRule {
  ruleUri: string;
  ruleLabel: string;
  ifCondition: string;
  thenRecommendation?: string;
  thenAction?: string;
  policyUri?: string;
  policyLabel?: string;
}

export interface UriLabel {
  uri: string;
  label: string;
}

export interface ConciergeChatResponse {
  context: any;
  evidence: EvidenceStep[];
  firedRules: FiredRule[];
  operation?: any;
  tasks?: any[];
  executionLog?: any[];
  recommendation?: any;
  reservationCheck?: any[];
  usedAgents?: string[];
  usedAgentLabels?: UriLabel[];
  risks?: string[];
  riskLabels?: UriLabel[];
  confidenceScore?: number;
  nextAction?: string;
  error?: string;
  nearbyRestaurantIntent?: boolean;
  nearbyDiscoveryIntent?: boolean;
  nearbyCategory?: NearbyCategory;
  visitorMessage?: string;
  requestedDestinations?: Array<{
    entityId?: string;
    label: string;
    requestedLabel?: string;
    resolved: boolean;
    requested?: boolean;
    source?: "RDM" | "SEARCH" | "SEMANTIC";
    verificationStatus?: string;
  }>;
  intentRoute?:
    | "JOURNEY_PLAN"
    | "PLACE_DISCOVERY"
    | "DISTANCE_INFO"
    | "IMMEDIATE_NOW"
    | "FIRST_TIME_VISITOR"
    | "GUIDE_EXPLANATION"
    | "REPLAN";
  guideExplanation?: {
    status: "ANSWERED";
    intent: string;
    audience: string;
    answer: string;
    relatedQuestions?: string[];
  };
  journeyContinuation?: { prompt: string; preserveJourney: true };
  firstTimeVisitor?: {
    regionId: string;
    status: "READY" | "CORE_DATA_INSUFFICIENT";
    candidates: Array<{
      entityId?: string;
      label: string;
      category: string;
      reason: string;
    }>;
  };
  discovery?: {
    regionId: string;
    category: string;
    anchorEntityId?: string;
    anchorLabel?: string;
    anchorLatitude?: number;
    anchorLongitude?: number;
    relation?: "NEARBY" | "REGIONAL";
    targetCategory?: string;
    categoryFallbackNotice?: string;
    safetyDataStatus?: "DATA_INSUFFICIENT";
    visitorMessage?: string;
    searchFallback?: {
      used: boolean;
      source: string;
      evidenceRetention: string;
    };
    entities: any[];
  };
  distanceInfo?: {
    status: "RESOLVED" | "NEEDS_CLARIFICATION";
    message?: string;
    regionId?: string;
    fromEntityId?: string;
    fromLabel?: string;
    toEntityId?: string;
    toLabel?: string;
    distanceMeters?: number;
    calculation?: string;
  };
  conversationalReference?: CreateContextInput["conversationalAnchor"];
  domainResult?: {
    status: "OUT_OF_SERVICE_AREA";
    destination: string;
    region: string;
  };
}

export async function postConciergeChat(input: CreateContextInput) {
  const { data } = await api.post<ConciergeChatResponse>(
    "/concierge/chat",
    input,
  );
  return data;
}

export async function runDemoScenario() {
  const { data } = await api.post<ConciergeChatResponse>("/demo/scenario");
  return data;
}

export async function fetchFacilities(regionId: string) {
  const { data } = await api.get("/facilities", { params: { regionId } });
  return data;
}

export interface OperationalPlace {
  uri: string;
  label: string;
  description?: string;
  latitude: number;
  longitude: number;
  category?: string;
  operatingHours?: any[];
  walkingBurden?: string;
  coordinateVerification: "VERIFIED";
}

export async function fetchOperationalPlaces(regionId: string) {
  const { data } = await api.get<OperationalPlace[]>("/operational-places", {
    params: { regionId },
  });
  return data;
}

export async function fetchPrograms() {
  const { data } = await api.get("/programs");
  return data;
}

export async function fetchAdminDashboard() {
  const { data } = await api.get("/admin/dashboard");
  return data;
}

export async function fetchOntologyStats() {
  const { data } = await api.get("/ontology/stats");
  return data;
}

export async function fetchOntologyClasses() {
  const { data } = await api.get("/ontology/classes");
  return data;
}

export async function fetchOntologyProperties() {
  const { data } = await api.get("/ontology/properties");
  return data;
}

export async function fetchOntologyIndividuals() {
  const { data } = await api.get("/ontology/individuals");
  return data;
}

export async function traverseOntology(
  start: string,
  predicate: string,
  depth?: number,
) {
  const { data } = await api.get("/ontology/traverse", {
    params: { start, predicate, depth },
  });
  return data;
}

export async function expandOntology(uris: string[]) {
  const { data } = await api.get("/ontology/expand", {
    params: { uris: uris.join(",") },
  });
  return data;
}

export async function queryOntology(
  subject?: string,
  predicate?: string,
  object?: string,
) {
  const { data } = await api.get("/ontology/query", {
    params: { subject, predicate, object },
  });
  return data;
}

export async function checkReservation(facilityUri: string, date?: string) {
  const { data } = await api.post("/reservations/check", { facilityUri, date });
  return data;
}

// ---- Nearby (real-world, GPS-anchored) restaurant finder ----
// Separate from the ontology-driven recommendation flow: this hits
// /api/nearby/* which proxies the Kakao Local API using the visitor's
// live location, rather than traversing the Gajo domain ontology.

export interface NearbyRestaurant {
  id: string;
  name: string;
  categoryName: string;
  categoryGroup: string;
  address: string;
  roadAddress?: string;
  phone?: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  placeUrl: string;
  matchedKeyword?: string;
}

export interface NearbyRestaurantsResponse {
  origin: { lat: number; lng: number };
  radius: number;
  total: number;
  groups: Record<string, NearbyRestaurant[]>;
  results: NearbyRestaurant[];
  resultStatus: "AVAILABLE" | "EMPTY";
}
export async function fetchRegionalData(filters: Record<string, string> = {}) {
  const { data } = await api.get("/admin/regional-data", { params: filters });
  return data;
}
export async function regionalDataAction(
  id: string,
  action: string,
  editedFacts: Record<string, unknown> | undefined,
  token: string,
) {
  const { data } = await api.post(
    `/admin/regional-data/${id}/actions/${action}`,
    { editedFacts },
    { headers: { "x-admin-token": token } },
  );
  return data;
}
export async function createRegionalCandidate(payload: any, token: string) {
  const { data } = await api.post("/admin/regional-data/candidates", payload, {
    headers: { "x-admin-token": token },
  });
  return data;
}
export async function exportRegionalData(
  regionId: string,
  token: string,
  options: { includeChanges?: boolean; backup?: boolean } = {},
) {
  const { data } = await api.get("/admin/regional-data/export", {
    params: { regionId, ...options },
    headers: { "x-admin-token": token },
  });
  return data;
}
export async function previewRegionalDataImport(
  packageValue: any,
  token: string,
  trustedVerified = false,
) {
  const { data } = await api.post(
    "/admin/regional-data/import/preview",
    { package: packageValue, trustedVerified },
    { headers: { "x-admin-token": token } },
  );
  return data;
}
export async function importRegionalData(
  packageValue: any,
  token: string,
  trustedVerified = false,
) {
  const { data } = await api.post(
    "/admin/regional-data/import",
    { package: packageValue, trustedVerified },
    { headers: { "x-admin-token": token } },
  );
  return data;
}
export async function fetchPilotAnalytics() {
  const { data } = await api.get("/analytics/summary");
  return data;
}

export type NearbyCategory =
  | "FOOD"
  | "CAFE"
  | "LODGING"
  | "HOT_SPRING_WELLNESS"
  | "GOLF_SCREEN_GOLF"
  | "ACTIVITY"
  | "TOURISM_NATURE"
  | "CONVENIENCE"
  | "ESSENTIAL_SHOPPING"
  | "CONVENIENCE_STORE"
  | "MART_SUPERMARKET"
  | "PARKING"
  | "PUBLIC_TOILET"
  | "HEAT_SHELTER"
  | "GAS_STATION"
  | "EV_CHARGER"
  | "TOURIST_INFORMATION"
  | "OTHER";
export interface NearbyPlace {
  id: string;
  name: string;
  category: NearbyCategory;
  categoryLabel: string;
  providerCategoryName: string;
  address: string;
  roadAddress?: string;
  phone?: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  estimatedTravelMinutes?: number;
  placeUrl: string;
  matchedKeyword?: string;
  indoorRelevance: "INDOOR" | "OUTDOOR" | "UNKNOWN";
  operatingState: "UNKNOWN";
  operatingMessage: string;
  availabilityMessage?: string;
  contextualReasons: string[];
  canonicalEntityUri?: string;
  canonicalLabel?: string;
  masterVerificationStatus?: string;
  transient: boolean;
  relevanceScore: number;
}
export interface NearbyDiscoveryResponse {
  origin: { lat: number; lng: number; distanceTrusted: boolean };
  category: NearbyCategory;
  radius: number;
  total: number;
  resultStatus: "AVAILABLE" | "EMPTY";
  results: NearbyPlace[];
}

export async function fetchNearbyStatus(regionId?: string) {
  const { data } = await api.get<{
    configured: boolean;
    state: "READY" | "NOT_CONFIGURED";
    provider: "KAKAO_LOCAL" | "REGIONAL_OPERATIONAL_DATA";
    timeoutMs: number;
  }>("/nearby/status", { params: { regionId } });
  return data;
}

export async function fetchNearbyRestaurants(
  lat: number,
  lng: number,
  radius = 2000,
) {
  const { data } = await api.get<NearbyRestaurantsResponse>(
    "/nearby/restaurants",
    {
      params: { lat, lng, radius },
    },
  );
  return data;
}

export interface RoutePreview {
  available: boolean;
  coordinates?: [number, number][];
  distanceMeters?: number;
  durationSeconds?: number;
}

export async function fetchRoutePreview(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  mode: "foot" | "car" = "foot",
) {
  const { data } = await api.get<RoutePreview>("/nearby/route", {
    params: { startLat, startLng, endLat, endLng, mode },
  });
  return data;
}

export interface NavigationLinks {
  kakaoMapApp: string;
  kakaoMapWeb: string;
  naverMapApp: string;
  googleMaps: string;
}

export async function fetchNavigationLinks(
  lat: number,
  lng: number,
  name: string,
) {
  const { data } = await api.get<NavigationLinks>("/nearby/navigation-links", {
    params: { lat, lng, name },
  });
  return data;
}

export async function createReservation(payload: {
  visitorNo: string;
  facilityUri: string;
  programUri?: string;
  date: string;
  timeSlot?: string;
  partySize?: number;
  note?: string;
}) {
  const { data } = await api.post("/reservations/create", payload);
  return data;
}

export async function fetchNearbyDiscovery(
  category: NearbyCategory,
  lat: number,
  lng: number,
  options: {
    radius?: number;
    weather?: string;
    useDistance?: boolean;
    transportMode?: "car" | "foot";
    regionId?: string;
  } = {},
) {
  const { data } = await api.get<NearbyDiscoveryResponse>("/nearby/discovery", {
    params: {
      category,
      lat,
      lng,
      radius: options.radius || 2500,
      weather: options.weather,
      useDistance: options.useDistance !== false,
      transportMode: options.transportMode || "foot",
      regionId: options.regionId,
    },
  });
  return data;
}

export interface OntologyEntityDetail {
  uri: string;
  label: string;
  comment?: string;
  literalProps?: Record<string, any>;
  objectProps?: Record<string, string[]>;
  programNature?: "OFFICIAL" | "AI_COMPOSED";
  masterData?: any;
}

export async function fetchProgram(uri: string) {
  const { data } = await api.get<OntologyEntityDetail>(
    `/programs/${encodeURIComponent(uri)}`,
  );
  return data;
}

export async function fetchFacility(uri: string) {
  const { data } = await api.get<OntologyEntityDetail>(
    `/facilities/${encodeURIComponent(uri)}`,
  );
  return data;
}

export interface ReplanningProposal {
  proposalNo: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED";
  triggerEvent: { eventType: string; currentValue?: unknown };
  impacts: Array<{ level: string; affectedItems: any[]; reasons: string[] }>;
  preservedHistory: any[];
  removedItems: any[];
  proposedNewItems: any[];
  proposedFutureSteps: any[];
  explanation: string;
}

export async function observeRuntime(payload: {
  regionId?: string;
  previousContext?: any;
  currentContext?: any;
  itinerary?: any;
  previousContextNo?: string;
  currentContextNo?: string;
  itineraryNo?: string;
}) {
  const { data } = await api.post("/runtime-replanning/observe", payload);
  return data as {
    events: any[];
    impacts: any[];
    replanningRecommended: boolean;
    proposedRevision: ReplanningProposal | null;
    suppressed?: boolean;
  };
}

export async function approveReplanning(proposalNo: string) {
  const { data } = await api.post(`/runtime-replanning/${proposalNo}/approve`);
  return data;
}

export async function rejectReplanning(proposalNo: string) {
  const { data } = await api.post(`/runtime-replanning/${proposalNo}/reject`);
  return data;
}

export interface LiveRuntimeResponse {
  context: any;
  metadata: {
    regionId?: string;
    observedAt: string;
    source: "OPEN_METEO" | "UNAVAILABLE";
    status: "LIVE" | "STALE" | "UNAVAILABLE";
    stale: boolean;
    location: {
      latitude: number;
      longitude: number;
      timezone: string;
      sourceId?: string;
    } | null;
  };
}

export async function fetchLiveRuntimeContext(
  regionId: string,
  contextNo?: string,
) {
  const { data } = await api.get<LiveRuntimeResponse>("/runtime-context/live", {
    params: { regionId, ...(contextNo ? { contextNo } : {}) },
  });
  return data;
}

export async function hydrateRuntimeLocation(
  context: any,
  location: any,
  regionId: string,
) {
  const { data } = await api.post<LiveRuntimeResponse>(
    "/runtime-context/hydrate",
    { regionId, context: { ...context, regionId }, location },
  );
  return data;
}
export async function fetchAnonymousTrip(
  anonymousTripId: string,
  regionId: string,
) {
  const { data } = await api.get(
    `/trips/anonymous/${encodeURIComponent(anonymousTripId)}`,
    { params: { regionId } },
  );
  return data;
}
export async function syncAnonymousTrip(payload: any) {
  const { data } = await api.post("/trips/anonymous/sync", payload);
  return data;
}

export interface PublicPartner {
  partnerId: string;
  canonicalEntityId: string;
  regionId: string;
  partnerSlug: string;
  displayName: string;
  category?: string;
  address?: string;
  phone?: string;
  description?: string;
  representativeImageUrl?: string;
  status: string;
  qrStatus: string;
  verificationStatus: string;
}
export async function fetchPublicPartner(slug: string) {
  const { data } = await api.get<PublicPartner>(
    `/partners/public/${encodeURIComponent(slug)}`,
  );
  return data;
}
export async function recordPartnerEntry(
  slug: string,
  payload: { anonymousTripId: string; regionId: string },
) {
  const { data } = await api.post(
    `/partners/public/${encodeURIComponent(slug)}/entries`,
    payload,
  );
  return data;
}
export async function confirmQrVisit(
  slug: string,
  payload: { anonymousTripId: string; regionId: string },
) {
  const { data } = await api.post(
    `/partners/public/${encodeURIComponent(slug)}/visits`,
    payload,
  );
  return data;
}
export async function requestBenefitUse(
  benefitId: string,
  payload: {
    anonymousTripId: string;
    regionId: string;
    idempotencyKey: string;
  },
) {
  const { data } = await api.post(
    `/partners/benefits/${encodeURIComponent(benefitId)}/redemptions`,
    payload,
  );
  return data;
}
export async function applyForPartnership(payload: any) {
  const { data } = await api.post("/partners/applications", payload);
  return data;
}
export async function fetchPartnerMetrics(slug: string, key: string) {
  const { data } = await api.get(
    `/partners/${encodeURIComponent(slug)}/metrics`,
    { headers: { "x-partner-key": key } },
  );
  return data;
}
export async function confirmBenefitUse(
  slug: string,
  redemptionId: string,
  key: string,
  decision: "CONFIRM" | "DECLINE",
) {
  const { data } = await api.patch(
    `/partners/${encodeURIComponent(slug)}/redemptions/${encodeURIComponent(redemptionId)}`,
    { decision },
    { headers: { "x-partner-key": key } },
  );
  return data;
}
export async function createPartnerBenefit(
  slug: string,
  key: string,
  payload: any,
) {
  const { data } = await api.post(
    `/partners/${encodeURIComponent(slug)}/benefits`,
    payload,
    { headers: { "x-partner-key": key } },
  );
  return data;
}
export async function recordPartnerRecommendations(payload: {
  regionId: string;
  anonymousTripId: string;
  entityIds: string[];
}) {
  const { data } = await api.post("/partners/recommendations", payload);
  return data;
}
export async function downloadPartnerTestQr(
  slug: string,
  key: string,
  kind: "go" | "visit",
  format: "svg" | "png",
) {
  const response = await api.get(`/partners/${encodeURIComponent(slug)}/qr`, {
    params: { kind, format, test: true },
    headers: { "x-partner-key": key },
    responseType: "blob",
  });
  return {
    blob: response.data as Blob,
    filename: `${slug}-${kind}-test.${format}`,
  };
}
