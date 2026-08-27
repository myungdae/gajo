import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { archivedTripDate, archivedTripSummary, DEFAULT_ARCHIVE_COUNT } from "./archivePresentation.ts";
import { archiveAndStartNewTrip, createTripSession, listArchivedTripSessions, saveTripSession } from "./tripSession.ts";

const memory = () => { const data = new Map<string, string>(); return { get length() { return data.size; }, getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => data.set(key, value), key: (index: number) => [...data.keys()][index] || null }; };
const trip = (regionId: string, createdAt: string, updatedAt: string) => ({ ...createTripSession(regionId, new Date(createdAt)), updatedAt });

test("archives are region-isolated and newest archive time sorts first", () => {
  const storage = memory();
  storage.setItem("regional-concierge-trip-archive-v1:gajo:old", JSON.stringify({ ...trip("gajo", "2026-08-20", "2026-08-21"), anonymousTripId: "old", archivedAt: "2026-08-24" }));
  storage.setItem("regional-concierge-trip-archive-v1:gajo:new", JSON.stringify({ ...trip("gajo", "2026-08-22", "2026-08-23"), anonymousTripId: "new", archivedAt: "2026-08-27" }));
  storage.setItem("regional-concierge-trip-archive-v1:hapcheon:h", JSON.stringify({ ...trip("hapcheon", "2026-08-26", "2026-08-26"), anonymousTripId: "h" }));
  assert.deepEqual(listArchivedTripSessions("gajo", storage as any).map((item) => item.anonymousTripId), ["new", "old"]);
  assert.equal(listArchivedTripSessions("hapcheon", storage as any).length, 1);
  assert.equal(listArchivedTripSessions("okcheon", storage as any).length, 0);
});

test("human summary distinguishes execution and replan evidence from the plan", () => {
  const session = { ...trip("gajo", "2026-08-27T00:00:00Z", "2026-08-27T01:00:00Z"), itinerary: { steps: [{ entityId: "a" }, { entityId: "b", status: "SKIPPED" }, { entityId: "c", status: "NEWLY_ADDED" }] }, savedPlaces: [{ entityId: "saved" }], execution: { statusByEntityId: { a: "COMPLETED" as const } }, replanHistory: [{ replannedAt: "2026-08-27", replacedSteps: [{ entityId: "old", status: "REPLACED_BY_REPLAN" }], newlyAddedEntityIds: ["c"] }] };
  const summary = archivedTripSummary(session);
  assert.equal(archivedTripDate(session), "2026. 8. 27.");
  assert.deepEqual([summary.completed.length, summary.steps.length, summary.skipped.length, summary.replaced.length, summary.newlyAdded.length, summary.saved.length], [1, 3, 1, 1, 1, 1]);
});

test("empty active sessions no longer create archives and existing empty archives are never deleted", () => {
  const storage = memory(), empty = saveTripSession(createTripSession("gajo"), storage as any);
  storage.setItem("regional-concierge-trip-archive-v1:gajo:existing-empty", JSON.stringify({ ...empty, anonymousTripId: "existing-empty" }));
  archiveAndStartNewTrip("gajo", storage as any);
  assert.equal(listArchivedTripSessions("gajo", storage as any).length, 1);
  assert.ok(storage.getItem("regional-concierge-trip-archive-v1:gajo:existing-empty"));
});

test("archive UI defaults to four, offers more, and keeps current trip separate", () => {
  const archive = readFileSync(new URL("./components/ArchivedTrips.tsx", import.meta.url), "utf8"), page = readFileSync(new URL("./pages/ItineraryPage.tsx", import.meta.url), "utf8");
  assert.equal(DEFAULT_ARCHIVE_COUNT, 4);
  assert.match(archive, /slice\(0, DEFAULT_ARCHIVE_COUNT\)/);
  assert.match(archive, /지난 여행 더보기/);
  assert.match(archive, /여행 기록 보기/);
  assert.match(archive, /일정 없음/);
  assert.doesNotMatch(archive, /지난 여행 \$\{index/);
  assert.match(page, /현재 진행 중인 여행 일정이 없습니다/);
  assert.match(page, /<h2>현재 여행<\/h2>/);
});
