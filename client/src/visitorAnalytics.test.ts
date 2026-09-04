import test from "node:test";
import assert from "node:assert/strict";
import {
  visitorTrack,
  visitFor,
  setEntry,
  rememberPlace,
  bridgeVisitorEvent,
} from "./visitorAnalytics.ts";
class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) || null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}
const storage = new MemoryStorage(),
  session = new MemoryStorage();
Object.assign(globalThis, {
  localStorage: storage,
  sessionStorage: session,
  window: {
    location: { pathname: "/hapcheon/nearby", search: "?lang=en&test=1" },
    localStorage: storage,
  },
});
const trip = crypto.randomUUID();
const settle = () => new Promise((r) => setTimeout(r, 20));
test("transport retries identical eventId without blocking or copying private metadata", async () => {
  const calls: any[] = [];
  globalThis.fetch = (async (_url: any, options: any) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) throw new Error("offline");
    return { status: 200 };
  }) as any;
  bridgeVisitorEvent("PHONE_HANDOFF", "hapcheon", trip, {
    entityId: "place:test",
    rawMessage: "do not store",
    latitude: 12,
  });
  await settle();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].eventId, calls[1].eventId);
  assert.equal(calls[0].uiLocale, "en");
  assert.equal(calls[0].rawMessage, undefined);
  assert.equal(calls[0].latitude, undefined);
  assert.equal(calls[0].trafficClass, undefined);
  assert.equal(calls[0].visitSessionId === trip, false);
});
test("double clicks and repeated renders do not send duplicate actions", async () => {
  let count = 0;
  globalThis.fetch = (async () => {
    count++;
    return { status: 200 };
  }) as any;
  for (let i = 0; i < 3; i++)
    visitorTrack("DIRECTIONS_CLICKED", "hapcheon", trip, {
      placeKey: "place:double",
    });
  await settle();
  assert.equal(count, 1);
});
test("complete analytics failure cannot throw through the visitor action", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as any;
  assert.doesNotThrow(() =>
    visitorTrack("ITINERARY_SAVE_SUCCEEDED", "hapcheon", trip, {
      placeKey: "place:offline",
    }),
  );
  await settle();
});
test("signed place evidence and matching search context follow detail to action", async () => {
  const calls: any[] = [];
  globalThis.fetch = (async (_url: any, options: any) => {
    calls.push(JSON.parse(options.body));
    return { status: 200 };
  }) as any;
  const context = {
    searchId: crypto.randomUUID(),
    resultSetId: crypto.randomUUID(),
  };
  rememberPlace(
    "hapcheon",
    { provider: "KAKAO", id: "test", analyticsProof: "signed-proof" },
    context,
  );
  visitorTrack("PLACE_DETAIL_OPENED", "hapcheon", trip, {
    placeKey: "provider:kakao:test",
  });
  visitorTrack("PHONE_CLICKED", "hapcheon", trip, {
    placeKey: "provider:kakao:test",
  });
  await settle();
  assert.equal(calls.length, 2);
  for (const row of calls) {
    assert.equal(row.searchId, context.searchId);
    assert.equal(row.resultSetId, context.resultSetId);
    assert.equal(row.placeProof, "signed-proof");
  }
});
test("entry and visit storage are region scoped; public query does not issue a marker", async () => {
  const h = visitFor("hapcheon"),
    g = visitFor("gajo");
  assert.notEqual(h.visitSessionId, g.visitSessionId);
  setEntry("hapcheon", "regional-qr:hapcheon");
  assert.equal(visitFor("hapcheon").entryId, "regional-qr:hapcheon");
  assert.equal(visitFor("gajo").entryId, undefined);
  assert.equal(session.getItem("analytics-marker:hapcheon"), null);
});
