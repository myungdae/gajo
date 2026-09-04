import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("home prioritizes active journey continuity or one integrated goal entry",()=>{
  const home=read("./pages/HomePage.tsx"),entry=read("./components/RuntimeJourneyEntry.tsx"),contract=read("./runtimeJourney.ts");
  assert.match(home,/hasActiveTrip\?<><TripContinuity onNewTrip=/);
  assert.match(home,/RuntimeJourneyEntry/);
  assert.doesNotMatch(home,/COMPANION_FRIENDLY/);
  for(const text of ["밥 먹기","카페에서 쉬기","다음 장소 찾기","오늘 행사","내 여정 만들기"])assert.match(contract,new RegExp(text));
  assert.match(entry,/JOURNEY_OPTIONS\.goal/);
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
  for(const text of ["장소 하나 바꾸기","선택한 조건으로 다시 구성"])assert.match(result,new RegExp(text));
  assert.match(result,/copy\.other/);
  assert.match(page,/otherRequestOpen/);
  assert.match(page,/VoiceInputDialog/);
  assert.match(voice,/onConfirm/);
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
