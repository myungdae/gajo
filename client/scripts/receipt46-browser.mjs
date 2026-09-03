import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const activityChecks=process.argv.includes('--activity');
const output=new URL(activityChecks?'../../docs/evidence/receipt-46-listening/':'../../docs/evidence/receipt-46/',import.meta.url);
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
async function openVoice(){await evaluate("if(document.querySelector('.now-secondary-actions'))document.querySelector('.now-secondary-actions button').click();else{if(!document.querySelector('.voice-mode-actions'))document.querySelector('.natural-language-entry button').click();}");await sleep(80);await evaluate("document.querySelector('.voice-mode-actions button').click()");await until("Boolean(document.querySelector('.voice-input-panel'))");}
async function click(selector){await until(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus();document.querySelector(${JSON.stringify(selector)}).click()`);await sleep(80);}
async function speech(text){await click('.speech-session-button');await evaluate(`window.__speech.instances.at(-1).emit(${JSON.stringify(text)});window.__speech.instances.at(-1).finish()`);await until("Boolean(document.querySelector('#voice-transcript'))");}
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
await click('.speech-session-button');
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
await openVoice();await click('.speech-session-button');
await evaluate("window.__lateEnd=window.__speech.instances.at(-1).onend;window.__speech.instances.at(-1).emit('late canceled request')");
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
await evaluate('window.__lateEnd()');assert.equal(chatCount(),baseline);
assert.equal(await evaluate("Boolean(document.querySelector('#voice-transcript'))"),false);
await openVoice();await click('.speech-session-button');
await evaluate("window.__lateEnd=window.__speech.instances.at(-1).onend;window.__speech.instances.at(-1).emit('leave now');document.querySelector('.bottom-nav a').click()");
await until("!document.querySelector('.concierge-conversation')");
await evaluate('window.__lateEnd()');assert.equal(chatCount(),baseline);
report.push({test:'permission denial, empty speech, error, speak again, editing, blank guard, cancel, Escape, unmount late events',passed:true});

await evaluate("localStorage.clear();sessionStorage.clear()");
await navigate('/hapcheon/concierge?mode=now');
await openVoice();await click('.speech-session-button');
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
   assert.equal(await evaluate('window.__speech.starts'),0,'no microphone before click');
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
 await openVoice();await click('.speech-session-button');
 assert.ok(await evaluate("Boolean(document.querySelector('.voice-error'))"));
 await click('.voice-mode-actions button:last-child');
 assert.ok(await evaluate("Boolean(document.querySelector('.concierge-unified-composer > textarea'))"));
 report.push({test:'unsupported browser → text input',locale,passed:true});
}
// Responsive checks include 200% equivalent CSS viewport (390×844 → 195×422).
for(const locale of ['ko','en']){
 for(const [width,height] of [[360,800],[390,700],[390,844],[844,390],[195,422]]){
  await evaluate("localStorage.clear();sessionStorage.clear()");
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
  await navigate('/hapcheon/concierge?mode=now'+(locale==='en'?'&lang=en':''));
  if(activityChecks){
    await openVoice();
    const readActivity=()=>evaluate("(()=>{const a=document.querySelector('.voice-activity'),s=a.querySelector('.voice-activity-symbol');return{phase:a.dataset.phase,text:a.textContent,live:a.getAttribute('aria-live'),atomic:a.getAttribute('aria-atomic'),animation:getComputedStyle(s,'::after').animationName,shape:getComputedStyle(a).borderRadius,color:getComputedStyle(a).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth||document.querySelector('.voice-input-panel').scrollWidth>document.querySelector('.voice-input-panel').clientWidth}})()");
    const waiting=await readActivity();
    assert.equal(waiting.phase,'waiting');assert.equal(waiting.animation,'none');
    await click('.speech-session-button');
    await until("document.querySelector('.voice-activity').dataset.phase==='listening'");
    const listening=await readActivity();
    assert.equal(listening.text,locale==='en'?'Listening. Please speak.':'듣고 있어요. 말씀해 주세요.');
    assert.equal(listening.animation,'voice-listening-pulse');assert.equal(listening.live,'polite');assert.equal(listening.atomic,'true');
    assert.notEqual(listening.shape,waiting.shape);assert.notEqual(listening.color,waiting.color);assert.equal(listening.overflow,false);
    assert.equal(await evaluate("document.querySelector('.speech-session-button').getAttribute('aria-label')"),locale==='en'?'Stop Listening':'듣기 중지');
    await evaluate("document.querySelector('.voice-activity').scrollIntoView({block:'start'})");await sleep(100);
    await writeFile(new URL('active-'+locale+'-'+width+'x'+height+'.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    const reduced=await readActivity();assert.equal(reduced.animation,'none');assert.equal(reduced.text,listening.text);
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await evaluate("window.__speech.instances.at(-1).emit('안녕하세요 지금 테스트 중입니다')");
    await click('.speech-session-button');
    await until("document.querySelector('.voice-activity').dataset.phase==='complete'");
    const complete=await readActivity();assert.equal(complete.animation,'none');assert.notEqual(complete.shape,listening.shape);assert.notEqual(complete.color,listening.color);assert.equal(complete.overflow,false);
    assert.equal(await evaluate("document.querySelector('#voice-transcript').value"),'안녕하세요 지금 테스트 중입니다');
    report.push({test:'listening pulse, stop to review, distinct phases, reduced motion and live announcements',locale,width,height,waiting,listening,complete,passed:true});
    await click('.voice-confirm-cancel');
  }  await openVoice();await speech(locale==='en'?'Find a quiet place with room for my family and somewhere nearby to eat after our visit.':'가족과 함께 조용히 쉴 수 있고 방문한 다음에 가까운 곳에서 식사할 수 있는 장소를 추천해 주세요.');
  await evaluate("document.querySelector('.voice-confirm-actions').scrollIntoView({block:'center'})");
  const layout=await evaluate(`(()=>{
    const nav=document.querySelector('.bottom-nav').getBoundingClientRect(),main=document.querySelector('.app-main').getBoundingClientRect();
    const panel=document.querySelector('.voice-input-panel');
    return{overflow:document.documentElement.scrollWidth>innerWidth||panel.scrollWidth>panel.clientWidth,
      overlap:main.bottom>nav.top+1,
      targets:[...panel.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent.trim(),height:b.getBoundingClientRect().height})),
      focusedLabel:document.activeElement?.id};
  })()`);
  assert.equal(layout.overflow,false,JSON.stringify({width,height,layout}));
  assert.equal(layout.overlap,false,JSON.stringify({width,height,layout}));
  assert.ok(layout.targets.every(b=>b.height>=44));
  await writeFile(new URL('review-'+locale+'-'+width+'x'+height+'.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  report.push({test:'responsive review',locale,width,height,...layout,passed:true});
 }
}
await writeFile(new URL('browser-report.json',output),JSON.stringify({syntheticSpeech:true,realMicrophone:false,checks:report,chatRequests:requests.filter(r=>r.path==='/api/concierge/chat').length},null,2));
console.log('PASS',report.length,'browser cases');
await call('Page.close');socket.close();
