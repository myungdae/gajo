import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyReplannedJourney } from "./fullJourney.ts";
import { archiveAndStartNewTrip, createTripSession, listArchivedTripSessions, loadTripSession, saveTripSession } from "./tripSession.ts";

const memory = () => { const data = new Map<string, string>(); return { data, get length() { return data.size; }, getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => data.set(key, value), key: (index: number) => [...data.keys()][index] || null }; };
const step = (entityId: string, status = "PLANNED") => ({ entityId, regionId: "hapcheon", programLabel: entityId, status });

test("TEST A: continuing a reopened Hapcheon trip preserves its identity and three places", () => {
  const storage = memory(), original = saveTripSession({ ...createTripSession("hapcheon"), itinerary: { savedAsFullJourney: true, steps: [step("A"), step("B"), step("C")] }, savedPlaces: [step("S1"), step("S2"), step("S3")] }, storage as any);
  const reopened = loadTripSession(storage as any, "hapcheon")!;
  assert.equal(reopened.anonymousTripId, original.anonymousTripId);
  assert.deepEqual(reopened.itinerary, original.itinerary);
  assert.deepEqual(reopened.savedPlaces, original.savedPlaces);
});

test("TEST B: starting a new Hapcheon trip leaves the old trip recoverable and visible", () => {
  const storage = memory(), old = saveTripSession({ ...createTripSession("hapcheon"), itinerary: { steps: [step("A"), step("B"), step("C")] }, savedPlaces: [step("S")], execution: { currentEntityId: "B", statusByEntityId: { A: "COMPLETED" } } }, storage as any);
  const next = archiveAndStartNewTrip("hapcheon", storage as any);
  assert.notEqual(next.anonymousTripId, old.anonymousTripId);
  const archived = listArchivedTripSessions("hapcheon", storage as any);
  assert.equal(archived.length, 1);
  assert.deepEqual({ ...archived[0], archivedAt: undefined }, { ...old, archivedAt: undefined });
  assert.ok(archived[0].archivedAt);
  const ui = readFileSync(new URL("./components/ArchivedTrips.tsx", import.meta.url), "utf8");
  assert.match(ui, /지난 여행/);
  assert.match(ui, /읽기 전용/);
});

test("TEST C: location-based three-stop replan keeps identity, history, saved places, and constraints", () => {
  const storage = memory(), original = saveTripSession({ ...createTripSession("hapcheon"), plannedContext: { mustVisitPlaces: [{ label: "C", entityId: "C", resolved: true }] }, runtimeContext: { regionId: "hapcheon", latitude: 35.1 }, itinerary: { savedAsFullJourney: true, journeyId: "journey-1", steps: [step("A", "COMPLETED"), step("B", "READY"), step("C")] }, savedPlaces: [step("S")], execution: { currentEntityId: "B", statusByEntityId: { A: "COMPLETED", B: "READY" } } }, storage as any);
  const replanned = applyReplannedJourney("hapcheon", { steps: [step("D"), step("E"), step("C")] }, { regionId: "hapcheon", latitude: 35.5 }, storage as any)!;
  assert.equal(replanned.anonymousTripId, original.anonymousTripId);
  assert.deepEqual((replanned.itinerary as any).steps.map((item: any) => item.entityId), ["A", "D", "E", "C"]);
  assert.equal((replanned.itinerary as any).steps[0].status, "COMPLETED");
  assert.deepEqual(replanned.savedPlaces, original.savedPlaces);
  assert.deepEqual(replanned.plannedContext, original.plannedContext);
  assert.equal(replanned.runtimeContext.latitude, 35.5);
  assert.equal(replanned.execution?.currentEntityId, "D");
  assert.equal(replanned.replanHistory?.[0].replacedSteps[0].status, "REPLACED_BY_REPLAN");
  assert.deepEqual(replanned.replanHistory?.[0].newlyAddedEntityIds, ["D", "E"]);
});

test("TEST D: a new trip changes no other regional session", () => {
  const storage = memory(), gajo = saveTripSession({ ...createTripSession("gajo"), savedPlaces: [{ entityId: "gajo-only" }] }, storage as any), okcheon = saveTripSession({ ...createTripSession("okcheon"), savedPlaces: [{ entityId: "okcheon-only" }] }, storage as any);
  saveTripSession({ ...createTripSession("hapcheon"), savedPlaces: [step("hapcheon-only")] }, storage as any);
  archiveAndStartNewTrip("hapcheon", storage as any);
  assert.deepEqual(loadTripSession(storage as any, "gajo"), gajo);
  assert.deepEqual(loadTripSession(storage as any, "okcheon"), okcheon);
  assert.equal(listArchivedTripSessions("gajo", storage as any).length, 0);
});
