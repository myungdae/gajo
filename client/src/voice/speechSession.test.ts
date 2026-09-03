import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechSession } from './speechSession.ts';
import { acceptVoiceResult } from './voiceUx.ts';
import { VOICE_COPY } from './voiceCopy.ts';
function fixture(locale:'ko'|'en'='ko'){
  const states:string[]=[],drafts:string[]=[],finals:string[]=[],errors:string[]=[];
  const engine:any={starts:0,stops:0,aborts:0,start(){this.starts++;},stop(){this.stops++;},abort(){this.aborts++;}};
  const session=createSpeechSession({create:()=>engine,locale,onState:s=>states.push(s),onDraft:s=>drafts.push(s),onFinal:s=>finals.push(s),onError:s=>errors.push(s)});
  const result=(text:string,isFinal=true)=>engine.onresult?.({results:[Object.assign([{transcript:text}],{isFinal})]});
  return {session,engine,states,drafts,finals,errors,result};
}
test('recognition starts only on explicit start and repeated clicks start once',()=>{
  const f=fixture();assert.equal(f.engine.starts,0);f.session.start();f.session.start();assert.equal(f.engine.starts,1);
  f.engine.onstart();assert.equal(f.states.at(-1),'LISTENING');
});
test('ko-KR and en-US select recognition hints without translating spoken text',()=>{
  for(const [locale,lang,text] of [['ko','ko-KR','Find a café'],['en','en-US','합천 카페 찾아줘']] as const){
    const f=fixture(locale);f.session.start();assert.equal(f.engine.lang,lang);
    f.result(text);assert.deepEqual(f.finals,[]);f.engine.onend();
    assert.deepEqual(f.finals,[text]);assert.equal(f.states.at(-1),'CONFIRMING');
  }
});
test('interim speech is reviewable, final duplicates never double the question',()=>{
  const f=fixture();f.session.start();f.result('카페',false);assert.deepEqual(f.drafts,['카페']);
  f.result('카페 찾아줘');f.result('카페 찾아줘');const lateEnd=f.engine.onend;lateEnd();lateEnd();
  assert.deepEqual(f.finals,['카페 찾아줘']);
});
test('stop settles once and empty results never produce a question',()=>{
  const f=fixture();f.session.start();f.session.stop();f.session.stop();assert.equal(f.engine.stops,1);
  f.engine.onend();assert.deepEqual(f.finals,[]);assert.deepEqual(f.errors,['empty']);
});
test('all recognition failures terminate the microphone and ignore late results',()=>{
  for(const error of ['not-allowed','service-not-allowed','no-speech','network','audio-capture','language-not-supported','aborted']){
    const f=fixture();f.session.start();const lateEnd=f.engine.onend,lateResult=f.engine.onresult;
    f.result('do not send');f.engine.onerror({error});
    lateResult({results:[Object.assign([{transcript:'late'}],{isFinal:true})]});lateEnd();
    assert.deepEqual(f.finals,[]);assert.equal(f.engine.aborts,1);
    assert.equal(f.states.at(-1),error.includes('allowed')?'PERMISSION_DENIED':'RECOVERABLE_ERROR');
  }
});
test('cancel and unmount cleanup detach callbacks and never submit, even after partial results',()=>{
  const f=fixture();f.session.start();f.result('취소할 질문');const end=f.engine.onend;
  f.session.cancel();f.session.cancel();end();assert.equal(f.engine.aborts,1);
  assert.deepEqual(f.finals,[]);assert.equal(f.engine.onresult,null);
});
test('speak again uses a fresh session with no previous transcript',()=>{
  const first=fixture();first.session.start();first.result('처음');first.engine.onend();
  const next=fixture();next.session.start();next.result('수정한 질문');next.engine.onend();
  assert.deepEqual(next.finals,['수정한 질문']);
});
test('startup exceptions recover without submitting',()=>{
  const states:string[]=[],errors:string[]=[];
  const s=createSpeechSession({create:()=>{throw new Error('unavailable');},locale:'en',onState:s=>states.push(s),onError:e=>errors.push(e),onDraft:()=>assert.fail(),onFinal:()=>assert.fail()});
  s.start();assert.deepEqual(errors,['error']);assert.equal(states.at(-1),'RECOVERABLE_ERROR');
});
test('empty, repeated and any in-flight result are blocked',()=>{
  assert.equal(acceptVoiceResult(null,' ',0,false).accepted,false);
  assert.equal(acceptVoiceResult(null,'new',0,true).accepted,false);
  const first=acceptVoiceResult(null,'question',0,false);
  assert.equal(acceptVoiceResult(first.next,'question',1,false).accepted,false);
});
test('all voice states errors and controls have built-in bilingual copy',()=>{
  for(const locale of ['ko','en'] as const){
    for(const text of Object.values(VOICE_COPY[locale].states))assert.ok(text.length);
    for(const key of ['start','stop','confirm','again','cancel','text','permission','unsupported','error','empty'] as const)assert.ok(VOICE_COPY[locale][key]);
  }
  assert.match(VOICE_COPY.en.permission,/site settings/);assert.match(VOICE_COPY.ko.permission,/사이트 설정/);
});
