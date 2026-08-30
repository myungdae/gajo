import test from "node:test";
import assert from "node:assert/strict";
import { NOW_QUICK_ACTIONS } from "./nowQuickActions.ts";
import { createTripSession, sessionContext } from "./tripSession.ts";
test("NOW exposes the five approved accessible action labels and AI prompts", () => {
  assert.deepEqual(
    NOW_QUICK_ACTIONS.map((x) => x.label),
    [
      "🍚 식당을 찾고 싶어요",
      "☕ 잠시 쉬어갈 곳을 찾고 싶어요",
      "📍 주변에 가볼 만한 곳을 찾고 싶어요",
      "✦ 다음 여행지를 추천해 주세요",
      "🏠 숙소를 찾고 싶어요",
    ],
  );
  assert.equal(new Set(NOW_QUICK_ACTIONS.map((x) => x.prompt)).size, 5);
});
test("NOW action requests retain the active trip execution context", () => {
  const trip = {
    ...createTripSession("hapcheon"),
    execution: {
      currentEntityId: "current",
      statusByEntityId: {
        current: "EN_ROUTE" as const,
        done: "COMPLETED" as const,
        skip: "SKIPPED" as const,
      },
    },
    itinerary: { steps: [{ entityId: "current" }, { entityId: "next" }] },
  };
  const context = sessionContext(trip).tripContext!;
  assert.equal(context.anonymousTripId, trip.anonymousTripId);
  assert.equal(context.currentEntityId, "current");
  assert.deepEqual(context.completedEntityIds, ["done"]);
  assert.deepEqual(context.skippedEntityIds, ["skip"]);
  assert.ok(context.itineraryEntityIds.includes("next"));
});
