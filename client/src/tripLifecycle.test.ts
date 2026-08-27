import test from "node:test";
import assert from "node:assert/strict";
import { addEntityToRegionalItinerary, executionState } from "./journeyExecution.ts";
import { applyReplannedJourney } from "./fullJourney.ts";
import { archiveAndStartNewTrip, auditArchivedTripLifecycle, createTripSession, ensureTripSession, listArchivedTripSessions, loadTripSession, saveTripSession } from "./tripSession.ts";

const memory = () => { const data = new Map<string, string>(); return { data, get length() { return data.size; }, getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => data.set(key, value), key: (index: number) => [...data.keys()][index] || null }; };
const step = (entityId: string, regionId = "hapcheon") => ({ entityId, regionId, label: entityId, status: "PLANNED" });

test("saved-place mutation preserves the active identity and creates no archive", () => {
  const storage = memory(), active = saveTripSession(createTripSession("hapcheon"), storage as any);
  addEntityToRegionalItinerary("hapcheon", step("A"), storage as any);
  assert.equal(loadTripSession(storage as any, "hapcheon")?.anonymousTripId, active.anonymousTripId);
  assert.equal(listArchivedTripSessions("hapcheon", storage as any).length, 0);
});

test("replan and explicit completion preserve identity without archiving", () => {
  const storage = memory(), active = saveTripSession({ ...createTripSession("hapcheon"), itinerary: { steps: [step("A"), step("B")] } }, storage as any);
  saveTripSession(executionState(active, "A", "COMPLETED"), storage as any);
  const replanned = applyReplannedJourney("hapcheon", { steps: [step("C")] }, { regionId: "hapcheon" }, storage as any)!;
  assert.equal(replanned.anonymousTripId, active.anonymousTripId);
  assert.equal(listArchivedTripSessions("hapcheon", storage as any).length, 0);
});

test("reopen restores the same active identity", () => {
  const storage = memory(), active = saveTripSession({ ...createTripSession("gajo"), savedPlaces: [step("A", "gajo")] }, storage as any);
  assert.equal(ensureTripSession("gajo", storage as any).anonymousTripId, active.anonymousTripId);
});

test("explicit new trip archives once and stale restoration cannot replace the new active pointer", () => {
  const storage = memory(), old = saveTripSession({ ...createTripSession("hapcheon"), savedPlaces: [step("A")] }, storage as any), next = archiveAndStartNewTrip("hapcheon", storage as any);
  assert.notEqual(next.anonymousTripId, old.anonymousTripId);
  assert.equal(listArchivedTripSessions("hapcheon", storage as any).length, 1);
  const afterStaleWrite = saveTripSession({ ...old, savedPlaces: [step("A"), step("STALE")] }, storage as any);
  assert.equal(afterStaleWrite.anonymousTripId, next.anonymousTripId);
  assert.equal(loadTripSession(storage as any, "hapcheon")?.anonymousTripId, next.anonymousTripId);
  assert.equal(listArchivedTripSessions("hapcheon", storage as any).length, 1);
});

test("two intentional same-day trips remain separate canonical archives", () => {
  const storage = memory(), at = new Date("2026-08-27T01:00:00Z");
  saveTripSession({ ...createTripSession("hapcheon", at), savedPlaces: [step("A")] }, storage as any);
  const second = archiveAndStartNewTrip("hapcheon", storage as any);
  saveTripSession({ ...second, savedPlaces: [step("B")] }, storage as any);
  archiveAndStartNewTrip("hapcheon", storage as any);
  const archived = listArchivedTripSessions("hapcheon", storage as any);
  assert.equal(archived.length, 2);
  assert.notEqual(archived[0].anonymousTripId, archived[1].anonymousTripId);
});

test("legacy duplicate evidence is detected and never mutated", () => {
  const storage = memory(), legacy = { ...createTripSession("okcheon"), anonymousTripId: "legacy", savedPlaces: [step("A", "okcheon")] };
  storage.setItem("regional-concierge-trip-archive-v1:okcheon:legacy-a", JSON.stringify(legacy));
  storage.setItem("regional-concierge-trip-archive-v1:okcheon:legacy-b", JSON.stringify(legacy));
  const before = new Map(storage.data), audit = auditArchivedTripLifecycle("okcheon", storage as any);
  assert.deepEqual(audit.duplicateSessionIds, ["legacy"]);
  assert.ok(audit.records.every((record) => record.classification === "DUPLICATE_ARCHIVE"));
  assert.deepEqual(storage.data, before);
});

test("lifecycle identity guard remains region isolated", () => {
  const storage = memory(), gajo = saveTripSession({ ...createTripSession("gajo"), savedPlaces: [step("G", "gajo")] }, storage as any), okcheon = saveTripSession({ ...createTripSession("okcheon"), savedPlaces: [step("O", "okcheon")] }, storage as any);
  saveTripSession({ ...createTripSession("hapcheon"), savedPlaces: [step("H")] }, storage as any);
  archiveAndStartNewTrip("hapcheon", storage as any);
  assert.equal(loadTripSession(storage as any, "gajo")?.anonymousTripId, gajo.anonymousTripId);
  assert.equal(loadTripSession(storage as any, "okcheon")?.anonymousTripId, okcheon.anonymousTripId);
});
