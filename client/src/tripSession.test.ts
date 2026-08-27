import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveAndStartNewTrip,
  createTripSession,
  currentTravelContext,
  loadTripSession,
  mergeTravelContext,
  preserveTripForEssentialDetour,
  resolveMustVisit,
  saveTripSession,
  sessionContext,
  updateTripRuntimeContext,
} from "./tripSession.ts";

test("an essential-service detour preserves journey identity and content", () => {
  const session = {
    ...createTripSession("okcheon", new Date("2026-08-24T07:00:00Z")),
    itinerary: { steps: [{ entityId: "destination" }] },
    savedPlaces: [{ entityId: "saved" }],
    execution: { currentEntityId: "destination", statusByEntityId: { destination: "EN_ROUTE" as const } },
  };
  const detour = preserveTripForEssentialDetour(session, { category: "PUBLIC_TOILET", entityId: "toilet" });
  assert.equal(detour.anonymousTripId, session.anonymousTripId);
  assert.equal(detour.regionId, "okcheon");
  assert.deepEqual(detour.itinerary, session.itinerary);
  assert.deepEqual(detour.savedPlaces, session.savedPlaces);
  assert.deepEqual(detour.execution, session.execution);
  assert.deepEqual(detour.runtimeContext.essentialServiceDetour, { category: "PUBLIC_TOILET", entityId: "toilet" });
});
test("a heat-shelter detour preserves itinerary execution identity and region",()=>{const session={...createTripSession("gajo"),itinerary:{steps:[{entityId:"suseungdae"},{entityId:"changpowon"}]},execution:{currentEntityId:"suseungdae",statusByEntityId:{suseungdae:"COMPLETED" as const}},plannedContext:{mustVisitPlaces:[{entityId:"changpowon"}]}};const detour=preserveTripForEssentialDetour(session,{category:"HEAT_SHELTER"});assert.equal(detour.anonymousTripId,session.anonymousTripId);assert.equal(detour.regionId,"gajo");assert.deepEqual(detour.itinerary,session.itinerary);assert.deepEqual(detour.execution,session.execution);assert.deepEqual(detour.plannedContext,session.plannedContext)});
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
test("creates and resumes a no-login trip session", () => {
  const storage = memory();
  const created = saveTripSession(
    createTripSession("gajo", new Date("2026-01-01")),
    storage as any,
  );
  assert.equal(loadTripSession(storage as any,"gajo")?.id, created.id);
  assert.equal((created as any).email, undefined);
});
test("PLAN context carries into NOW and explicit updates win", () => {
  const plan = createTripSession("gajo");
  plan.mode = "PLAN";
  plan.plannedContext = { transportMode: "CAR", interests: ["INDOOR"] };
  const now = mergeTravelContext(sessionContext(plan), {
    transportMode: "WALK",
  });
  assert.equal(now.transportMode, "WALK");
  assert.deepEqual(now.activityPreferences, ["INDOOR"]);
});
test("AI context shares current, next, completed, skipped, and stable trip identity", () => {
  const trip = {
    ...createTripSession("hapcheon"),
    itinerary: { steps: [{ entityId: "done" }, { entityId: "current" }, { entityId: "next" }] },
    savedPlaces: [{ entityId: "saved" }],
    execution: { currentEntityId: "current", statusByEntityId: { done: "COMPLETED" as const, current: "EN_ROUTE" as const } },
  };
  assert.deepEqual(sessionContext(trip).tripContext, {
    anonymousTripId: trip.anonymousTripId,
    currentEntityId: "current",
    nextEntityId: "next",
    completedEntityIds: ["done"],
    skippedEntityIds: [],
    savedEntityIds: ["saved"],
    itineraryEntityIds: ["done", "current", "next"],
    excludedEntityIds: ["done"],
  });
  assert.equal(JSON.stringify(sessionContext(trip)).includes("savedPlaces"), false);
  assert.equal(JSON.stringify(sessionContext(trip)).includes("runtimeContext"), false);
});
test("unknown date and duration remain valid planned context", () => {
  const plan = createTripSession("gajo");
  plan.mode = "PLAN";
  plan.plannedContext = { duration: "1N2D" };
  assert.equal(plan.plannedContext.startDate, undefined);
  assert.equal(plan.plannedContext.duration, "1N2D");
});
test("must-visit resolves canonical entities and never fabricates unknown ids", () => {
  const suggestions = [
    { id: "region:spa", label: "지역온천", aliases: ["온천"] },
  ];
  assert.deepEqual(resolveMustVisit("온천", suggestions), {
    label: "지역온천",
    entityId: "region:spa",
    regionId: "gajo",
    resolved: true,
  });
  assert.deepEqual(resolveMustVisit("내가 아는 장소", suggestions), {
    label: "내가 아는 장소",
    resolved: false,
  });
});
test("verified runtime beats stale plan while explicit input wins last", () => {
  const value = currentTravelContext(
    { weather: "clearWeather", transportMode: "CAR" },
    { weather: "rainyWeather" },
    { transportMode: "WALK" },
  );
  assert.equal(value.weather, "rainyWeather");
  assert.equal(value.transportMode, "WALK");
});
test("PLAN persists multiple canonical interests together", () => {
  const plan = createTripSession("gajo");
  plan.plannedContext = { interests: ["HOT_SPRING", "FOOD", "CAFE", "NATURE"] };
  assert.deepEqual(sessionContext(plan).activityPreferences, [
    "HOT_SPRING",
    "FOOD",
    "CAFE",
    "NATURE",
  ]);
});
test("PLAN propagates a resolved canonical must-visit anchor to the request", () => {
  const plan = createTripSession("okcheon");
  plan.plannedContext = {
    mustVisitPlaces: [
      {
        entityId: "https://okcheon.example/ontology#jeongJiyongBirthplace",
        label: "정지용 생가",
        resolved: true,
      },
    ],
  };
  assert.deepEqual(sessionContext(plan).mustVisitPlaces, [
    {
      entityId: "https://okcheon.example/ontology#jeongJiyongBirthplace",
      label: "정지용 생가",
      resolved: true,
    },
  ]);
});
test("Gajo and Okcheon sessions remain isolated", () => {
  const storage = memory();
  const gajo = saveTripSession(createTripSession("gajo"), storage as any);
  const okcheon = saveTripSession(createTripSession("okcheon"), storage as any);
  assert.equal(loadTripSession(storage as any, "gajo")?.id, gajo.id);
  assert.equal(loadTripSession(storage as any, "okcheon")?.id, okcheon.id);
  assert.notEqual(gajo.id, okcheon.id);
});
test("Gajo same-region movement changes current location without changing trip identity or saved state", () => {
  const storage = memory(),
    initial = saveTripSession(
      {
        ...createTripSession("gajo"),
        itinerary: { steps: [{ entityId: "gajo-place" }] },
        savedPlaces: [{ entityId: "saved-gajo-place" }],
        execution: {
          currentEntityId: "gajo-place",
          statusByEntityId: { "gajo-place": "EN_ROUTE" },
        },
        runtimeContext: {
          regionId: "gajo",
          latitude: 35.698758,
          longitude: 128.023103,
        },
      },
      storage as any,
    ),
    moved = updateTripRuntimeContext(
      "gajo",
      { regionId: "gajo", latitude: 35.73662049, longitude: 128.0408983 },
      storage as any,
    )!;
  assert.equal(moved.anonymousTripId, initial.anonymousTripId);
  assert.deepEqual(moved.itinerary, initial.itinerary);
  assert.deepEqual(moved.savedPlaces, initial.savedPlaces);
  assert.deepEqual(moved.execution, initial.execution);
  assert.equal(moved.runtimeContext.latitude, 35.73662049);
});
test("Muan session and canonical must-visit remain isolated", () => {
  const storage = memory();
  const gajo = saveTripSession(createTripSession("gajo"), storage as any);
  const okcheon = saveTripSession(createTripSession("okcheon"), storage as any);
  const muan = saveTripSession(createTripSession("muan"), storage as any);
  assert.equal(loadTripSession(storage as any, "muan")?.id, muan.id);
  assert.notEqual(muan.id, gajo.id);
  assert.notEqual(muan.id, okcheon.id);
  assert.deepEqual(
    resolveMustVisit("회산백련지", [
      {
        id: "https://muan.example/ontology#hoesanWhiteLotusPond",
        label: "회산백련지",
      },
    ]),
    {
      label: "회산백련지",
      entityId: "https://muan.example/ontology#hoesanWhiteLotusPond",
      regionId: "muan",
      resolved: true,
    },
  );
});
test("Gyeryong session and event anchor remain isolated from all existing regions", () => {
  const storage = memory(),
    sessions = ["gajo", "okcheon", "muan", "gyeryong"].map((region) =>
      saveTripSession(createTripSession(region as any), storage as any),
    );
  assert.equal(new Set(sessions.map((x) => x.id)).size, 4);
  assert.equal(
    loadTripSession(storage as any, "gyeryong")?.regionId,
    "gyeryong",
  );
  assert.deepEqual(
    resolveMustVisit("군문화축제", [
      {
        id: "https://gyeryong.example/ontology#militaryCultureFestival",
        label: "계룡 군문화축제",
        aliases: ["군문화축제"],
      },
    ]),
    {
      label: "계룡 군문화축제",
      entityId: "https://gyeryong.example/ontology#militaryCultureFestival",
      regionId: "gyeryong",
      resolved: true,
    },
  );
});
test("Hapcheon session preserves lake and pension anchors without leaking across five regions", () => {
  const storage = memory(),
    sessions = ["gajo", "okcheon", "muan", "gyeryong", "hapcheon"].map(
      (region) =>
        saveTripSession(createTripSession(region as any), storage as any),
    );
  assert.equal(new Set(sessions.map((x) => x.id)).size, 5);
  assert.equal(
    loadTripSession(storage as any, "hapcheon")?.regionId,
    "hapcheon",
  );
  const suggestions = [
    { id: "https://hapcheon.example/ontology#hapcheonLake", label: "합천호" },
    {
      id: "https://hapcheon.example/ontology#hapcheonLakeSmilePension",
      label: "합천호 스마일펜션",
      aliases: ["스마일펜션"],
    },
  ];
  assert.deepEqual(resolveMustVisit("스마일펜션", suggestions), {
    label: "합천호 스마일펜션",
    entityId: "https://hapcheon.example/ontology#hapcheonLakeSmilePension",
    regionId: "hapcheon",
    resolved: true,
  });
});
test("Hapcheon NOW continuity carries its explicit accommodation intent", () => {
  const plan = createTripSession("hapcheon");
  plan.mode = "PLAN";
  plan.plannedContext = {
    interests: ["HAPCHEON_LAKE", "ACCOMMODATION"],
    accommodationIntents: [
      {
        entityId: "https://hapcheon.example/ontology#hapcheonLakeSmilePension",
        label: "합천호 스마일펜션",
        regionId: "hapcheon",
        resolved: true,
      },
    ],
  };
  assert.equal(
    sessionContext(plan).accommodationIntents?.[0].label,
    "합천호 스마일펜션",
  );
  assert.equal(
    sessionContext(createTripSession("gajo")).accommodationIntents,
    undefined,
  );
});
test("loading a session defensively removes mismatched runtime weather", () => {
  const storage = memory();
  storage.setItem(
    "regional-concierge-trip-session-v1:hapcheon",
    JSON.stringify({
      ...createTripSession("hapcheon"),
      runtimeContext: {
        regionId: "gajo",
        temperature: 23,
        weatherState: "CLOUDY",
      },
    }),
  );
  const loaded = loadTripSession(storage as any, "hapcheon");
  assert.equal(loaded?.regionId, "hapcheon");
  assert.equal(loaded?.runtimeContext, undefined);
});
test("Daejeon Jung-gu session and canonical urban anchor are isolated across six regions", () => {
  const storage = memory(),
    sessions = [
      "gajo",
      "okcheon",
      "muan",
      "gyeryong",
      "hapcheon",
      "daejeon-junggu",
    ].map((region) =>
      saveTripSession(createTripSession(region), storage as any),
    );
  assert.equal(new Set(sessions.map((x) => x.id)).size, 6);
  assert.equal(
    loadTripSession(storage as any, "daejeon-junggu")?.regionId,
    "daejeon-junggu",
  );
  assert.deepEqual(
    resolveMustVisit("은행동·중앙로 권역", [
      {
        id: "https://daejeon-junggu.example/ontology#eunhaengJungangroCulturalArea",
        label: "은행동·중앙로 문화권",
        aliases: ["은행동·중앙로 권역"],
      },
    ]),
    {
      label: "은행동·중앙로 문화권",
      entityId:
        "https://daejeon-junggu.example/ontology#eunhaengJungangroCulturalArea",
      regionId: "daejeon-junggu",
      resolved: true,
    },
  );
});
test("anonymous identity is random and a new trip archives the old regional trip", () => {
  const storage = memory(),
    old = saveTripSession(
      {
        ...createTripSession("hapcheon"),
        itinerary: { steps: [{ entityId: "verified-place" }] },
      },
      storage as any,
    ),
    next = archiveAndStartNewTrip("hapcheon", storage as any);
  assert.notEqual(next.anonymousTripId, old.anonymousTripId);
  assert.match(next.anonymousTripId, /^[0-9a-f-]{36}$/);
  assert.ok(
    storage.getItem(
      `regional-concierge-trip-archive-v1:hapcheon:${old.anonymousTripId}`,
    ),
  );
  assert.equal(loadTripSession(storage as any, "gajo"), undefined);
});
test("CROSS_REGION_NON_INTERFERENCE archives only Okcheon while Gajo and Hapcheon trips stay byte-for-byte unchanged", () => {
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
    okcheon = saveTripSession(
      {
        ...createTripSession("okcheon"),
        savedPlaces: [
          {
            entityId:
              "https://okcheon.example/ontology#dunjubongKoreanPeninsula",
          },
        ],
      },
      storage as any,
    ),
    gajoBefore = JSON.stringify(loadTripSession(storage as any, "gajo")),
    hapcheonBefore = JSON.stringify(
      loadTripSession(storage as any, "hapcheon"),
    );
  archiveAndStartNewTrip("okcheon", storage as any);
  assert.equal(
    JSON.stringify(loadTripSession(storage as any, "gajo")),
    gajoBefore,
  );
  assert.equal(
    JSON.stringify(loadTripSession(storage as any, "hapcheon")),
    hapcheonBefore,
  );
  assert.ok(
    storage.getItem(
      `regional-concierge-trip-archive-v1:okcheon:${okcheon.anonymousTripId}`,
    ),
  );
  assert.equal(
    loadTripSession(storage as any, "gajo")?.anonymousTripId,
    gajo.anonymousTripId,
  );
  assert.equal(
    loadTripSession(storage as any, "hapcheon")?.anonymousTripId,
    hapcheon.anonymousTripId,
  );
});
