import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
after(()=>vite.close());
const {default:Entry}=await vite.ssrLoadModule('/src/components/RuntimeJourneyEntry.tsx');
const {default:Next}=await vite.ssrLoadModule('/src/components/JourneyConciergeNext.tsx');
const {AdminRegionProvider}=await vite.ssrLoadModule('/src/RegionContext.tsx');
const {RegionalLanguageProvider}=await vite.ssrLoadModule('/src/RegionalLanguageContext.tsx');
const {api}=await vite.ssrLoadModule('/src/api/client.ts');
const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>');
window.location={pathname:'/hapcheon/concierge',search:'?mode=now',hostname:'localhost',href:'http://localhost/hapcheon/concierge?mode=now'};
class MemoryStorage { values=new Map(); getItem(k){return this.values.get(k)||null}setItem(k,v){this.values.set(k,v)}removeItem(k){this.values.delete(k)}clear(){this.values.clear()} }
Object.assign(globalThis,{window,document,HTMLElement:window.HTMLElement,Node:window.Node,CustomEvent:window.CustomEvent,
  localStorage:new MemoryStorage(),sessionStorage:new MemoryStorage(),IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:fn=>setTimeout(fn,0)});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:window.navigator});
const trip=()=>({id:'00000000-0000-4000-8000-000000000055',anonymousTripId:'00000000-0000-4000-8000-000000000055',regionId:'hapcheon',mode:'NOW',language:'ko',
  createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),plannedContext:{companions:[{relationship:'parent',age:70,healthConditions:['kneePain']}],transportMode:'CAR',stayUntil:'18:00'},
  locationContext:{now:{status:'CONFIRMED',source:'MANUAL',latitude:35.5,longitude:128,accuracy:20,observedAt:new Date().toISOString(),confirmedAt:new Date().toISOString()}}});
const setup=()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('regional-concierge-trip-session-v1:hapcheon',JSON.stringify(trip()))};
const render=(component)=>React.createElement(MemoryRouter,{initialEntries:['/hapcheon/concierge?mode=now']},React.createElement(AdminRegionProvider,{region:{id:'hapcheon',regionName:'합천',serviceName:'여행도우미'}},React.createElement(RegionalLanguageProvider,null,component)));
const click=async(text)=>act(async()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,text);button.click()});

test('compact chips preselect known context and only commit changed preferences',async()=>{
  setup();let submitted;
  const root=createRoot(document.querySelector('#root'));
  try {
    await act(async()=>root.render(render(React.createElement(Entry,{loading:false,onCreate:(...args)=>submitted=args,onDirect(){}}))));
    assert.equal([...document.querySelectorAll('button')].find(b=>b.textContent==='부모님과').getAttribute('aria-pressed'),'true');
    await click('카페');
    assert.equal(submitted,undefined);
    await click('이 조건으로 여행 만들기');
    assert.deepEqual(submitted[1].companions,trip().plannedContext.companions);
    assert.equal(submitted[1].stayUntil,'18:00');assert.equal(submitted[1].transportMode,'CAR');
    assert.deepEqual(submitted[1].activityPreferences,['CAFE']);
    assert.equal(document.querySelector('[role="dialog"]'),null);
  } finally {await act(async()=>root.unmount())}
});

test('proactive offers use existing actions and cannot repeat after dismissal or remount',async()=>{
  setup();const events=[];
  api.defaults.adapter=async config=>{
    events.push(config.url);
    return {status:200,statusText:'OK',headers:{},config,data:config.url.includes('local-discovery')?{offers:[
      {entityId:'fixture:experience',regionId:'hapcheon',label:'테스트 경험',reason:'테스트 근거',actions:{navigate:{latitude:35.5,longitude:128}}},
    ]}:config.method==='get'?[]:{channels:[],items:[],success:true}};
  };
  let root=createRoot(document.querySelector('#root'));
  try {
    await act(async()=>{root.render(render(React.createElement(Next,{busy:false,onReplan(){}})));await new Promise(r=>setTimeout(r,30))});
    assert.ok(document.querySelector('.local-discovery-offer'),JSON.stringify({events,html:document.body.innerHTML}));
    assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='내 여행에 담기'));
    assert.equal(events.filter(url=>url==='/partners/recommendations').length,1);
    await click('괜찮아요, 원래대로');
    assert.equal(document.querySelector('.local-discovery-offer'),null);
    await act(async()=>root.unmount());
    root=createRoot(document.querySelector('#root'));
    await act(async()=>{root.render(render(React.createElement(Next,{busy:false,onReplan(){}})));await new Promise(r=>setTimeout(r,30))});
    assert.equal(document.querySelector('.local-discovery-offer'),null);
    assert.equal(events.filter(url=>url==='/partners/recommendations').length,1);
    assert.equal(events.some(url=>/benefit|redemption|confirm/.test(url)),false);
  } finally {await act(async()=>root.unmount())}
});

const {default:Home}=await vite.ssrLoadModule('/src/pages/HomePage.tsx');
const {getRegionConfig}=await vite.ssrLoadModule('/src/regionConfig.ts');
const {saveTripSession}=await vite.ssrLoadModule('/src/tripSession.ts');
for(const returning of [false,true])test(`home keeps primary text and voice before secondary context: returning=${returning}`,async()=>{
  setup();if(!returning)localStorage.clear();
  api.defaults.adapter=async config=>({status:200,statusText:'OK',headers:{},config,data:config.url.includes('anonymous-trips')?{state:trip()}:config.url.includes('action-channels')?[]:{}});
  const root=createRoot(document.querySelector('#root'));
  try{
    await act(async()=>{root.render(React.createElement(MemoryRouter,{initialEntries:['/hapcheon?lang=ko']},React.createElement(AdminRegionProvider,{region:getRegionConfig('hapcheon')},React.createElement(RegionalLanguageProvider,null,React.createElement(Home)))));await new Promise(r=>setTimeout(r,20))});
    assert.equal(document.querySelectorAll('textarea').length,0);
    assert.equal(document.querySelectorAll('.spotlight-actions').length,0);
    assert.ok(document.querySelector('.entry-optional-conditions:not([open])'));
    assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='말로 알려주기'));assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='글로 입력하기'));
    assert.doesNotMatch(document.body.textContent,/현재 상황으로 여정 만들기|지금의 조건으로 합천/);
    const secondary=document.querySelector('.home-trip-secondary');
    if(returning){assert.ok(secondary);assert.ok(document.body.innerHTML.indexOf('entry-input-actions')<document.body.innerHTML.indexOf('home-trip-secondary'))}
    else assert.equal(secondary,null);
  }finally{await act(async()=>root.unmount())}
});
test('optional chips follow persisted understanding without another questionnaire',async()=>{
  setup();const root=createRoot(document.querySelector('#root'));
  try{
    await act(async()=>root.render(render(React.createElement(Entry,{loading:false,auxiliary:true,onCreate(){},onDirect(){}}))));
    await act(async()=>{saveTripSession({...trip(),plannedContext:{...trip().plannedContext,interests:['NATURE','FOOD'],walkingLevel:'LOW'}})});
    for(const text of ['부모님과','맛집','가볼 곳','많이 걷기는 어려워요'])assert.equal([...document.querySelectorAll('button')].find(b=>b.textContent===text)?.getAttribute('aria-pressed'),'true',text);
    assert.ok(document.querySelector('.entry-optional-conditions:not([open])'));
  }finally{await act(async()=>root.unmount())}
});
