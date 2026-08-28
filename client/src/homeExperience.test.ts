import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGION_CONFIGS } from "./regionConfig.ts";
import { continueTripLabel, homeTripSummary } from "./homeExperience.ts";
import { archiveAndStartNewTrip, createTripSession, loadTripSession, saveTripSession } from "./tripSession.ts";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const memory = () => { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) }; };

test("Hapcheon owns the Phase 1.5 hero without leaking it to another region", () => {
  assert.deepEqual(REGION_CONFIGS.hapcheon.home.hero, { title: "수려한 합천, 여행이 시작됩니다", titleLines: ["수려한 합천,", "여행이 시작됩니다"], description: "자연과 문화가 어우러진 합천을 AI 여행도우미와 편하게 만나보세요." });
  for (const [id, region] of Object.entries(REGION_CONFIGS)) if (id !== "hapcheon") assert.equal(region.home.hero, undefined);
});
test("same Seoul date and previous Seoul date use distinct continuation labels", () => {
  const now = new Date("2026-08-28T05:00:00Z");
  assert.equal(continueTripLabel(createTripSession("hapcheon", new Date("2026-08-27T15:30:00Z")), now), "오늘 여행 계속하기");
  assert.equal(continueTripLabel(createTripSession("hapcheon", new Date("2026-08-26T15:30:00Z")), now), "이 여행 이어가기");
});
test("resume summary uses only known itinerary state", () => {
  const trip = { ...createTripSession("hapcheon", new Date("2026-08-28T01:00:00Z")), itinerary: { steps: [{ entityId: "done" }, { entityId: "next" }, { entityId: "skip" }] }, execution: { statusByEntityId: { done: "COMPLETED" as const, skip: "SKIPPED" as const } } };
  assert.deepEqual(homeTripSummary(trip), { heading: "8월 28일 · 합천 여행", detail: "방문 1곳 · 남은 일정 1곳" });
  assert.equal(homeTripSummary(createTripSession("hapcheon")).detail, undefined);
});
test("continuing preserves identity and explicit new trip archives before replacement", () => {
  const storage = memory(), current = saveTripSession({ ...createTripSession("hapcheon"), savedPlaces: [{ entityId: "lake" }] }, storage as any);
  assert.equal(loadTripSession(storage as any, "hapcheon")?.anonymousTripId, current.anonymousTripId);
  const next = archiveAndStartNewTrip("hapcheon", storage as any);
  assert.notEqual(next.anonymousTripId, current.anonymousTripId);
  assert.ok(storage.getItem(`regional-concierge-trip-archive-v1:hapcheon:${current.anonymousTripId}`));
});
test("Home action cards enter the existing PLAN and NOW routes and confirmation owns mutation", () => {
  const home = source("./pages/HomePage.tsx"), continuity = source("./components/TripContinuity.tsx");
  assert.match(home, /chooseMode\('PLAN'\)/); assert.match(home, /chooseMode\('NOW'\)/); assert.match(home, /tripMode:mode/);
  assert.match(home, /여행을 계획하고 싶어요/); assert.match(home, /지금 어디로 갈까요\?/);
  assert.match(continuity, /onClick=\{\(\) => setConfirmingNew\(true\)\}/); assert.match(continuity, /archiveAndStartNewTrip\(region\.id\)/);
});
test("NOW copy and all five existing intent actions remain wired to send", () => {
  const concierge = source("./pages/ConciergePage.tsx"), actions = source("./nowQuickActions.ts");
  assert.ok(actions.includes('NOW_HEADING = "지금 무엇을 하고 싶으세요?"')); assert.ok(actions.includes('["지금 무엇을", "하고 싶으세요?"]')); assert.match(concierge, /배가 고프거나, 잠시 쉬고 싶거나/); assert.match(concierge, /NowImmediateActions onSelect=\{\(label\) => send\(label\)\}/);
  for (const label of ["밥 먹고 싶어요", "카페 가고 싶어요", "다음 어디 갈까요?", "비가 와요", "숙소로 갈래요"]) assert.ok(actions.includes(label));
});
test("partner entry copy comes from the public projection and never bypasses the public API", () => {
  const entry = source("./pages/PartnerEntryPage.tsx");
  assert.match(entry, /fetchPublicPartner\(partnerSlug\)/); assert.match(entry, /partner\.displayName/); assert.match(entry, /지금 갈 곳, 먹을 곳, 비 오는 날 코스를/); assert.doesNotMatch(entry, /스마일펜션에서/);
});
