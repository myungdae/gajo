import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requestPresentation, shouldOfferContextRefresh, REQUEST_PRESENTATION_COPY } from './conversationPresentation.ts';
const page=readFileSync(new URL('./pages/ConciergePage.tsx',import.meta.url),'utf8');
test('entry, explicit text, voice, processing and result states never repeat input surfaces',()=>{
  assert.deepEqual(requestPresentation(false,false,false,false),{intro:true,followup:false,text:false,voice:false});
  for(const result of [false,true]) {
    assert.deepEqual(requestPresentation(result,true,true,true),{intro:false,followup:false,text:false,voice:false});
    assert.deepEqual(requestPresentation(result,false,true,true),{intro:false,followup:false,text:false,voice:true});
    assert.deepEqual(requestPresentation(result,false,true,false),{intro:false,followup:false,text:true,voice:false});
  }
  assert.deepEqual(requestPresentation(true,false,false,false),{intro:false,followup:true,text:false,voice:false});
});
test('ordinary results never invent a refresh need; explicit signals allow it',()=>{
  assert.equal(shouldOfferContextRefresh({recommendation:{}},false),false);
  assert.equal(shouldOfferContextRefresh({replanningRecommended:true},false),true);
  assert.equal(shouldOfferContextRefresh(undefined,true),true);
});
test('restored results default closed and send closes inputs without changing safe voice confirmation',()=>{
  assert.match(page,/restored\?\.messages.some\(message=>Boolean\(message.result\)\) \? false/);
  assert.match(page,/const activeVoice=voiceModel\|\|voiceUnderstanding;\s*setFreeTextOpen\(false\);\s*setVoiceOpen\(false\);/);
  assert.doesNotMatch(page,/hasCompletedTurn \|\| freeTextOpen/);
  assert.match(page,/requestUi.text &&/);assert.match(page,/requestUi.voice&&<VoiceInputDialog/);
  assert.match(page,/onConfirm=\{\(\)=>send\(voiceDraft,undefined,false,voiceUnderstanding\|\|undefined\)\}/);
  assert.ok(page.indexOf('<PlaceDiscoveryPanel')<page.indexOf('requestUi.followup'));
  assert.match(page,/shouldOfferContextRefresh\(currentResult,Boolean\(locationFreshnessNotice\)\)/);
});
test('both languages explain only first entry and label optional requests separately',()=>{
  assert.equal(REQUEST_PRESENTATION_COPY.ko.title,'무엇을 도와드릴까요?');
  assert.equal(REQUEST_PRESENTATION_COPY.ko.voice,'다른 요청 말하기');
  assert.equal(REQUEST_PRESENTATION_COPY.ko.text,'다른 요청 입력하기');
  for(const key of Object.keys(REQUEST_PRESENTATION_COPY.ko) as Array<keyof typeof REQUEST_PRESENTATION_COPY.ko>)assert.ok(REQUEST_PRESENTATION_COPY.en[key]);
});
