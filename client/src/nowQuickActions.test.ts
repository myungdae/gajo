import test from "node:test";
import assert from "node:assert/strict";
import { NOW_QUICK_ACTIONS } from "./nowQuickActions.ts";
import { createTripSession, sessionContext } from "./tripSession.ts";
test("NOW exposes the six action-first choices", () => {
  assert.deepEqual(
    NOW_QUICK_ACTIONS.map((x) => x.label),
    [
      "식당 찾기",
      "카페 찾기",
      "관광지 찾기",
      "숙소 찾기",
      "다음 일정 추천",
      "일정 바꾸기",
    ],
  );
  assert.equal(NOW_QUICK_ACTIONS.filter((x) => x.kind === "NEARBY").length, 4);
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
