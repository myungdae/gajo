import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page=readFileSync(new URL("./pages/ConciergePage.tsx",import.meta.url),"utf8");
const confirmation=readFileSync(new URL("./components/VoiceConfirmation.tsx",import.meta.url),"utf8");
const actions=readFileSync(new URL("./nowQuickActions.ts",import.meta.url),"utf8");

test("NOW starts with one common action hub and secondary manual controls",()=>{
  for(const label of ["식당 찾기","카페 찾기","관광지 찾기","숙소 찾기","다음 일정 추천","일정 바꾸기"])assert.match(actions,new RegExp(label));
  for(const label of ["RECOMMENDATION_REQUEST_COPY","directTitle","onVoice","onText"])assert.match(page,new RegExp(label));
  assert.match(page,/action\.kind==="NEARBY"\?onNearby/);
  assert.match(page,/tripMode !== "NOW"/);
});

test("retired default prompts and multi-field confirmation are not rendered",()=>{
  for(const copy of ["다른 조건도 말씀해 주세요","비가 와 / 배고파 / 카페 가고 싶어","편하게 말씀해 주세요","요청 확인 필요","종류 확인 필요","검색 기준 지역 확인"])assert.doesNotMatch(page,new RegExp(copy));
  assert.doesNotMatch(confirmation,/voice-slots|<input|취소하고 글자로 입력|이 내용으로 실행/);
  assert.match(confirmation,/<textarea/);assert.match(confirmation,/onChange\(event.target.value\)/);assert.match(readFileSync(new URL("./components/VoiceInputDialog.tsx",import.meta.url),"utf8"),/disabled=\{sending\|\|!text.trim\(\)\}/);
});

test("cancel closes manual entry without changing trip or region",()=>{
  assert.match(page,/setManualEntryMode\(null\);setFreeTextOpen\(false\)/);
  assert.doesNotMatch(confirmation,/saveTripSession|confirmTripLocation/);
});
