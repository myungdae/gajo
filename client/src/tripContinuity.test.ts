import test from "node:test";
import assert from "node:assert/strict";
import { createTripSession, loadTripSession, saveTripSession } from "./tripSession.ts";
import { hasActiveItinerary, itineraryItemCount, reconcileTrip } from "./tripContinuity.ts";
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
test("a newer empty server full-journey never overwrites a richer local journey",()=>{const local={...createTripSession("hapcheon"),itinerary:{savedAsFullJourney:true,journeyId:"local",steps:[{entityId:"a"},{entityId:"b"}]},savedPlaces:[],execution:{currentEntityId:"a",statusByEntityId:{a:"READY" as const}},plannedContext:{interests:["HAPCHEON_LAKE"]},updatedAt:"2026-08-01T00:00:00Z"},remote={...local,itinerary:{savedAsFullJourney:true,journeyId:"empty-server",steps:[]},execution:undefined,plannedContext:undefined,updatedAt:"2026-08-22T00:00:00Z"};const restored=reconcileTrip(local,remote);assert.deepEqual((restored.itinerary as any).steps,local.itinerary.steps);assert.equal(restored.execution?.currentEntityId,"a");assert.deepEqual(restored.plannedContext,local.plannedContext)});
test("server-sync persistence cannot replace richer local bytes with an empty remote copy",()=>{const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>data.set(key,value)},local=saveTripSession({...createTripSession("hapcheon"),itinerary:{savedAsFullJourney:true,steps:[{entityId:"a"},{entityId:"b"}]},savedPlaces:[{entityId:"c"}],execution:{currentEntityId:"a"}},storage as any),remote={...local,itinerary:{savedAsFullJourney:true,steps:[]},savedPlaces:[],execution:undefined,updatedAt:"2099-01-01T00:00:00Z"},merged=reconcileTrip(local,remote);saveTripSession(merged,storage as any);const reopened=loadTripSession(storage as any,"hapcheon")!;assert.equal(itineraryItemCount(reopened),3);assert.equal((reopened.itinerary as any).steps.length,2);assert.equal(reopened.execution?.currentEntityId,"a")});
test("continuation is shown only for a saved full journey with a canonical step",()=>{
  const empty=createTripSession("hapcheon"),planned={...empty,plannedContext:{duration:"DAY" as const}},saved={...empty,savedPlaces:[{entityId:"saved-only"}]},draft={...empty,itinerary:{steps:[{entityId:"draft-only"}]}},journey={...empty,itinerary:{savedAsFullJourney:true,steps:[{entityId:"journey-step"}]}};
  assert.equal(hasActiveItinerary(empty),false);
  assert.equal(hasActiveItinerary(planned),false);
  assert.equal(hasActiveItinerary(saved),false);
  assert.equal(hasActiveItinerary(draft),false);
  assert.equal(hasActiveItinerary(journey),true);
});
test("entity evolution keeps legacy URI-shaped saved items visible",()=>{const session={...createTripSession("hapcheon"),itinerary:{savedAsFullJourney:true,steps:[{uri:"https://hapcheon.example/ontology#legacy",name:"이전 합천 장소"}]},savedPlaces:[{canonicalEntityUri:"https://hapcheon.example/ontology#saved-legacy",name:"이전 저장 장소"}]};assert.equal(itineraryItemCount(session),2)});
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
