import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const activityChecks=true;
const output=new URL('../../docs/evidence/receipt-46-dialog/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await fetch('http://127.0.0.1:9226/json/version').then(r=>r.json());
const socket=new WebSocket(browser.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0;const pending=new Map(),requests=[],report=[];
socket.addEventListener('message',async({data})=>{
 const msg=JSON.parse(data); if(msg.method==="Runtime.exceptionThrown")console.error(JSON.stringify(msg.params));
 if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}return;}
 if(msg.method==='Fetch.requestPaused'){
  const {request,requestId}=msg.params,url=new URL(request.url);let body={};try{body=JSON.parse(request.postData||'{}');}catch{}
  const region=body.regionId||url.searchParams.get('regionId')||'hapcheon',en=(body.locale||url.searchParams.get('locale'))==='en';
  requests.push({path:url.pathname,body});
  const id='https://'+(region==='gajo'?'gajo-wellness':region)+'.example/ontology#voice-place';
  const entity={entityId:id,regionId:region,label:en?'Test Visitor Place':'테스트 장소',latitude:35.568,longitude:128.165,category:'TOURIST_ATTRACTION',address:'Test address',actions:{navigate:{latitude:35.568,longitude:128.165},call:{phone:'000-000-0000'}}};
  let result={};
  if(url.pathname==='/api/concierge/chat')result={context:{regionId:region,contextNo:'fixture-context',raw:{input:body}},visitorMessage:en?'Here is a verified place for your trip.':'여행을 이어갈 장소를 찾았습니다.',intentRoute:'PLACE_DISCOVERY',discovery:{category:'TOURIST_ATTRACTION',regionId:region,entities:[entity,{...entity,entityId:id+'-2',label:en?'Another Visitor Place':'다른 테스트 장소'}]},usedAgents:[],risks:[]};
  else if(url.pathname==='/api/runtime-context/live')result={context:{regionId:region,currentTime:'14:30',temperature:23,weatherState:'CLOUDY'},metadata:{regionId:region,status:'LIVE',source:'FIXTURE'}};
  else if(url.pathname==='/api/nearby/status')result={configured:true,state:'READY',provider:'FIXTURE'};
  else if(url.pathname==='/api/nearby/anchors')result={results:[]};
  else if(url.pathname==='/api/facilities')result=[];
  else if(url.pathname==='/api/runtime-replanning/observe')result={events:[],impacts:[],replanningRecommended:false};
  if(url.pathname==='/api/concierge/chat')await new Promise(r=>setTimeout(r,250));
  await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(result)).toString('base64')},msg.sessionId);
 }
});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
const {targetId}=await send('Target.createTarget',{url:'about:blank'});
const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
const call=(m,p)=>send(m,p,sessionId);
const evaluate=async expression=>{
 const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);
 return r.result.value;
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(80);}throw new Error('Timeout: '+expression+' '+await evaluate('document.body.innerText'));};
await call('Page.enable');await call('Runtime.enable');
if(activityChecks)await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
await call('Fetch.enable',{patterns:[{urlPattern:'http://127.0.0.1:5176/api/*'}]});
await call('Network.enable');await call('Network.setBlockedURLs',{urls:['https://*']});
await call('Page.addScriptToEvaluateOnNewDocument',{source:`
if(!sessionStorage.getItem('receipt46-fixture')){localStorage.clear();sessionStorage.clear();sessionStorage.setItem('receipt46-fixture','1');}
window.__speech={instances:[],starts:0,aborts:0};
class FixtureRecognition{
 constructor(){window.__speech.instances.push(this);}
 start(){window.__speech.starts++;queueMicrotask(()=>this.onstart?.());}
 stop(){this.onend?.();}
 abort(){window.__speech.aborts++;}
 emit(text,final=true){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:final})]});}
 finish(){this.onend?.();}
 fail(error){this.onerror?.({error});}
}
window.SpeechRecognition=new URLSearchParams(location.search).has('unsupported')?undefined:FixtureRecognition;
window.webkitSpeechRecognition=undefined;
window.__external=[];window.open=(url)=>{window.__external.push(String(url));return null;};
`});
async function navigate(path){await call('Page.navigate',{url:'http://127.0.0.1:5176'+path});await until("Boolean(document.querySelector('.concierge-conversation'))");}
async function openVoice(){
 if(await evaluate("Boolean(document.querySelector('dialog[open]'))"))return;
 await evaluate("if(document.querySelector('.now-secondary-actions'))document.querySelector('.now-secondary-actions button').click();else if(document.querySelector('.voice-mode-actions'))document.querySelector('.voice-mode-actions button').click();else document.querySelector('.natural-language-entry button').click()");
 await sleep(80);
 if(!await evaluate("Boolean(document.querySelector('dialog[open]'))"))await evaluate("document.querySelector('.voice-mode-actions button').click()");
 await until("Boolean(document.querySelector('dialog[open]'))");
}
async function click(selector){await until(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus();document.querySelector(${JSON.stringify(selector)}).click()`);await sleep(80);}
async function speech(text){if(!await evaluate("document.querySelector('.voice-activity')?.dataset.phase==='listening'"))await click('.speech-session-button');await evaluate(`window.__speech.instances.at(-1).emit(${JSON.stringify(text)});window.__speech.instances.at(-1).finish()`);await until("Boolean(document.querySelector('#voice-transcript'))");}
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await navigate('/hapcheon/concierge?mode=now&lang=en');
await openVoice();
await speech('합천 카페 찾아줘');

await writeFile(new URL('initial.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
if(process.argv.includes('--inspect')){socket.close();process.exit(0);}

// The remainder asserts real React UI behavior with synthetic browser recognition.
const chatCount=()=>requests.filter(r=>r.path==='/api/concierge/chat').length;
assert.equal(chatCount(),0,'recognition must not send');
assert.equal(await evaluate("Object.values(localStorage).concat(Object.values(sessionStorage)).some(value=>value.includes('합천 카페 찾아줘'))"),false,'unconfirmed speech is not persisted');
const originalTrip=await evaluate("JSON.parse(localStorage.getItem('regional-concierge-trip-session-v1:hapcheon')).id");
async function edit(selector,text){await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(50);}
const ax=await call('Accessibility.getFullAXTree');
assert.ok(ax.nodes.some(node=>node.role?.value==='textbox'&&node.name?.value.includes('Recognized text')));
assert.ok(ax.nodes.some(node=>node.role?.value==='button'&&node.name?.value==='Send This Question'));
await edit('#voice-transcript','합천에서 조용한 카페 찾아줘');
await evaluate("const b=document.querySelector('.voice-confirm-actions .btn-primary');b.click();b.click()");
await until("Boolean(document.querySelector('.recommendation-row-trigger'))");
assert.equal(chatCount(),1);
assert.equal(requests.find(r=>r.path==='/api/concierge/chat').body.rawMessage,'합천에서 조용한 카페 찾아줘');
assert.equal(requests.find(r=>r.path==='/api/concierge/chat').body.locale,'en');
await click('.recommendation-row-trigger');

await writeFile(new URL('response.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
assert.equal(await evaluate("JSON.parse(localStorage.getItem('regional-concierge-trip-session-v1:hapcheon')).id"),originalTrip);
await click('.recommendation-inline-detail .entity-actions details summary');
await click('.recommendation-inline-detail .entity-actions details .tag-row button');
assert.equal(await evaluate('window.__external.length'),1,'navigation handoff');
assert.ok(await evaluate("document.querySelector('.recommendation-inline-detail a[href^=tel]').getAttribute('href')"),'phone available');
await evaluate("const a=document.querySelector('.recommendation-inline-detail a[href^=tel]');a.addEventListener('click',e=>e.preventDefault(),{once:true});a.click()");
await click('.recommendation-inline-detail .entity-actions > button');
await until("JSON.parse(localStorage.getItem('regional-concierge-trip-session-v1:hapcheon')).savedPlaces?.length>0");
await evaluate("[...document.querySelectorAll('.ai-response-actions button')].find(b=>/Other|다른/.test(b.textContent)).click()");
await sleep(120);
assert.ok(await evaluate("document.querySelector('.ai-response-actions').textContent.includes('Another Visitor Place')"));
const firstContext=requests.find(r=>r.path==='/api/concierge/chat').body.contextSessionId;
await evaluate("document.querySelector('.bottom-nav a[href*=nearby]').click()");
await until("location.pathname.includes('nearby')");
assert.equal(await evaluate("new URLSearchParams(location.search).get('lang')"),'en');
await evaluate('history.back()');
await until("Boolean(document.querySelector('.ai-response-actions'))");
assert.ok(await evaluate("document.querySelector('.ai-response-actions').textContent.includes('Another Visitor Place')"),'selected alternative restored');
assert.equal(await evaluate("JSON.parse(localStorage.getItem('regional-concierge-trip-session-v1:hapcheon')).id"),originalTrip);
await edit('.concierge-unified-composer > textarea','What else is nearby?');
await click('.concierge-submit');
await until("document.querySelectorAll('.chat-bubble.user').length>=2");
await sleep(400);
assert.equal(chatCount(),2);
assert.equal(requests.filter(r=>r.path==='/api/concierge/chat')[1].body.contextSessionId,firstContext);
assert.ok(requests.filter(r=>r.path==='/api/concierge/chat')[1].body.conversationalAnchor.entityId.endsWith('-2'));
report.push({test:'voice → review/edit → single send → recommendation → detail → navigation/phone/save → alternative → Nearby/back → follow-up',passed:true});

// Error, permission, cancellation and restart behavior in the real component.
await openVoice();
const baseline=chatCount();
await evaluate("document.querySelector('.voice-input-panel').scrollIntoView({block:'center'})");await sleep(200);
await writeFile(new URL('listening-en.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate("window.__speech.instances.at(-1).fail('not-allowed')");
await sleep(100);
await evaluate("document.querySelector('.voice-error').scrollIntoView({block:'center'})");
await writeFile(new URL('permission-denied-en.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
assert.ok(await evaluate("document.querySelector('.voice-error').textContent.includes('site settings')"));
await click('.speech-session-button');
await evaluate("window.__speech.instances.at(-1).finish()");
assert.ok(await evaluate("document.querySelector('.voice-error').textContent.includes('No speech')"));
await click('.speech-session-button');
await evaluate("window.__speech.instances.at(-1).fail('network')");
assert.ok(await evaluate("document.querySelector('.voice-error').textContent.includes('could not be recognized')"));
await speech('first draft');
await click('.voice-confirm-actions .btn-outline');
await evaluate("window.__speech.instances.at(-1).emit('replacement draft');window.__speech.instances.at(-1).finish()");
await until("document.querySelector('#voice-transcript')?.value==='replacement draft'");
await edit('#voice-transcript',' ');
assert.equal(await evaluate("document.querySelector('.voice-confirm-actions .btn-primary').disabled"),true);
await edit('#voice-transcript','cancel this');
await click('.voice-confirm-cancel');
assert.equal(chatCount(),baseline);
await openVoice();
await evaluate("window.__lateEnd=window.__speech.instances.at(-1).onend;window.__speech.instances.at(-1).emit('late canceled request')");
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
await evaluate('window.__lateEnd()');assert.equal(chatCount(),baseline);
assert.equal(await evaluate("Boolean(document.querySelector('#voice-transcript'))"),false);
await openVoice();
await evaluate("window.__lateEnd=window.__speech.instances.at(-1).onend;window.__speech.instances.at(-1).emit('leave now');document.querySelector('.bottom-nav a').click()");
await until("!document.querySelector('.concierge-conversation')");
await evaluate('window.__lateEnd()');assert.equal(chatCount(),baseline);
report.push({test:'permission denial, empty speech, error, speak again, editing, blank guard, cancel, Escape, unmount late events',passed:true});

await evaluate("localStorage.clear();sessionStorage.clear()");
await navigate('/hapcheon/concierge?mode=now');
await openVoice();
await evaluate("window.__lateEnd=window.__speech.instances.at(-1).onend;window.__speech.instances.at(-1).emit('언어 변경 중');[...document.querySelectorAll('.language-switch button')].find(b=>b.textContent==='English').click()");
await until("document.documentElement.lang==='en'");
await evaluate('window.__lateEnd()');
await until("!document.querySelector('#voice-transcript')");
assert.ok(await evaluate('window.__speech.aborts>0'));
await click('.speech-session-button');
assert.equal(await evaluate('window.__speech.instances.at(-1).lang'),'en-US');
await click('.voice-cancel');
report.push({test:'locale change cancels active recognition; next gesture uses en-US',passed:true});
for(const region of ['gajo','okcheon','muan','gyeryong','hapcheon','daejeon-junggu']){
 for(const locale of ['ko','en']){
  for(const mode of ['now','plan']){
   await evaluate("localStorage.clear();sessionStorage.clear()");
   await navigate('/'+region+'/concierge?mode='+mode+(locale==='en'?'&lang=en':''));
   await openVoice();
   assert.equal(await evaluate('window.__speech.starts'),1,'one gesture starts recognition');
   await speech(locale==='en'?'한국어로 말한 질문':'Find a quiet place');
   assert.equal(await evaluate('window.__speech.instances.at(-1).lang'),locale==='en'?'en-US':'ko-KR');
   const before=chatCount();
   await click('.voice-confirm-actions .btn-primary');
   await until("Boolean(document.querySelector('.recommendation-row-trigger'))");
   assert.equal(chatCount(),before+1);
   const request=requests.filter(r=>r.path==='/api/concierge/chat').at(-1).body;
   assert.equal(request.regionId,region);assert.equal(request.locale,locale);
   assert.equal(request.rawMessage,locale==='en'?'한국어로 말한 질문':'Find a quiet place');
   assert.equal(await evaluate(`JSON.parse(localStorage.getItem('regional-concierge-trip-session-v1:${region}')).mode`),mode.toUpperCase());
   report.push({region,locale,mode,passed:true});
  }
 }
}
for(const locale of ['ko','en']){
 await evaluate("localStorage.clear();sessionStorage.clear()");
 await navigate('/hapcheon/concierge?mode=now&unsupported=1'+(locale==='en'?'&lang=en':''));
 await openVoice();
 assert.ok(await evaluate("Boolean(document.querySelector('.voice-error'))"));
 await click('.voice-dialog-actions .btn-outline:not(.voice-cancel)');
 assert.ok(await evaluate("Boolean(document.querySelector('.concierge-unified-composer > textarea'))"));
 report.push({test:'unsupported browser → text input',locale,passed:true});
}
// All three phases share one fixed window; no document growth.
for(const locale of ['ko','en']){
 for(const [width,height] of [[360,800],[390,700],[390,844],[844,390],[195,422],[1200,900]]){
  await evaluate("localStorage.clear();sessionStorage.clear()");
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
  await navigate('/hapcheon/concierge?mode=now'+(locale==='en'?'&lang=en':''));
  await sleep(250);
  const before=await evaluate("({body:document.documentElement.scrollHeight,main:document.querySelector('.app-main').scrollHeight,scroll:document.querySelector('.app-main').scrollTop})");
  await openVoice();
  assert.equal(await evaluate('window.__speech.starts'),1);
  const layout=()=>evaluate("(()=>{const d=document.querySelector('dialog[open]'),r=d.getBoundingClientRect(),n=document.querySelector('.bottom-nav')?.getBoundingClientRect(),v=visualViewport;return{dialogs:document.querySelectorAll('dialog[open]').length,cancels:[...d.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Cancel'||b.textContent.trim()==='취소').length,overflow:d.scrollWidth>d.clientWidth,top:r.top,bottom:r.bottom,navTop:n?.top??innerHeight,viewportBottom:v.offsetTop+v.height,body:document.documentElement.scrollHeight,main:document.querySelector('.app-main').scrollHeight,scroll:document.querySelector('.app-main').scrollTop,targets:[...d.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height),phase:d.querySelector('.voice-activity').dataset.phase,animation:getComputedStyle(d.querySelector('.voice-activity-symbol'),'::after').animationName}})()");
  const check=async()=>{
    const l=await layout();
    assert.equal(l.dialogs,1);assert.equal(l.cancels,1);assert.equal(l.overflow,false);
    assert.ok(l.bottom<=Math.min(l.navTop,l.viewportBottom)+1);assert.ok(l.top>=-1);
    assert.equal(l.body,before.body);assert.equal(l.main,before.main);assert.equal(l.scroll,before.scroll);
    assert.ok(l.targets.every(h=>h>=44));
    return l;
  };
  const listening=await check();assert.equal(listening.animation,'voice-listening-pulse');
  await writeFile(new URL('listening-'+locale+'-'+width+'x'+height+'.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal((await check()).animation,'none');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await evaluate("const e=window.__speech.instances.at(-1),r=()=>Object.assign([{transcript:'안녕하세요 지금 테스트 중입니다'}],{isFinal:true});e.onresult({results:[r(),r(),r()]})");
  await click('.speech-session-button');
  await until("Boolean(document.querySelector('#voice-transcript'))");
  assert.equal(await evaluate("document.querySelector('#voice-transcript').value"),'안녕하세요 지금 테스트 중입니다');
  const review=await check();assert.equal(review.animation,'none');
  await writeFile(new URL('review-'+locale+'-'+width+'x'+height+'.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  // Simulate an iOS visual viewport reduced by the keyboard while layout height stays unchanged.
  await evaluate("window.__originalViewport=Object.getOwnPropertyDescriptor(window,'visualViewport');window.__realViewport=visualViewport;window.__keyboardViewport=Object.assign(new EventTarget(),{width:innerWidth,height:Math.min(360,innerHeight-100),offsetTop:0,offsetLeft:0});Object.defineProperty(window,'visualViewport',{configurable:true,value:window.__keyboardViewport});window.dispatchEvent(new Event('resize'))");
  await sleep(50);
  const keyboard=await layout();
  assert.ok(keyboard.bottom<=keyboard.viewportBottom+1);assert.ok(keyboard.top>=-1);assert.equal(keyboard.overflow,false);assert.equal(keyboard.cancels,1);
  await evaluate("if(window.__originalViewport)Object.defineProperty(window,'visualViewport',window.__originalViewport);else delete window.visualViewport;window.dispatchEvent(new Event('resize'))");
  await edit('#voice-transcript',locale==='en'?'A quiet place for my family':'가족과 함께 조용히 쉴 곳을 찾아주세요');
  await click('.voice-confirm-actions .btn-outline:not(.voice-cancel)');
  await until("document.querySelector('.voice-activity').dataset.phase==='listening'");
  assert.equal((await check()).cancels,1);
  await click('.voice-cancel');
  assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"),0);
  report.push({test:'one gesture, compact listening/review/restart, one cancel, deduplication, stable body, keyboard bounds, reduced motion',locale,width,height,listening,review,keyboard,passed:true});
 }
}
await writeFile(new URL('browser-report.json',output),JSON.stringify({syntheticSpeech:true,realMicrophone:false,checks:report,chatRequests:requests.filter(r=>r.path==='/api/concierge/chat').length},null,2));
console.log('PASS',report.length,'browser cases');
await call('Page.close');socket.close();
