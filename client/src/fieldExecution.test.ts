import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { archiveAndStartNewTrip, createTripSession, listArchivedTripSessions, loadTripSession, saveTripSession } from "./tripSession.ts";
import { archivedTripSummary } from "./archivePresentation.ts";
import { executionState, visitorExecutionLabel } from "./journeyExecution.ts";
import { applyReplannedJourney } from "./fullJourney.ts";

const memory = () => { const data = new Map<string, string>(); return { get length() { return data.size; }, getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => data.set(key, value), key: (index: number) => [...data.keys()][index] || null }; };
const step = (entityId: string, regionId = "hapcheon") => ({ entityId, regionId, label: entityId, status: "PLANNED" });

test("explicit completion persists timestamp, identity, and archived visited count", () => {
  const storage = memory(), original = saveTripSession({ ...createTripSession("hapcheon"), itinerary: { steps: [step("A")] } }, storage as any);
  const completed = saveTripSession(executionState(original, "A", "COMPLETED", new Date("2026-08-27T01:02:03Z")), storage as any);
  assert.equal(completed.anonymousTripId, original.anonymousTripId);
  assert.equal(completed.execution?.statusByEntityId?.A, "COMPLETED");
  assert.equal(completed.execution?.completedAtByEntityId?.A, "2026-08-27T01:02:03.000Z");
  archiveAndStartNewTrip("hapcheon", storage as any);
  const archived = listArchivedTripSessions("hapcheon", storage as any);
  assert.equal(archived.length, 1);
  assert.equal(archivedTripSummary(archived[0]).completed.length, 1);
});

test("skip is timestamped, retained, and never counted as visited", () => {
  const session = { ...createTripSession("gajo"), itinerary: { steps: [step("A", "gajo")] } };
  const skipped = executionState(session, "A", "SKIPPED", new Date("2026-08-27T02:00:00Z"));
  assert.equal(skipped.execution.skippedAtByEntityId?.A, "2026-08-27T02:00:00.000Z");
  assert.equal(archivedTripSummary(skipped).completed.length, 0);
  assert.equal(archivedTripSummary(skipped).skipped.length, 1);
});

test("two completed steps survive replan and new steps are not visited", () => {
  const storage = memory(), original = saveTripSession({ ...createTripSession("hapcheon"), itinerary: { savedAsFullJourney: true, steps: [step("A"), step("B"), step("C"), step("D")] }, execution: { statusByEntityId: { A: "COMPLETED", B: "COMPLETED" }, completedAtByEntityId: { A: "2026-08-27T01:00:00Z", B: "2026-08-27T02:00:00Z" } } }, storage as any);
  const replanned = applyReplannedJourney("hapcheon", { steps: [step("E"), step("F")] }, { regionId: "hapcheon" }, storage as any)!;
  assert.equal(replanned.anonymousTripId, original.anonymousTripId);
  assert.deepEqual((replanned.itinerary as any).steps.slice(0, 2).map((item: any) => item.entityId), ["A", "B"]);
  assert.deepEqual(replanned.execution?.completedAtByEntityId, original.execution?.completedAtByEntityId);
  assert.equal(archivedTripSummary(replanned).completed.length, 2);
  assert.equal(replanned.execution?.statusByEntityId?.E, undefined);
});

test("natural visitor labels hide internal execution enums", () => {
  assert.deepEqual(["PLANNED", "READY", "COMPLETED", "SKIPPED", "REPLACED_BY_REPLAN", "NEWLY_ADDED"].map(visitorExecutionLabel), ["예정", "현재", "방문 완료 ✓", "건너뜀", "일정 변경으로 교체됨", "새 일정에 추가됨"]);
});

test("completion remains isolated across Hapcheon, Gajo, and Okcheon", () => {
  const storage = memory();
  for (const region of ["hapcheon", "gajo", "okcheon"]) saveTripSession({ ...createTripSession(region), itinerary: { steps: [step(`${region}:A`, region)] } }, storage as any);
  const hapcheon = loadTripSession(storage as any, "hapcheon")!;
  saveTripSession(executionState(hapcheon, "hapcheon:A", "COMPLETED"), storage as any);
  assert.equal(loadTripSession(storage as any, "hapcheon")?.execution?.statusByEntityId?.["hapcheon:A"], "COMPLETED");
  assert.equal(loadTripSession(storage as any, "gajo")?.execution, undefined);
  assert.equal(loadTripSession(storage as any, "okcheon")?.execution, undefined);
});

test("unified conversation uses one API/session and has no app audio or auto-restart loop", () => {
  const page = readFileSync(new URL("./pages/ConciergePage.tsx", import.meta.url), "utf8"), layout = readFileSync(new URL("./components/Layout.tsx", import.meta.url), "utf8"), speech = readFileSync(new URL("./hooks/useSpeechInput.ts", import.meta.url), "utf8"), css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
  assert.match(layout, /\/concierge\?mode=now[\s\S]*AI 여행도우미/);
  assert.match(page, /postConciergeChat/);
  assert.match(page, /contextSessionId:\s*contextSessionIdRef\.current/);
  assert.match(page, /loadTripSession\(localStorage, region\.id\)/);
  assert.match(page, /concierge-unified-composer/);
  assert.doesNotMatch(speech, /setTimeout|SPEECH_RESTART_DELAY_MS|new Audio|AudioContext|oscillator/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*concierge-unified-composer/);
});
