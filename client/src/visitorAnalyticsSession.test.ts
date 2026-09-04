import test from "node:test";
import assert from "node:assert/strict";
import {
  nextVisit,
  VISIT_IDLE_MS,
  analyticsScreen,
} from "./visitorAnalyticsSession.ts";
test("visit is independent of TripSession and renews at exactly 30 minutes", () => {
  const first = nextVisit(null, 0, () => "visit-1");
  assert.equal(
    nextVisit(first, VISIT_IDLE_MS - 1, () => "new").visitSessionId,
    "visit-1",
  );
  assert.equal(
    nextVisit(first, VISIT_IDLE_MS, () => "visit-2").visitSessionId,
    "visit-2",
  );
});
test("activity extends a visit while retaining entry attribution", () => {
  const first = {
    visitSessionId: "v",
    lastActiveAt: 0,
    entryId: "regional-qr:gajo",
  };
  const active = nextVisit(first, 1000, () => "new");
  assert.equal(active.entryId, first.entryId);
  assert.equal(
    nextVisit(active, VISIT_IDLE_MS, () => "new").visitSessionId,
    "v",
  );
});
test("new visits do not inherit stale entry attribution and clock rollback is safe", () => {
  const first = {
    visitSessionId: "v",
    lastActiveAt: 100,
    entryId: "partner:old",
  };
  assert.equal(
    nextVisit(first, VISIT_IDLE_MS + 100, () => "new").entryId,
    undefined,
  );
  assert.equal(nextVisit(first, 99, () => "new").visitSessionId, "new");
});
test("calendar midnight does not split an active visit", () => {
  const first = {
    visitSessionId: "v",
    lastActiveAt: Date.parse("2026-09-03T14:59:00Z"),
  };
  assert.equal(
    nextVisit(first, Date.parse("2026-09-03T15:01:00Z"), () => "new")
      .visitSessionId,
    "v",
  );
});
test("all six regions map screens without recording full routes or queries", () => {
  for (const r of [
    "gajo",
    "okcheon",
    "muan",
    "gyeryong",
    "hapcheon",
    "daejeon-junggu",
  ]) {
    assert.equal(analyticsScreen("/" + r, r), "HOME");
    assert.equal(analyticsScreen("/" + r + "/nearby-discovery", r), "NEARBY");
    assert.equal(analyticsScreen("/" + r + "/admin", r), "UNKNOWN");
  }
});
