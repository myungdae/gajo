import test from "node:test";
import assert from "node:assert/strict";
import { createTripSession, saveTripSession } from "./tripSession.ts";
import { JOURNEY_OPTIONS, RUNTIME_JOURNEY_NAME, journeyRequest, rememberRuntimeIntro, runtimeIntroSeen, startRuntimeJourney } from "./runtimeJourney.ts";

const storage = () => { const values = new Map<string,string>(); return { getItem:(key:string)=>values.get(key)||null, setItem:(key:string,value:string)=>void values.set(key,value) }; };

test("official concept names and stable bilingual goals remain exact", () => {
  assert.deepEqual(RUNTIME_JOURNEY_NAME, { ko: "지금맞춤 지역여정", en: "Runtime-Adaptive Regional Journey" });
  assert.deepEqual(JOURNEY_OPTIONS.goal.map(row => row[0]), ["FOOD", "CAFE", "NEXT_PLACE", "EVENT_TODAY"]);
  assert.deepEqual(JOURNEY_OPTIONS.goal.map(row => row[2]), ["Eat", "Rest at a Café", "Find the Next Place", "Events Today"]);
});

test("goal stays separate from optional companion and mobility preferences", () => {
  const request = journeyRequest({ goal:"CAFE", companion:"PARENTS", duration:"HALF_DAY", transport:"CAR", walking:"LOW" }, "en");
  assert.deepEqual(request.context.activityPreferences, ["CAFE"]);
  assert.equal(request.context.companions?.[0].relationship, "parent");
  assert.deepEqual(request.context.companionConstraints, ["shortWalkingDistance"]);
  assert.equal(request.planned.transportMode, "CAR");
  assert.match(request.text, /Rest at a Café/);
});

test("a small adjustment exposes only changed planned fields", () => {
  const request = journeyRequest({ replacePlace:true }, "ko");
  assert.match(request.text, /장소 하나 바꾸기/);
  assert.deepEqual(Object.entries(request.planned).filter(([,value])=>value!==undefined), []);
});

test("introduction is automatic once and remains explicitly reopenable", () => {
  const store = storage();
  assert.equal(runtimeIntroSeen(store as any), false);
  rememberRuntimeIntro(store as any);
  assert.equal(runtimeIntroSeen(store as any), true);
});

test("start moves a verified regional first step into actual execution", () => {
  const store = storage();
  saveTripSession(createTripSession("hapcheon"), store as any);
  const result = startRuntimeJourney("hapcheon", { steps:[{ entityId:"place:a", regionId:"hapcheon" },{ entityId:"place:b", regionId:"hapcheon" }] }, store as any);
  assert.equal(result?.execution?.currentEntityId, "place:a");
  assert.equal(result?.execution?.statusByEntityId["place:a"], "EN_ROUTE");
  assert.equal(result?.execution?.statusByEntityId["place:b"], "PLANNED");
  assert.equal(startRuntimeJourney("hapcheon", { steps:[{ entityId:"place:x", regionId:"muan" }] }, store as any), undefined);
});
