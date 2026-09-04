import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECOMMENDATION_REQUEST_COPY as copy } from './recommendationRequestCopy.ts';
import { REGION_CONFIGS } from './regionConfig.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const page=read('./pages/ConciergePage.tsx'),live=read('./components/GajoLiveStatus.tsx');
test('approved Korean labels and complete English equivalents distinguish two actions',()=>{
  assert.equal(copy.ko.automatic,'현재 상황으로 다시 추천받기');
  assert.equal(copy.ko.automaticHelp,'현재 위치·시간·날씨와 여행 상황을 반영해 다시 추천해 드립니다.');
  assert.equal(copy.ko.directTitle,'추가로 원하는 것이 있으신가요?');
  assert.equal(copy.ko.voice,'말로 요청하기');assert.equal(copy.ko.text,'글자로 요청하기');
  for(const key of Object.keys(copy.ko) as Array<keyof typeof copy.ko>)assert.ok(copy.en[key]);
  for(const fact of ['location','time','weather','trip context'])assert.ok(copy.en.automaticHelp.includes(fact));
  assert.equal(copy.en.directTitle,'Anything else you’d like?');assert.equal(copy.en.voice,'Speak a Request');assert.equal(copy.en.text,'Type a Request');
});
test('all regional screens use the shared locale copy without the retired follow-up label',()=>{
  assert.equal(Object.keys(REGION_CONFIGS).length,6);
  assert.doesNotMatch(page+read('./managedVisitorCopy.ts'),/이어서 물어보기|Continue the conversation|Ask a Follow-up/);
  assert.match(page,/requestCopy.title/);
  assert.match(live,/RECOMMENDATION_REQUEST_COPY\[language\]/);
});
test('refresh performs current-context lookup then one existing send, without a navigation detour or new analytics',()=>{
  const action=page.slice(page.indexOf('<section className="card runtime-journey-card">'),page.indexOf('<details className="demo-tools">'));
  assert.match(action,/actionOnly/);assert.match(action,/onLiveRefresh=\{live=>send\(RECOMMENDATION_REQUEST_COPY\[language\]\.automaticRequest,\{\.\.\.live.context,regionId:region.id\}\)\}/);
  assert.doesNotMatch(action,/navigate\(|track\(/);
  assert.match(live,/await fetchLiveRuntimeContext/);assert.match(live,/await onLiveRefresh\(response\)/);
  assert.match(live,/if\(notify&&\(refreshPending.current\|\|disabled\)\)return/);
  assert.match(live,/if\(liveEnabled&&!actionOnly\)void refresh\(false\)/);
});
test('direct request controls reuse voice popup and composer handlers with no duplicate headings',()=>{
  assert.match(page,/requestUi.followup/);
  assert.match(page,/requestUi.text/);
  assert.match(page,/onClick=\{openVoice\}>\{RECOMMENDATION_REQUEST_COPY\[language\]\.voice\}/);
  assert.match(page,/onClick=\{openText\}>\{requestCopy.text\}/);
  assert.match(page,/onConfirm=\{\(\)=>send\(voiceDraft,undefined,false,voiceUnderstanding\|\|undefined\)\}/);
  assert.equal((page.match(/<VoiceInputDialog /g)||[]).length,1);
  const css=read('./index.css');assert.match(css,/\.automatic-recommendation-choice\s*\{/);assert.match(css,/\.direct-request-choice\s*\{/);assert.match(css,/\.direct-request-choice\[hidden\]/);
});
