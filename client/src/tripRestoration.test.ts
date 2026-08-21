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

test("home continuation remains visible and every new-trip entry requires confirmation", () => {
  const continuity = readFileSync(new URL("./components/TripContinuity.tsx", import.meta.url), "utf8"), savedEntry = readFileSync(new URL("./components/SavedTripEntry.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(continuity, /regional-trip-return-shown|sessionStorage\.getItem\(seen\)/);
  assert.match(continuity, /hasSavedTrip\(local\)[\s\S]*setVisible\(true\)/);
  assert.match(continuity, /role="alertdialog"/);
  assert.match(savedEntry, /role="alertdialog"/);
  assert.match(savedEntry, /onClick=\{\(\) => setConfirming\(true\)\}/);
});
