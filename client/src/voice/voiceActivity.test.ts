import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VOICE_COPY, localizedVoiceState } from './voiceCopy.ts';
const activity=readFileSync(new URL('../components/VoiceActivity.tsx',import.meta.url),'utf8');
const page=readFileSync(new URL('../pages/ConciergePage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../index.css',import.meta.url),'utf8');
test('bilingual listening and completion announce the state, with separate stop and cancel actions',()=>{
  assert.equal(localizedVoiceState('LISTENING','ko'),'듣고 있어요. 말씀해 주세요.');
  assert.equal(localizedVoiceState('LISTENING','en'),'Listening. Please speak.');
  assert.equal(VOICE_COPY.ko.stop,'듣기 중지');
  assert.equal(VOICE_COPY.en.stop,'Stop Listening');
  for(const locale of ['ko','en'] as const){
    assert.notEqual(VOICE_COPY[locale].stop,VOICE_COPY[locale].cancel);
    assert.notEqual(localizedVoiceState('LISTENING',locale),localizedVoiceState('CONFIRMING',locale));
  }
  assert.match(localizedVoiceState('CONFIRMING','ko'),/듣기가 끝났어요/);
  assert.match(localizedVoiceState('CONFIRMING','en'),/Listening finished/);
});
test('persistent atomic live region announces transitions and decoration is hidden from assistive technology',()=>{
  assert.match(activity,/role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(activity,/aria-hidden="true"/);
  assert.equal((page.match(/<VoiceActivity /g)||[]).length,1);
  assert.doesNotMatch(page,/!voiceUnderstanding&&<VoiceActivity/);
  assert.match(activity,/state==='LISTENING'\?'listening'/);
});
test('decorative pulse is independent of audio samples and reduced motion retains static status',()=>{
  assert.doesNotMatch(activity,/AudioContext|AnalyserNode|getUserMedia|MediaRecorder|amplitude|volume/);
  assert.match(css,/@keyframes voice-listening-pulse/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  assert.match(css,/data-phase="complete"[\s\S]*border-radius: 6px/);
  assert.match(css,/data-phase="listening"[\s\S]*border-radius: 24px/);
});
