import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { archiveAndStartNewTrip, createTripSession, loadTripSession, saveTripSession, tripRestorationDiagnostics, updateTripRuntimeContext } from "./tripSession.ts";

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
