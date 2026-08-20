import test from "node:test";
import assert from "node:assert/strict";
import { createTripSession } from "./tripSession.ts";
import { itineraryItemCount, reconcileTrip } from "./tripContinuity.ts";
test("reconciles local and server itinerary without duplicates", () => {
  const local = {
      ...createTripSession("hapcheon"),
      itinerary: { steps: [{ entityId: "a" }] },
      updatedAt: "2026-01-01T00:00:00Z",
    },
    remote = {
      ...local,
      itinerary: { steps: [{ entityId: "a" }, { entityId: "b" }] },
      updatedAt: "2026-01-02T00:00:00Z",
    };
  assert.equal(itineraryItemCount(reconcileTrip(local, remote)), 2);
});
test("never reconciles an anonymous trip across regions", () => {
  const local = createTripSession("hapcheon"),
    remote = { ...local, regionId: "gajo" };
  assert.equal(reconcileTrip(local, remote), local);
});
test("My Trip count deduplicates one canonical place across a full journey and saved candidates", () => {
  const session = {
    ...createTripSession("hapcheon"),
    itinerary: {
      savedAsFullJourney: true,
      steps: [{ entityId: "a" }, { entityId: "b" }],
    },
    savedPlaces: [{ entityId: "b" }, { entityId: "c" }],
  };
  assert.equal(itineraryItemCount(session), 3);
});
