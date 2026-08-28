import test from "node:test";
import assert from "node:assert/strict";
import { NOW_QUICK_ACTIONS } from "./nowQuickActions.ts";
import { createTripSession, sessionContext } from "./tripSession.ts";
test("NOW exposes the five approved accessible action labels and AI prompts", () => {
  assert.deepEqual(
    NOW_QUICK_ACTIONS.map((x) => x.label),
    [
      "🍚 밥 먹고 싶어요",
      "☕ 카페 가고 싶어요",
      "📍 다음 어디 갈까요?",
      "🌧️ 비가 와요",
      "🏠 숙소로 갈래요",
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
