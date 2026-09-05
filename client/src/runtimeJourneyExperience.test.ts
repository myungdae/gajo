import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("home distinguishes an active itinerary, saved context and a first journey",()=>{
  const home=read("./pages/HomePage.tsx"),continuity=read("./components/TripContinuity.tsx"),entry=read("./components/RuntimeJourneyEntry.tsx"),contract=read("./runtimeJourney.ts");
  assert.match(home,/hasTripContext&&<TripContinuity onNewTrip=/);
  assert.match(home,/hasActiveTrip=hasActiveItinerary\(activeTrip\)/);
  assert.match(home,/hasTripContext=Boolean\(activeTrip&&hasTripEvidence\(activeTrip\)\)/);
  assert.match(continuity,/\{active&&<button[\s\S]*TRIP_CONTINUED/);
  assert.match(continuity,/현재 상황으로 여정 만들기/);
  assert.match(home,/RuntimeJourneyEntry/);
  assert.doesNotMatch(home,/COMPANION_FRIENDLY/);
  for(const text of ["밥 먹기","카페에서 쉬기","숙소 찾기","다음 장소 찾기","오늘 행사","내 여정 만들기"])assert.match(contract,new RegExp(text));
  assert.match(entry,/JOURNEY_OPTIONS\.goal/);
  assert.ok(home.indexOf('className={`spotlight-card')<home.indexOf('hasTripContext&&<TripContinuity'), 'home welcome must precede saved-trip continuity');
});

test("result order puts understanding, journey and actions before optional other request",()=>{
  const page=read("./pages/ConciergePage.tsx");
  const understood=page.indexOf("<UnderstoodContext"),title=page.indexOf("지금맞춤 지역여정",understood),result=page.indexOf("<ResultPanel",title),actions=page.indexOf("<RuntimeJourneyResultActions",result);
  assert.ok(understood>0&&title>understood&&result>title&&actions>result);
  assert.doesNotMatch(page,/NowImmediateActions/);
  assert.doesNotMatch(page,/조건을 선택해서 일정 만들기/);
});

test("replanning is structured and free voice or text remains explicitly requested",()=>{
  const result=read("./components/RuntimeJourneyResultActions.tsx"),page=read("./pages/ConciergePage.tsx"),voice=read("./components/VoiceInputDialog.tsx");
  for(const text of ["추천 장소","어느 장소를 바꿀까요","다른 장소 추천","선택한 조건으로 다시 구성"])assert.match(result,new RegExp(text));
  assert.match(result,/copy\.other/);
  assert.match(result,/setAdjusting\(false\);setCategory\(null\);onOther\(\)/);
  assert.match(result,/category&&category!=='place'/);
  assert.match(page,/otherRequestOpen/);
  assert.match(page,/VoiceInputDialog/);
  assert.match(voice,/onConfirm/);
});

test("legacy and current recommendations require a verified step before journey actions",()=>{
  const contract=read("./runtimeJourney.ts"),page=read("./pages/ConciergePage.tsx"),actions=read("./components/RuntimeJourneyResultActions.tsx");
  assert.match(contract,/recommendation\?\.itinerary\?\.steps\?\?recommendation\?\.steps/);
  assert.match(page,/journeySteps\.length>0&&<RuntimeJourneyResultActions/);
  assert.match(page,/검증된 장소가 부족하거나 선택한 조건이 좁을 수 있어요/);
  assert.match(page,/journeySteps\.length>0&&<h1>/);
  assert.match(page,/조건에 맞는 여정을 찾지 못했어요/);
  assert.match(page,/runtimeJourneySteps\(result\.recommendation\)\.length/);
  assert.match(actions,/startRuntimeJourney\(region\.id, result\.recommendation\)/);
});

test("other request and adjustment controls are mutually exclusive beside results",()=>{
  const actions=read("./components/RuntimeJourneyResultActions.tsx"),page=read("./pages/ConciergePage.tsx");
  assert.match(actions,/onCloseOther\(\);setAdjusting/);
  assert.match(actions,/otherOpen&&<div className="runtime-other-request"/);
  assert.match(page,/onVoice=\{\(\)=>\{setOtherRequestOpen\(false\);openVoice\(\)\}\}/);
  assert.match(page,/onText=\{\(\)=>\{setOtherRequestOpen\(false\);openText\(\)\}\}/);
});

test("an empty journey explains recovery and every offered action is wired",()=>{
  const page=read("./pages/ConciergePage.tsx"),css=read("./components/runtime-empty-journey.css");
  for(const text of ["조건에 맞는 여정을 찾지 못했어요","목적·조건 다시 선택","숙소 찾기","같은 조건으로 다시 찾기"])assert.match(page,new RegExp(text));
  assert.match(page,/setEmptyJourneyEditOpen/);
  assert.match(page,/journeyRequest\(\{goal:'ACCOMMODATION'\}/);
  assert.match(page,/lastRequestRef\.current/);
  assert.match(css,/runtime-empty-primary/);
});

test("responsive entry uses 44px targets, dynamic viewport and reduced motion support",()=>{
  const css=read("./components/runtime-journey.css");
  assert.match(css,/min-height:44px/);
  assert.match(css,/80dvh/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/minmax\(0,1fr\)/);
});

test("runtime analytics names distinguish request, presentation, start, adjustment and replan",()=>{
  const analytics=read("./visitorAnalytics.ts"),contract=read("../../server/src/analytics/visitor-contract.ts");
  for(const event of ["RUNTIME_JOURNEY_REQUESTED","RUNTIME_JOURNEY_PRESENTED","RUNTIME_JOURNEY_STARTED","RUNTIME_JOURNEY_ADJUSTMENT_OPENED","RUNTIME_JOURNEY_REPLAN_REQUESTED"]){assert.match(analytics,new RegExp(event));assert.match(contract,new RegExp(event));}
  assert.doesNotMatch(analytics,/RUNTIME_JOURNEY_ARRIVED/);
});
