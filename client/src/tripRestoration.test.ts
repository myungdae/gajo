import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { archiveAndStartNewTrip, createTripSession, ensureTripSession, loadTripSession, saveTripSession, tripRestorationDiagnostics, updateTripRuntimeContext } from "./tripSession.ts";
import { regionFromLocation } from "./regionRouting.ts";
import { itineraryItemCount } from "./tripContinuity.ts";

function memory() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), key: (index: number) => [...values.keys()][index] || null };
}
const goldenTrip = () => ({
  ...createTripSession("hapcheon"),
  itinerary: { savedAsFullJourney: true, journeyId: "hapcheon-golden", steps: [{ entityId: "day-1", dayIndex: 1 }, { entityId: "day-2", dayIndex: 2 }] },
  savedPlaces: [{ entityId: "X" }, { entityId: "Y" }, { entityId: "Z" }],
  execution: { currentEntityId: "day-1", statusByEntityId: { "day-1": "EN_ROUTE" as const } },
  runtimeContext: { regionId: "hapcheon", locality: "대병면", latitude: 35.52, longitude: 128.03 },
});

test("reload and PWA reopen restore the active Hapcheon trip identity and all travel memory", () => {
  const storage = memory(), original = saveTripSession(goldenTrip(), storage as any);
  for (const restored of [loadTripSession(storage as any, "hapcheon")!, loadTripSession(storage as any, "hapcheon")!]) {
    assert.equal(restored.anonymousTripId, original.anonymousTripId);
    assert.deepEqual(restored.itinerary, original.itinerary);
    assert.deepEqual(restored.savedPlaces, original.savedPlaces);
    assert.deepEqual(restored.execution, original.execution);
  }
  assert.equal(tripRestorationDiagnostics("hapcheon", storage as any).uiState, "CONTINUE");
});

test("previous known-good Hapcheon serialization loads without rewrite or a new identity",()=>{
  const storage=memory(),legacyKey='regional-concierge-trip-session-v1:hapcheon',legacy=JSON.stringify({id:'legacy-hapcheon-trip',regionId:'hapcheon',mode:'NOW',itinerary:{savedAsFullJourney:true,journeyId:'legacy-journey',steps:[{entityId:'legacy-a',status:'READY'},{entityId:'legacy-b',status:'PLANNED'}]},savedPlaces:[{entityId:'legacy-saved'}],execution:{currentEntityId:'legacy-a',statusByEntityId:{'legacy-a':'READY'}},createdAt:'2026-07-01T00:00:00.000Z',updatedAt:'2026-07-02T00:00:00.000Z'});storage.setItem(legacyKey,legacy);const restored=loadTripSession(storage as any,'hapcheon')!;assert.equal(restored.anonymousTripId,'legacy-hapcheon-trip');assert.equal((restored.itinerary as any).steps.length,2);assert.deepEqual(restored.savedPlaces,[{entityId:'legacy-saved'}]);assert.equal(restored.execution?.currentEntityId,'legacy-a');assert.equal(storage.getItem(legacyKey),legacy);const diagnostics=tripRestorationDiagnostics('hapcheon',storage as any);assert.equal(diagnostics.anonymousTripIdPresent,true);assert.equal(diagnostics.executionStatePresent,true);assert.doesNotMatch(JSON.stringify(diagnostics),/legacy-hapcheon-trip/)});

test("Daebyeong to Hapcheon-eup changes runtime location without replacing the trip", () => {
  const storage = memory(), original = saveTripSession(goldenTrip(), storage as any);
  const moved = updateTripRuntimeContext("hapcheon", { regionId: "hapcheon", locality: "합천읍", latitude: 35.566, longitude: 128.165 }, storage as any)!;
  assert.equal(moved.anonymousTripId, original.anonymousTripId);
  assert.equal(moved.runtimeContext.locality, "합천읍");
  assert.deepEqual(moved.itinerary, original.itinerary);
  assert.deepEqual(moved.savedPlaces, original.savedPlaces);
  assert.deepEqual(moved.execution, original.execution);
});

test("legacy Hapcheon PWA root update restores the existing regional key in place",()=>{
  const storage=memory(),storageKey='regional-concierge-trip-session-v1:hapcheon',serialized=JSON.stringify({id:'pre-hardening-hapcheon',regionId:'hapcheon',mode:'NOW',plannedContext:{mustVisitPlaces:[{label:'합천호',entityId:'https://hapcheon.example/ontology#hapcheonLake',resolved:true}]},itinerary:{savedAsFullJourney:true,journeyId:'field-hapcheon',steps:[{entityId:'https://hapcheon.example/ontology#hapcheonLake',programLabel:'합천호',actions:{navigate:{latitude:35.54,longitude:128.02}},status:'READY'}]},savedPlaces:[{entityId:'https://hapcheon.example/ontology#hapcheonLakeSmilePension',programLabel:'합천호 스마일펜션'}],execution:{currentEntityId:'https://hapcheon.example/ontology#hapcheonLake',statusByEntityId:{'https://hapcheon.example/ontology#hapcheonLake':'READY'}},createdAt:'2026-07-01T00:00:00.000Z',updatedAt:'2026-07-02T00:00:00.000Z'});storage.setItem(storageKey,serialized);
  const regionId=regionFromLocation('/','','hapcheon.odex.kr'),restored=loadTripSession(storage as any,regionId)!;
  assert.equal(regionId,'hapcheon');
  assert.equal(restored.anonymousTripId,'pre-hardening-hapcheon');
  assert.equal(itineraryItemCount(restored),2);
  assert.equal((restored.itinerary as any).steps[0].actions.navigate.latitude,35.54);
  assert.deepEqual(restored.savedPlaces,[{entityId:'https://hapcheon.example/ontology#hapcheonLakeSmilePension',programLabel:'합천호 스마일펜션'}]);
  assert.equal(restored.execution?.currentEntityId,'https://hapcheon.example/ontology#hapcheonLake');
  assert.equal(storage.getItem(storageKey),serialized);
  assert.equal(storage.getItem('regional-concierge-trip-session-v1:gajo'),null);
});

test("exact gajo.odex.kr/hapcheon update restores bytes without an empty-session overwrite",()=>{const storage=memory(),key='regional-concierge-trip-session-v1:hapcheon',serialized=JSON.stringify({id:'same-url-hapcheon',regionId:'hapcheon',mode:'NOW',itinerary:{savedAsFullJourney:true,steps:[{uri:'https://hapcheon.example/ontology#old-lake',name:'이전 합천호',actions:{navigate:{latitude:35.5,longitude:128.1}}}]},savedPlaces:[{canonicalEntityUri:'https://hapcheon.example/ontology#old-pension',name:'이전 펜션'}],execution:{currentEntityId:'https://hapcheon.example/ontology#old-lake'},createdAt:'2026-06-01T00:00:00.000Z',updatedAt:'2026-06-02T00:00:00.000Z'});storage.setItem(key,serialized);const region=regionFromLocation('/hapcheon','','gajo.odex.kr'),restored=ensureTripSession(region,storage as any);assert.equal(region,'hapcheon');assert.equal(restored.anonymousTripId,'same-url-hapcheon');assert.equal(itineraryItemCount(restored),2);assert.equal(storage.getItem(key),serialized);assert.equal(storage.getItem('regional-concierge-trip-session-v1:gajo'),null)});

test("present but rejected Hapcheon bytes enter restoration pending and cannot be overwritten",()=>{const storage=memory(),key='regional-concierge-trip-session-v1:hapcheon',rejected='{"id":"recover-me","regionId":"hapcheon"';storage.setItem(key,rejected);const pending=ensureTripSession('hapcheon',storage as any);assert.equal(pending.restorationPending,true);assert.equal(storage.getItem(key),rejected);saveTripSession(pending,storage as any);saveTripSession(createTripSession('hapcheon'),storage as any);assert.equal(storage.getItem(key),rejected);const diagnostics=tripRestorationDiagnostics('hapcheon',storage as any);assert.equal(diagnostics.storedValueStatus,'REJECTED');assert.equal(diagnostics.persistenceBlocked,true)});

test("only explicit new-trip execution archives A and activates a fresh empty B", () => {
  const storage = memory(), old = saveTripSession(goldenTrip(), storage as any);
  assert.equal(loadTripSession(storage as any, "hapcheon")!.anonymousTripId, old.anonymousTripId);
  const next = archiveAndStartNewTrip("hapcheon", storage as any);
  assert.notEqual(next.anonymousTripId, old.anonymousTripId);
  assert.equal(next.itinerary, undefined);
  assert.ok(storage.getItem(`regional-concierge-trip-archive-v1:hapcheon:${old.anonymousTripId}`));
  assert.equal(tripRestorationDiagnostics("hapcheon", storage as any).archiveCount, 1);
});

test("restoration remains region isolated", () => {
  const storage = memory(), hapcheon = saveTripSession(goldenTrip(), storage as any);
  const gajo = saveTripSession({ ...createTripSession("gajo"), savedPlaces: [{ entityId: "gajo-only" }] }, storage as any);
  updateTripRuntimeContext("hapcheon", { regionId: "hapcheon", locality: "합천읍" }, storage as any);
  assert.equal(loadTripSession(storage as any, "hapcheon")!.anonymousTripId, hapcheon.anonymousTripId);
  assert.equal(loadTripSession(storage as any, "gajo")!.anonymousTripId, gajo.anonymousTripId);
  assert.deepEqual(loadTripSession(storage as any, "gajo")!.savedPlaces, [{ entityId: "gajo-only" }]);
});

test("Okcheon field journey survives reopen and movement with semantic and execution continuity", () => {
  const storage = memory(), original = saveTripSession({
    ...createTripSession("okcheon"),
    plannedContext: {
      mustVisitPlaces: [
        { label: "정지용 생가", entityId: "okcheon:birthplace", resolved: true },
        { label: "정지용문학관", entityId: "okcheon:museum", resolved: true },
      ],
    },
    itinerary: { savedAsFullJourney: true, journeyId: "okcheon-literary", steps: [
      { entityId: "okcheon:birthplace", programLabel: "정지용 생가" },
      { entityId: "okcheon:museum", programLabel: "정지용문학관" },
    ] },
    savedPlaces: [{ entityId: "okcheon:birthplace" }],
    execution: { currentEntityId: "okcheon:birthplace", statusByEntityId: { "okcheon:birthplace": "EN_ROUTE" as const } },
    runtimeContext: {
      regionId: "okcheon",
      locality: "옥천구읍",
      semanticContext: { anchorLabels: ["정지용", "옥천구읍"] },
    },
  }, storage as any);
  const moved = updateTripRuntimeContext("okcheon", {
    ...original.runtimeContext,
    regionId: "okcheon",
    locality: "옥천읍",
    latitude: 36.3,
    longitude: 127.57,
  }, storage as any)!, reopened = loadTripSession(storage as any, "okcheon")!;
  assert.equal(reopened.anonymousTripId, original.anonymousTripId);
  assert.deepEqual(reopened.itinerary, original.itinerary);
  assert.deepEqual(reopened.savedPlaces, original.savedPlaces);
  assert.deepEqual(reopened.execution, original.execution);
  assert.deepEqual(reopened.plannedContext, original.plannedContext);
  assert.deepEqual(reopened.runtimeContext.semanticContext, original.runtimeContext.semanticContext);
  assert.equal(reopened.runtimeContext.locality, "옥천읍");
  assert.equal(moved.anonymousTripId, original.anonymousTripId);
  assert.equal(tripRestorationDiagnostics("okcheon", storage as any).uiState, "CONTINUE");
});

test("home continuation remains visible and every new-trip entry requires confirmation", () => {
  const continuity = readFileSync(new URL("./components/TripContinuity.tsx", import.meta.url), "utf8"), savedEntry = readFileSync(new URL("./components/SavedTripEntry.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(continuity, /regional-trip-return-shown|sessionStorage\.getItem\(seen\)/);
  assert.match(continuity, /hasSavedTrip\(local\)[\s\S]*setVisible\(true\)/);
  assert.match(continuity, /role="alertdialog"/);
  assert.match(savedEntry, /role="alertdialog"/);
  assert.match(savedEntry, /onClick=\{\(\) => setConfirming\(true\)\}/);
});

test("privacy-safe field diagnostic mode is read-only and exposes restoration boundaries",()=>{const layout=readFileSync(new URL("./components/Layout.tsx",import.meta.url),"utf8");assert.match(layout,/trip-diagnostics/);for(const label of["활성 저장 키","localStorage","sessionStorage 보조","저장값 상태","복원 출처","담아둔 곳","일정 단계","실행 상태","보관 여행","새 세션 생성","복원 전 저장 발생","복원 전 저장 차단"])assert.match(layout,new RegExp(label));assert.doesNotMatch(layout,/rawMessage|freeText|fullAnonymous|localStorage\.(?:setItem|removeItem|clear)|sessionStorage\.(?:setItem|removeItem|clear)/)});
