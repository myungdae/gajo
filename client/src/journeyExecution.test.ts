import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addEntityToRegionalItinerary,
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
  assert.match(actions, /onClick=\{add\}>일정에 담기/);
  assert.match(actions, /addEntityToRegionalItinerary/);
  assert.match(nearby, /addEntityToRegionalItinerary/);
  for (const copy of [
    "내 여행에 담아두었습니다",
    "이미 내 여행에 담겨 있습니다",
    "일정에 담지 못했습니다",
    "내 여행 보기",
    "다른 곳 더 찾기",
  ])
    assert.match(continuation, new RegExp(copy));
  assert.match(itinerary, /tripSession\.itinerary/);
  assert.match(
    item,
    /anchor:\s*\{[\s\S]*entityId,[\s\S]*label:\s*name,[\s\S]*latitude:\s*destination\.latitude,[\s\S]*longitude:\s*destination\.longitude/,
  );
  assert.match(css, /@media\(max-width:430px\).*entity-add-secondary/);
});
