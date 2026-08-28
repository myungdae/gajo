import test from "node:test";
import assert from "node:assert/strict";
import { applyPartnerEntryToTrip } from "./partnerEntry.ts";
import { createTripSession } from "./tripSession.ts";
const partner: any = {
  partnerId: "p1",
  canonicalEntityId: "entity:1",
  regionId: "hapcheon",
  partnerSlug: "smile",
  displayName: "합천호 스마일펜션",
  status: "OPERATING",
  qrStatus: "ACTIVE",
  verificationStatus: "VERIFIED",
};
test("/go partner entry reuses the active anonymous TripSession and stores minimal source", () => {
  const trip = {
    ...createTripSession("hapcheon"),
    itinerary: { steps: [{ entityId: "a" }] },
    runtimeContext: { weather: "RAIN" },
  };
  const next = applyPartnerEntryToTrip(trip, partner, "2026-08-28T00:00:00Z");
  assert.equal(next.id, trip.id);
  assert.equal(next.anonymousTripId, trip.anonymousTripId);
  assert.equal(next.itinerary, trip.itinerary);
  assert.deepEqual(next.partnerEntryContext, {
    partnerId: "p1",
    partnerSlug: "smile",
    partnerName: "합천호 스마일펜션",
    enteredAt: "2026-08-28T00:00:00Z",
    source: "PARTNER_QR",
  });
  assert.equal(
    JSON.stringify(next.partnerEntryContext).includes("phone"),
    false,
  );
  assert.equal(
    JSON.stringify(next.partnerEntryContext).includes("location"),
    false,
  );
});
test("partner entry rejects cross-region session mutation", () =>
  assert.throws(
    () => applyPartnerEntryToTrip(createTripSession("okcheon"), partner),
    /region mismatch/,
  ));
