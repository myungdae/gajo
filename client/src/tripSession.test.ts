import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveAndStartNewTrip,
  confirmTripLocation,
  createTripSession,
  currentTravelContext,
  loadTripSession,
  mergeTravelContext,
  preserveTripForEssentialDetour,
  resolveMustVisit,
  saveTripSession,
  sessionContext,
  updateTripRuntimeContext,
  isFreshTripLocation,
} from "./tripSession.ts";

const locationStorage=()=>{const data=new Map<string,string>();return{getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>data.set(key,value)}};

test("NOW location freshness expires without requesting permission again",()=>{const now=Date.parse("2026-08-28T09:00:00.000Z"),location:any={status:"CONFIRMED",source:"GPS",observedAt:new Date(now).toISOString(),confirmedAt:new Date(now).toISOString()};assert.equal(isFreshTripLocation(location,now+29*60*1000),true);assert.equal(isFreshTripLocation(location,now+31*60*1000),false)});

const withBrowserStorage = (local:any,session:any,run:()=>void) => { const priorLocal=(globalThis as any).localStorage,priorSession=(globalThis as any).sessionStorage;try{(globalThis as any).localStorage=local;(globalThis as any).sessionStorage=session;run()}finally{(globalThis as any).localStorage=priorLocal;(globalThis as any).sessionStorage=priorSession} };
const storageCandidate=(marker:string,updatedAt?:string)=>JSON.stringify({...createTripSession("hapcheon",new Date("2026-08-29T00:00:00Z")),updatedAt,runtimeContext:{regionId:"hapcheon",marker}});
const readStorage=(value:string|null,throws=false)=>({getItem:()=>{if(throws)throw new Error("read failed");return value},setItem:()=>{},removeItem:()=>{}});

test("storage reads and JSON parsing fail independently",()=>{
  const goodLocal=storageCandidate("local","2026-08-29T01:00:00Z"),goodSession=storageCandidate("session","2026-08-29T02:00:00Z");
  const cases:[any,any,string|undefined][]=[
    [readStorage(null,true),readStorage(goodSession),"session"],
    [readStorage(goodLocal),readStorage(null,true),"local"],
    [readStorage("{broken"),readStorage(goodSession),"session"],
    [readStorage(goodLocal),readStorage("{broken"),"local"],
    [readStorage(null,true),readStorage(null,true),undefined],
    [readStorage("{bad"),readStorage("{bad"),undefined],
  ];
  for(const[local,session,expected]of cases)withBrowserStorage(local,session,()=>assert.equal(loadTripSession(local,"hapcheon")?.runtimeContext?.marker,expected));
});

test("storage candidate selection follows explicit timestamp and legacy tie policy",()=>{
  const identical=storageCandidate("same","2026-08-29T02:00:00Z");
  const scenarios:[string|null,string|null,string][]=[
    [storageCandidate("local","2026-08-29T03:00:00Z"),storageCandidate("session","2026-08-29T02:00:00Z"),"local"],
    [storageCandidate("local","2026-08-29T01:00:00Z"),storageCandidate("session","2026-08-29T02:00:00Z"),"session"],
    [storageCandidate("local","2026-08-29T01:00:00Z"),storageCandidate("session"),"local"],
    [storageCandidate("local","invalid"),storageCandidate("session","2026-08-29T02:00:00Z"),"session"],
    [identical,identical,"same"],
    [storageCandidate("local","2026-08-29T02:00:00Z"),storageCandidate("session","2026-08-29T02:00:00Z"),"session"],
    [storageCandidate("local"),storageCandidate("session"),"local"],
    [storageCandidate("local","bad"),storageCandidate("session","also-bad"),"local"],
    [null,storageCandidate("session"),"session"],
  ];
  for(const[localValue,sessionValue,expected]of scenarios){const local=readStorage(localValue),session=readStorage(sessionValue);withBrowserStorage(local,session,()=>assert.equal(loadTripSession(local,"hapcheon")?.runtimeContext?.marker,expected))}
});

test("successful local save supersedes and best-effort removes only its own fallback",()=>{
  const key="regional-concierge-trip-session-v1:hapcheon",base=createTripSession("hapcheon",new Date("2026-08-29T00:00:00Z")),localData=new Map([[key,JSON.stringify(base)]]),sessionData=new Map<string,string>();let localFails=true,removals=0;
  const local={getItem:(name:string)=>localData.get(name)||null,setItem:(name:string,value:string)=>{if(localFails)throw new Error("local write failed");localData.set(name,value)},removeItem:()=>{}};
  const session={getItem:(name:string)=>sessionData.get(name)||null,setItem:(name:string,value:string)=>void sessionData.set(name,value),removeItem:(name:string)=>{removals++;sessionData.delete(name)}};
  withBrowserStorage(local,session,()=>{
    const fallbackSaved=saveTripSession({...base,runtimeContext:{regionId:"hapcheon",marker:"fallback"}},local as any);
    assert.equal(loadTripSession(local as any,"hapcheon")?.runtimeContext?.marker,"fallback");
    localFails=false;
    const localSaved=saveTripSession({...fallbackSaved,runtimeContext:{regionId:"hapcheon",marker:"local"}},local as any);
    assert.ok(Date.parse(localSaved.updatedAt)>Date.parse(fallbackSaved.updatedAt));
    assert.equal(loadTripSession(local as any,"hapcheon")?.runtimeContext?.marker,"local");
    assert.equal(sessionData.has(key),false);assert.equal(removals,1);
    sessionData.set(key,storageCandidate("other-trip","2026-08-29T09:00:00Z"));
    const other=JSON.parse(sessionData.get(key)!);other.id="other";other.anonymousTripId="other";sessionData.set(key,JSON.stringify(other));
    saveTripSession(localSaved,local as any);
    assert.equal(sessionData.has(key),true);
    sessionData.set(key,JSON.stringify({...localSaved,updatedAt:"2026-08-29T00:00:00Z"}));
    session.removeItem=()=>{throw new Error("cleanup failed")};
    assert.doesNotThrow(()=>saveTripSession(localSaved,local as any));
    assert.equal(sessionData.has(key),true);
  });
});

test("PLAN start and NOW current locations remain separate without replacing trip identity",()=>{const storage=locationStorage(),session=saveTripSession(createTripSession("hapcheon"),storage as any),plan=confirmTripLocation("hapcheon","PLAN",{status:"RESOLVED",source:"SELECTED_PLACE",latitude:35.53,longitude:128.03,label:"합천호",observedAt:"2026-08-28T00:00:00Z"},storage as any)!,now=confirmTripLocation("hapcheon","NOW",{status:"RESOLVED",source:"GPS",latitude:35.56,longitude:128.16,label:"합천군 합천읍",accuracy:20,observedAt:"2026-08-28T01:00:00Z"},storage as any)!;assert.equal(now.anonymousTripId,session.anonymousTripId);assert.equal(now.locationContext?.planStart?.label,"합천호");assert.equal(now.locationContext?.now?.label,"합천군 합천읍");assert.equal(plan.locationContext?.now,undefined)});
test("moving sharply away from the next stop preserves the itinerary and creates one replan proposal",()=>{const storage=locationStorage(),session=saveTripSession({...createTripSession("hapcheon"),itinerary:{steps:[{entityId:"keep",latitude:35.53,longitude:128.02}]},locationContext:{now:{status:"CONFIRMED",source:"GPS",latitude:35.52,longitude:128.01,label:"대병면",observedAt:"2026-08-28T00:00:00Z"}}},storage as any),moved=confirmTripLocation("hapcheon","NOW",{status:"RESOLVED",source:"MANUAL",latitude:35.56,longitude:128.16,label:"합천읍",observedAt:"2026-08-28T02:00:00Z"},storage as any)!;assert.equal(moved.anonymousTripId,session.anonymousTripId);assert.deepEqual(moved.itinerary,session.itinerary);assert.equal(moved.locationContext?.pendingReplan?.itineraryPreserved,true)});
test("a location change alone does not create a replan proposal",()=>{const storage=locationStorage();saveTripSession({...createTripSession("hapcheon"),itinerary:{steps:[{entityId:"keep"}]},locationContext:{now:{status:"CONFIRMED",source:"GPS",latitude:35.52,longitude:128.01,observedAt:"2026-08-28T00:00:00Z"}}},storage as any);const moved=confirmTripLocation("hapcheon","NOW",{status:"RESOLVED",source:"GPS",latitude:35.56,longitude:128.16,observedAt:"2026-08-28T02:00:00Z"},storage as any)!;assert.equal(moved.locationContext?.pendingReplan,undefined)});

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
