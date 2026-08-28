import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addEntityToRegionalItinerary,
  addAccommodationToRegionalItinerary,
  appendItineraryItem,
  currentAndNext,
  executionState,
  itinerarySteps,
  removeSavedPlace,
  savedPlaceItems,
  verifiedNavigation,
} from "./journeyExecution.ts";
import {
  createTripSession,
  loadTripSession,
  saveTripSession,
} from "./tripSession.ts";
const mountain = {
  entityId: "https://hapcheon.example/ontology#hwangmaesanCountyPark",
  regionId: "hapcheon",
  label: "황매산 군립공원",
  actions: { navigate: { latitude: 35.495, longitude: 127.974 } },
};
const videoPark = {
  uri: "https://hapcheon.example/ontology#hapcheonGardenThemePark",
  regionId: "hapcheon",
  label: "합천영상테마파크",
  actions: { navigate: { latitude: 35.553365758, longitude: 128.0738450568 } },
};
const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};
test("adding an itinerary entity produces a planned next action without duplicates", () => {
  const first = appendItineraryItem(createTripSession("hapcheon"), mountain);
  assert.equal(first.added, true);
  assert.equal((first.session.itinerary as any).steps[0].status, "PLANNED");
  const repeated = appendItineraryItem(first.session, mountain);
  assert.equal(repeated.added, false);
  assert.equal((repeated.session.itinerary as any).steps.length, 1);
});
test("production-like EntityActions write persists Hapcheon video theme park exactly once", () => {
  const storage = memory(),
    events: string[] = [],
    emit = ((type: string) => events.push(type)) as any;
  const first = addEntityToRegionalItinerary(
      "hapcheon",
      videoPark,
      storage as any,
      emit,
    ),
    second = addEntityToRegionalItinerary(
      "hapcheon",
      videoPark,
      storage as any,
      emit,
    ),
    saved = loadTripSession(storage as any, "hapcheon")!;
  assert.equal(first.status, "added");
  assert.equal(second.status, "duplicate");
  assert.equal(
    savedPlaceItems(saved).filter((step) => step.entityId === videoPark.uri)
      .length,
    1,
  );
  assert.deepEqual(events, ["ITINERARY_ITEM_ADDED"]);
  assert.equal(verifiedNavigation(first.item).name, "합천영상테마파크");
});
test("saved places remain independently selectable and removal persists without changing another place", () => {
  const storage = memory(),
    lowful = {
      entityId: "urn:regional:hapcheon:lowful",
      regionId: "hapcheon",
      label: "로우풀",
      actions: { navigate: { latitude: 35.525488, longitude: 128.018877 } },
    };
  addEntityToRegionalItinerary("hapcheon", mountain, storage as any);
  addEntityToRegionalItinerary("hapcheon", lowful, storage as any);
  const before = loadTripSession(storage as any, "hapcheon")!,
    started = executionState(before, lowful.entityId, "EN_ROUTE");
  saveTripSession(started, storage as any);
  assert.deepEqual(
    savedPlaceItems(loadTripSession(storage as any, "hapcheon")).map(
      (x) => x.label,
    ),
    ["황매산 군립공원", "로우풀"],
  );
  removeSavedPlace("hapcheon", mountain.entityId, storage as any);
  const after = loadTripSession(storage as any, "hapcheon")!;
  assert.deepEqual(
    savedPlaceItems(after).map((x) => x.label),
    ["로우풀"],
  );
  assert.equal(after.execution?.currentEntityId, lowful.entityId);
});
test("lodging save rebases once on the latest session and preserves identity, location, itinerary, and saved places", () => {
  const data = new Map<string, string>();
  let writes = 0;
  const storage = {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => { writes += 1; data.set(key, value); },
  };
  const stale = saveTripSession(createTripSession("hapcheon"), storage as any);
  const existing = { entityId: "urn:place:existing", regionId: "hapcheon", label: "기존 장소" };
  const latest = saveTripSession({
    ...stale,
    itinerary: { steps: [{ entityId: "urn:step:latest" }] },
    savedPlaces: [existing],
    locationContext: { now: { status: "CONFIRMED", source: "GPS", latitude: 35.5, longitude: 128.1, observedAt: "2026-08-29T00:00:00Z", confirmedAt: "2026-08-29T00:00:00Z" } },
    runtimeContext: { regionId: "hapcheon", weather: "CLEAR" },
  }, storage as any);
  writes = 0;
  const lodging = { entityId: "kakao:AD5:123", regionId: "hapcheon", label: "강변 숙소", entityType: "ACCOMMODATION" };
  const result = addAccommodationToRegionalItinerary("hapcheon", { ...lodging, canonicalEntityUri: lodging.entityId }, stale.anonymousTripId, storage as any);
  const saved = loadTripSession(storage as any, "hapcheon")!;
  assert.equal(result.status, "saved");
  assert.equal(writes, 1);
  assert.equal(saved.anonymousTripId, latest.anonymousTripId);
  assert.deepEqual(saved.itinerary, latest.itinerary);
  assert.deepEqual(saved.locationContext, latest.locationContext);
  assert.deepEqual(saved.runtimeContext, latest.runtimeContext);
  assert.deepEqual(saved.savedPlaces?.map((place) => place.entityId), [existing.entityId, lodging.entityId]);
  assert.equal(saved.plannedContext?.accommodationIntents?.[0].savedPlaceId, lodging.entityId);
});
test("lodging save is idempotent but keeps same-name places with different stable ids", () => {
  const data = new Map<string, string>(); let writes = 0; const events: string[] = [];
  const storage = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { writes += 1; data.set(key, value); } };
  const session = saveTripSession(createTripSession("hapcheon"), storage as any); writes = 0;
  const first = { entityId: "kakao:AD5:1", regionId: "hapcheon", label: "같은 이름", entityType: "ACCOMMODATION" };
  const second = { ...first, entityId: "kakao:AD5:2" };
  const emit = ((type: string) => events.push(type)) as any;
  const firstResult = addAccommodationToRegionalItinerary("hapcheon", { ...first, canonicalEntityUri: first.entityId }, session.anonymousTripId, storage as any, emit);
  const writesAfterFirst = writes;
  const eventsAfterFirst = events.length;
  const secondResult = addAccommodationToRegionalItinerary("hapcheon", { ...first, canonicalEntityUri: first.entityId }, session.anonymousTripId, storage as any, emit);
  const writesAfterSecond = writes;
  const eventsAfterSecond = events.length;
  addAccommodationToRegionalItinerary("hapcheon", { ...second, canonicalEntityUri: second.entityId }, session.anonymousTripId, storage as any);
  const saved = loadTripSession(storage as any, "hapcheon")!;
  assert.equal(firstResult.status, "saved");
  assert.equal(writesAfterFirst, 1);
  assert.equal(secondResult.status, "unchanged");
  assert.equal(writesAfterSecond, writesAfterFirst);
  assert.equal(writes, 2);
  assert.equal(eventsAfterFirst, 1);
  assert.equal(eventsAfterSecond, eventsAfterFirst);
  assert.equal(events.length, 1);
  assert.deepEqual(saved.savedPlaces?.map((place) => place.entityId), [first.entityId, second.entityId]);
  assert.deepEqual(saved.plannedContext?.accommodationIntents?.map((intent) => intent.savedPlaceId), [second.entityId, first.entityId]);
});
test("lodging identifiers require a canonical URI or trimmed provider id", () => {
  const data = new Map<string, string>(); let writes = 0;
  const storage = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { writes += 1; data.set(key, value); } };
  const session = saveTripSession(createTripSession("hapcheon"), storage as any); writes = 0;
  const canonical = addAccommodationToRegionalItinerary("hapcheon", { canonicalEntityUri: "  https://example.test/stay/1  ", regionId: "hapcheon", label: "정식 숙소" }, session.anonymousTripId, storage as any);
  const provider = addAccommodationToRegionalItinerary("hapcheon", { providerPlaceId: "  kakao-2  ", regionId: "hapcheon", label: "제공자 숙소" }, session.anonymousTripId, storage as any);
  const beforeInvalid = data.get("regional-concierge-trip-session-v1:hapcheon");
  const missing = addAccommodationToRegionalItinerary("hapcheon", { regionId: "hapcheon", label: "식별자 없음" }, session.anonymousTripId, storage as any);
  const blank = addAccommodationToRegionalItinerary("hapcheon", { providerPlaceId: "   ", regionId: "hapcheon", label: "공백 식별자" }, session.anonymousTripId, storage as any);
  assert.equal(canonical.entityId, "https://example.test/stay/1");
  assert.equal(provider.entityId, "urn:nearby:hapcheon:kakao-2");
  assert.equal(missing.status, "error");
  assert.equal(blank.status, "error");
  assert.equal(writes, 2);
  assert.equal(data.get("regional-concierge-trip-session-v1:hapcheon"), beforeInvalid);
});
test("partial lodging state is repaired with one write", () => {
  const data = new Map<string, string>(); let writes = 0;
  const storage = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { writes += 1; data.set(key, value); } };
  const id = "https://example.test/stay/partial", base = createTripSession("hapcheon");
  const savedOnly = saveTripSession({ ...base, savedPlaces: [{ entityId: id, entityType: "ACCOMMODATION", label: "부분 숙소" }] }, storage as any); writes = 0;
  assert.equal(addAccommodationToRegionalItinerary("hapcheon", { canonicalEntityUri: id, regionId: "hapcheon", label: "부분 숙소" }, savedOnly.anonymousTripId, storage as any).status, "saved");
  assert.equal(writes, 1);
  const intentOnly = saveTripSession({ ...loadTripSession(storage as any, "hapcheon")!, savedPlaces: [], plannedContext: { accommodationIntents: [{ entityId: id, savedPlaceId: id, label: "부분 숙소", resolved: true }] } }, storage as any); writes = 0;
  assert.equal(addAccommodationToRegionalItinerary("hapcheon", { canonicalEntityUri: id, regionId: "hapcheon", label: "부분 숙소" }, intentOnly.anonymousTripId, storage as any).status, "saved");
  assert.equal(writes, 1);
});
test("storage fallback succeeds once and total storage failure returns error without events", () => {
  const key = "regional-concierge-trip-session-v1:hapcheon", session = createTripSession("hapcheon"), initial = JSON.stringify(session);
  const priorLocal = (globalThis as any).localStorage, priorSession = (globalThis as any).sessionStorage;
  try {
    const fallback = new Map<string, string>();
    const failingLocal = { getItem: (name: string) => name === key ? initial : null, setItem: () => { throw new Error("local failed"); } };
    (globalThis as any).localStorage = failingLocal;
    (globalThis as any).sessionStorage = { getItem: (name: string) => fallback.get(name) || null, setItem: (name: string, value: string) => void fallback.set(name, value) };
    const ok = addAccommodationToRegionalItinerary("hapcheon", { providerPlaceId: "fallback", regionId: "hapcheon", label: "대체 저장" }, session.anonymousTripId, failingLocal as any);
    assert.equal(ok.status, "saved");
    assert.equal(loadTripSession(failingLocal as any, "hapcheon")?.savedPlaces?.[0].entityId, "urn:nearby:hapcheon:fallback");
    const events: string[] = [];
    (globalThis as any).sessionStorage = { getItem: () => null, setItem: () => { throw new Error("session failed"); } };
    const failed = addAccommodationToRegionalItinerary("hapcheon", { providerPlaceId: "failed", regionId: "hapcheon", label: "실패 숙소" }, session.anonymousTripId, failingLocal as any, ((type: string) => events.push(type)) as any);
    assert.equal(failed.status, "error");
    assert.deepEqual(events, []);
    assert.equal(JSON.parse(initial).savedPlaces, undefined);
  } finally {
    (globalThis as any).localStorage = priorLocal;
    (globalThis as any).sessionStorage = priorSession;
  }
});
test("lodging save refuses a stale identity without writing", () => {
  const data = new Map<string, string>();
  let writes = 0;
  const storage = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { writes += 1; data.set(key, value); } };
  saveTripSession(createTripSession("hapcheon"), storage as any);
  writes = 0;
  const result = addAccommodationToRegionalItinerary("hapcheon", { providerPlaceId: "1", regionId: "hapcheon", label: "숙소" }, "different-trip", storage as any);
  assert.equal(result.status, "error");
  assert.equal(writes, 0);
});
test("lodging removal deletes only its linked intent while preserving current trip state", () => {
  const storage = memory(), base = createTripSession("hapcheon");
  const lodging = { entityId: "kakao:AD5:1", regionId: "hapcheon", label: "숙소", entityType: "ACCOMMODATION" };
  const otherLodging = { entityId: "kakao:AD5:2", regionId: "hapcheon", label: "다른 숙소", entityType: "ACCOMMODATION" };
  const attraction = { entityId: "kakao:AT4:3", regionId: "hapcheon", label: "관광지", entityType: "TOURIST_ATTRACTION" };
  const current = saveTripSession({ ...base, itinerary: { steps: [{ entityId: "keep-step" }] }, locationContext: { planStart: { status: "CONFIRMED", source: "SELECTED_PLACE", observedAt: "2026-08-29T00:00:00Z" } }, savedPlaces: [lodging, otherLodging, attraction], plannedContext: { accommodationIntents: [{ entityId: lodging.entityId, savedPlaceId: lodging.entityId, label: lodging.label, resolved: true }, { entityId: otherLodging.entityId, savedPlaceId: otherLodging.entityId, label: otherLodging.label, resolved: true }] } }, storage as any);
  removeSavedPlace("hapcheon", lodging.entityId, storage as any);
  const saved = loadTripSession(storage as any, "hapcheon")!;
  assert.equal(saved.anonymousTripId, current.anonymousTripId);
  assert.deepEqual(saved.itinerary, current.itinerary);
  assert.deepEqual(saved.locationContext, current.locationContext);
  assert.deepEqual(saved.savedPlaces?.map((place) => place.entityId), [otherLodging.entityId, attraction.entityId]);
  assert.deepEqual(saved.plannedContext?.accommodationIntents?.map((intent) => intent.savedPlaceId), [otherLodging.entityId]);
  removeSavedPlace("hapcheon", attraction.entityId, storage as any);
  assert.equal(loadTripSession(storage as any, "hapcheon")?.plannedContext?.accommodationIntents?.length, 1);
});
test("legacy sessions without accommodation links restore and delete safely", () => {
  const storage = memory(), session = saveTripSession({ ...createTripSession("hapcheon"), savedPlaces: [{ entityId: "legacy-lodging", entityType: "ACCOMMODATION" }], plannedContext: { accommodationIntents: [{ entityId: "legacy-lodging", label: "옛 숙소", resolved: true }, { label: "연결 없는 옛 의도", resolved: false }] } }, storage as any);
  assert.equal(loadTripSession(storage as any, "hapcheon")?.anonymousTripId, session.anonymousTripId);
  removeSavedPlace("hapcheon", "legacy-lodging", storage as any);
  assert.deepEqual(loadTripSession(storage as any, "hapcheon")?.plannedContext?.accommodationIntents?.map((intent) => intent.label), ["연결 없는 옛 의도"]);
});
test("failed and cross-region writes never emit added analytics", () => {
  const events: string[] = [],
    result = addEntityToRegionalItinerary(
      "gajo",
      videoPark,
      memory() as any,
      ((type: string) => events.push(type)) as any,
    );
  assert.equal(result.status, "error");
  assert.deepEqual(events, []);
});
test("verified actions enable navigation and missing coordinates never fabricate it", () => {
  assert.deepEqual(verifiedNavigation(mountain), {
    name: "황매산 군립공원",
    latitude: 35.495,
    longitude: 127.974,
  });
  assert.equal(verifiedNavigation({ ...mountain, actions: {} }), null);
  assert.equal(
    verifiedNavigation({ ...mountain, actions: { navigate: {} } }),
    null,
  );
});
test("composer order and the next itinerary item remain unchanged", () => {
  const steps = ["합천호", "북어마을", "로우풀", "합천호 스마일펜션"].map(
    (label, index) => ({
      entityId: `https://hapcheon.example/ontology#${index}`,
      label,
      status: "PLANNED",
      order: index + 1,
    }),
  );
  assert.equal(
    currentAndNext(steps, steps[1].entityId).current.label,
    "북어마을",
  );
  assert.equal(currentAndNext(steps, steps[1].entityId).next.label, "로우풀");
  assert.deepEqual(
    steps.map((x) => x.label),
    ["합천호", "북어마을", "로우풀", "합천호 스마일펜션"],
  );
});
test("regional persisted itinerary reopens safely without cross-region leakage", () => {
  const storage = memory(),
    hapcheon = appendItineraryItem(
      createTripSession("hapcheon"),
      mountain,
    ).session;
  saveTripSession(
    executionState(hapcheon, mountain.entityId, "EN_ROUTE"),
    storage as any,
  );
  saveTripSession(createTripSession("gajo"), storage as any);
  assert.equal(
    (loadTripSession(storage as any, "hapcheon")!.itinerary as any).steps[0]
      .regionId,
    "hapcheon",
  );
  assert.equal(loadTripSession(storage as any, "gajo")!.itinerary, undefined);
});
test("persistent continuity strips raw visitor language", () => {
  let serialized = "";
  saveTripSession(
    {
      ...createTripSession("hapcheon"),
      runtimeContext: {
        regionId: "hapcheon",
        rawMessage: "비밀 문장",
        weatherState: "RAIN",
      },
    },
    {
      setItem: (_key: string, value: string) => {
        serialized = value;
      },
    } as any,
  );
  assert.doesNotMatch(serialized, /비밀 문장|rawMessage/);
  assert.match(serialized, /weatherState/);
});
test("shared add UI is wired into EntityActions and Place Discovery", () => {
  const nearby = readFileSync(
      new URL("./pages/NearbyRestaurantsPage.tsx", import.meta.url),
      "utf8",
    ),
    actions = readFileSync(
      new URL("./components/EntityActions.tsx", import.meta.url),
      "utf8",
    ),
    continuation = readFileSync(
      new URL("./components/ItineraryAddContinuation.tsx", import.meta.url),
      "utf8",
    ),
    itinerary = readFileSync(
      new URL("./pages/ItineraryPage.tsx", import.meta.url),
      "utf8",
    ),
    item = readFileSync(
      new URL("./components/RecommendationItineraryItem.tsx", import.meta.url),
      "utf8",
    ),
    css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
  assert.match(actions, /onClick=\{add\}>내 여행에 담기/);
  assert.match(actions, /addEntityToRegionalItinerary/);
  assert.match(nearby, /addEntityToRegionalItinerary/);
  for (const copy of [
    "내 여행에 담았습니다",
    "이미 내 여행에 담겨 있습니다",
    "내 여행에 담지 못했습니다",
    "내 여행 전체 보기",
    "계속 장소 찾기",
  ])
    assert.match(continuation, new RegExp(copy));
  assert.match(itinerary, /tripSession\.itinerary/);
  assert.match(
    item,
    /anchor:\s*\{[\s\S]*entityId,[\s\S]*label:\s*name,[\s\S]*latitude:\s*destination\.latitude,[\s\S]*longitude:\s*destination\.longitude/,
  );
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*entity-add-secondary/);
});
