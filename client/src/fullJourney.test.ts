import test from "node:test";
import assert from "node:assert/strict";
import {
  addEntityToRegionalItinerary,
  currentAndNext,
  itinerarySteps,
  savedPlaceItems,
  verifiedNavigation,
} from "./journeyExecution.ts";
import {
  journeyDayCounts,
  sameJourney,
  saveFullJourney,
} from "./fullJourney.ts";
import {
  createTripSession,
  loadTripSession,
  saveTripSession,
} from "./tripSession.ts";
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}
const steps = [
  {
    entityId: "https://hapcheon.example/ontology#hapcheonLake",
    programUri: "https://hapcheon.example/ontology#hapcheonLake",
    programLabel: "합천호",
    regionId: "hapcheon",
    dayIndex: 1,
    order: 1,
    status: "PLANNED",
    actions: { navigate: { latitude: 35.5305, longitude: 128.0324 } },
  },
  {
    entityId: "https://hapcheon.example/ontology#bukEoVillage",
    programUri: "https://hapcheon.example/ontology#bukEoVillage",
    programLabel: "북어마을",
    regionId: "hapcheon",
    dayIndex: 1,
    order: 2,
    status: "PLANNED",
  },
  {
    entityId: "urn:regional:hapcheon:lowful",
    programUri: "urn:regional:hapcheon:lowful",
    programLabel: "로우풀",
    regionId: "hapcheon",
    dayIndex: 2,
    order: 3,
    status: "PLANNED",
  },
  {
    entityId: "https://hapcheon.example/ontology#hapcheonLakeSmilePension",
    programUri: "https://hapcheon.example/ontology#hapcheonLakeSmilePension",
    programLabel: "합천호 스마일펜션",
    regionId: "hapcheon",
    dayIndex: 2,
    order: 4,
    status: "PLANNED",
  },
];
test("one action preserves production-like Hapcheon order and day groups across reopen", () => {
  const storage = memory(),
    session = saveTripSession(createTripSession("hapcheon"), storage as any),
    result = saveFullJourney(
      "hapcheon",
      { itineraryNo: "IT-HAPCHEON", steps },
      storage as any,
    ),
    reopened = loadTripSession(storage as any, "hapcheon")!;
  assert.equal(result.status, "saved");
  assert.equal(reopened.anonymousTripId, session.anonymousTripId);
  assert.deepEqual(
    itinerarySteps(reopened.itinerary).map((x) => x.programLabel),
    ["합천호", "북어마을", "로우풀", "합천호 스마일펜션"],
  );
  assert.deepEqual(journeyDayCounts(reopened.itinerary), [2, 2]);
  assert.equal(
    currentAndNext(itinerarySteps(reopened.itinerary)).next.programLabel,
    "북어마을",
  );
  assert.equal(
    verifiedNavigation(itinerarySteps(reopened.itinerary)[0])?.name,
    "합천호",
  );
});
test("re-save is identical, an extra single item coexists, and update keeps the trip identity", () => {
  const storage = memory(),
    session = saveTripSession(createTripSession("hapcheon"), storage as any);
  assert.equal(
    saveFullJourney("hapcheon", { itineraryNo: "IT-1", steps }, storage as any)
      .status,
    "saved",
  );
  assert.equal(
    saveFullJourney("hapcheon", { itineraryNo: "IT-1", steps }, storage as any)
      .status,
    "identical",
  );
  assert.equal(
    addEntityToRegionalItinerary(
      "hapcheon",
      {
        entityId: "https://hapcheon.example/ontology#haeinsa",
        programLabel: "해인사",
        regionId: "hapcheon",
      },
      storage as any,
    ).status,
    "added",
  );
  const coexist = loadTripSession(storage as any, "hapcheon")!;
  assert.equal(itinerarySteps(coexist.itinerary).length, 4);
  assert.deepEqual(
    savedPlaceItems(coexist).map((x) => x.programLabel),
    ["해인사"],
  );
  const changed = {
    itineraryNo: "IT-2",
    steps: [
      ...steps,
      {
        entityId: "https://hapcheon.example/ontology#haeinsa",
        programLabel: "해인사",
        regionId: "hapcheon",
        dayIndex: 2,
        order: 5,
      },
    ],
  };
  assert.equal(
    saveFullJourney("hapcheon", changed, storage as any).status,
    "different",
  );
  assert.equal(
    saveFullJourney("hapcheon", changed, storage as any, true).status,
    "saved",
  );
  assert.equal(
    loadTripSession(storage as any, "hapcheon")!.anonymousTripId,
    session.anonymousTripId,
  );
});
test("whole journeys are region isolated and structural equality includes days and order", () => {
  const storage = memory();
  saveTripSession(createTripSession("hapcheon"), storage as any);
  assert.equal(
    saveFullJourney("hapcheon", { steps }, storage as any).status,
    "saved",
  );
  assert.equal(loadTripSession(storage as any, "gajo"), undefined);
  assert.equal(
    sameJourney(
      { steps },
      {
        steps: steps.map((x) => ({ ...x, dayIndex: x.dayIndex === 1 ? 2 : 1 })),
      },
    ),
    false,
  );
  assert.equal(
    saveFullJourney("gajo", { steps }, storage as any).status,
    "error",
  );
});
test("Okcheon My Trip survives save reload and update while other regional journeys stay unchanged", () => {
  const storage = memory(),
    gajo = saveTripSession(
      {
        ...createTripSession("gajo"),
        savedPlaces: [{ entityId: "gajo:saved" }],
      },
      storage as any,
    ),
    hapcheon = saveTripSession(
      {
        ...createTripSession("hapcheon"),
        savedPlaces: [{ entityId: "hapcheon:saved" }],
      },
      storage as any,
    ),
    okcheon = saveTripSession(createTripSession("okcheon"), storage as any),
    okcheonSteps = [
      {
        entityId: "https://okcheon.example/ontology#dunjubongKoreanPeninsula",
        programUri: "https://okcheon.example/ontology#dunjubongKoreanPeninsula",
        programLabel: "둔주봉 한반도지형",
        regionId: "okcheon",
        dayIndex: 1,
        order: 1,
        status: "PLANNED",
        actions: {
          navigate: { latitude: 36.35619308, longitude: 127.6727267 },
        },
      },
      {
        entityId: "https://okcheon.example/ontology#busodamak",
        programUri: "https://okcheon.example/ontology#busodamak",
        programLabel: "부소담악",
        regionId: "okcheon",
        dayIndex: 1,
        order: 2,
        status: "PLANNED",
      },
    ];
  assert.equal(
    saveFullJourney(
      "okcheon",
      { itineraryNo: "IT-OKCHEON", steps: okcheonSteps },
      storage as any,
    ).status,
    "saved",
  );
  const reopened = loadTripSession(storage as any, "okcheon")!;
  assert.equal(reopened.anonymousTripId, okcheon.anonymousTripId);
  assert.equal(
    itinerarySteps(reopened.itinerary)[0].programLabel,
    "둔주봉 한반도지형",
  );
  assert.equal(
    verifiedNavigation(itinerarySteps(reopened.itinerary)[0])?.name,
    "둔주봉 한반도지형",
  );
  assert.equal(verifiedNavigation(itinerarySteps(reopened.itinerary)[1]), null);
  assert.equal(
    loadTripSession(storage as any, "gajo")?.anonymousTripId,
    gajo.anonymousTripId,
  );
  assert.equal(
    loadTripSession(storage as any, "hapcheon")?.anonymousTripId,
    hapcheon.anonymousTripId,
  );
});
