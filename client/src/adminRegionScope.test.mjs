import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createServer } from 'vite';

const vite = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent',plugins:[{name:'fixture-map',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/components/LocationPinMap.tsx')) return "export default function Map(){return null}";}}]});
after(()=>vite.close());
const {default: AdminPage} = await vite.ssrLoadModule('/src/pages/AdminPage.tsx');
const {RegionProvider} = await vite.ssrLoadModule('/src/RegionContext.tsx');
const {api} = await vite.ssrLoadModule('/src/api/client.ts');
const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>');
const values=new Map([['copilot-access-token','must-not-use-jwt'],['admin-write-token','fixture-admin']]);
const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
Object.assign(window,{location:{hostname:'localhost',pathname:'/gajo/admin',search:'',href:'http://localhost/gajo/admin'},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
window.HTMLElement.prototype.scrollIntoView=()=>{};
Object.assign(globalThis,{window,document,HTMLElement:window.HTMLElement,Node:window.Node,Event:window.Event,sessionStorage:storage,localStorage:storage,requestAnimationFrame:fn=>fn(),IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:window.navigator});
const savedFetch=globalThis.fetch;
after(()=>{globalThis.fetch=savedFetch;});
const names={gajo:'가조',hapcheon:'합천',okcheon:'옥천'};
const place=r=>({id:`location-${r}`,regionId:r,canonicalEntityId:`urn:${r}`,displayName:`${names[r]} 위치 fixture`,publicDisplayName:`${names[r]} 위치 fixture`,needsLocationReview:true,canWrite:true,proposal:{verificationStatus:'PROPOSED',latitude:35.5,longitude:128,reason:'fixture 검토 이유',sourceType:'FIELD_SURVEY',sourceReference:'fixture evidence'},precondition:{expectedVersion:1,expectedHash:'a'.repeat(64)},coordinateEvidence:{verificationStatus:'UNVERIFIED'},warnings:{boundaryKnown:true,approvalBlocked:false,duplicates:[]}});
async function settle(){await act(async()=>{await new Promise(r=>setTimeout(r,0));});}
async function click(prefix){const node=[...document.querySelectorAll('button')].find(n=>n.textContent.trim().startsWith(prefix));assert(node,prefix);await act(async()=>node.click());await settle();}
async function select(value){const select=document.querySelector('select[aria-label="관리 지역"]');assert(select);const props=select[Object.keys(select).find(k=>k.startsWith('__reactProps$'))];await act(async()=>props.onChange({target:{value}}));await settle();}

for(const width of [1440,390])test(`Hapcheon existing authentication enables location GET and clearing it removes private data at ${width}px`,async()=>{
  window.innerWidth=width;
  values.delete('admin-write-token');
  values.set('copilot-access-token','must-not-use-jwt');
  const calls=[];
  api.defaults.adapter=async config=>({data:config.url.includes('dashboard')?{totals:{},recentContexts:[],recentRecommendations:[],recentReservations:[]}:config.url.includes('regional-spotlights')?[]:null,status:200,statusText:'OK',headers:{},config});
  globalThis.fetch=async(url,init)=>{
    calls.push({url,init});
    return {ok:true,json:async()=>({records:[{...place('hapcheon'),displayName:'유성가든식당',publicDisplayName:'유성가든식당'}]})};
  };
  document.body.innerHTML='<div id="root"></div>';
  const router=createMemoryRouter([{path:'/:region/admin',element:React.createElement(RegionProvider,null,React.createElement(AdminPage))}],{initialEntries:['/hapcheon/admin']});
  const root=createRoot(document.querySelector('#root'));
  const authenticate=async value=>{
    const input=[...document.querySelectorAll('label')].find(n=>n.textContent==='관리자 인증')?.querySelector('input');
    assert(input,'existing business manager authentication');
    const props=input[Object.keys(input).find(k=>k.startsWith('__reactProps$'))];
    await act(async()=>props.onChange({target:{value}}));await settle();
  };
  try{
    await act(async()=>root.render(React.createElement(RouterProvider,{router})));await settle();
    assert.match(document.body.textContent,/관리자 인증이 필요/);
    assert.equal(calls.length,0);
    assert.equal(document.querySelectorAll('.location-review-manager input[type="password"]').length,0);
    await authenticate('fixture-admin');
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'/api/admin/locations?missingOnly=true&regionId=hapcheon');
    assert.equal(calls[0].init.headers['x-admin-token'],'fixture-admin');
    assert.equal(calls[0].init.headers.Authorization,undefined);
    assert.equal(calls[0].init.method,'GET');
    assert.match(document.body.textContent,/유성가든식당/);
    await authenticate('');
    assert(!document.body.textContent.includes('유성가든식당'));
    assert.match(document.body.textContent,/관리자 인증이 필요/);
    assert.equal(calls.length,1);
  }finally{
    await act(async()=>root.unmount());router.dispose();
    values.set('admin-write-token','fixture-admin');
  }
});

for(const width of [1440,390])test(`one URL scope for full administrator layout at ${width}px, including history and late responses`,async()=>{
  window.innerWidth=width;
  const calls=[];let resolveOld;
  api.defaults.adapter=async config=>{
    const url=new URL(config.url,'http://localhost/api/');for(const [key,value]of Object.entries(config.params||{}))url.searchParams.set(key,value);
    const region=url.searchParams.get('regionId');calls.push({path:url.pathname,region});
    let data=null;
    if(url.pathname.endsWith('/admin/dashboard'))data={totals:{},recentContexts:[],recentRecommendations:[],recentReservations:[]};
    else if(url.pathname.endsWith('/admin/regional-data'))data={records:[],quality:{totalActive:{gajo:1,hapcheon:2,okcheon:3}[region]}};
    else if(url.pathname.endsWith('/admin/regional-spotlights'))data=[];
    return{data,status:200,statusText:'OK',headers:{},config};
  };
  globalThis.fetch=async(url,init)=>{
    assert.equal(init.headers.Authorization,undefined);
    assert.equal(init.headers['x-admin-token'],'fixture-admin');
    const parsed=new URL(url,'http://localhost');const region=parsed.searchParams.get('regionId');calls.push({path:parsed.pathname,region,method:init?.method||'GET'});
    if(parsed.pathname.includes('/locations/location-gajo'))return new Promise(resolve=>{resolveOld=resolve;});
    return{ok:true,json:async()=>parsed.pathname.includes('/locations/location-')?place(region):{records:[place(region)]}};
  };
  document.body.innerHTML='<div id="root"></div>';
  const router=createMemoryRouter([{path:'/:region/admin',element:React.createElement(RegionProvider,null,React.createElement(AdminPage))}],{initialEntries:['/gajo/admin']});
  const root=createRoot(document.querySelector('#root'));
  try{
    await act(async()=>root.render(React.createElement(RouterProvider,{router})));await settle();
    assert.match(document.body.textContent,/현재 관리 지역: 가조/);
    assert(!document.body.textContent.includes('위치정보 관리자 토큰'));
    assert(calls.some(c=>c.path==='/api/admin/locations'));
    assert.equal(document.querySelectorAll('select[aria-label="지역"]').length,0);
    await click('위치정보 보완');assert(resolveOld);
    let start=calls.length;await select('hapcheon');
    assert.equal(router.state.location.pathname,'/hapcheon/admin');
    assert.match(document.body.textContent,/현재 관리 지역: 합천/);assert.match(document.body.textContent,/합천 Spotlight 관리/);assert.match(document.body.textContent,/검수 지역: 합천/);
    assert(calls.slice(start).filter(c=>c.region).every(c=>c.region==='hapcheon'));
    await act(async()=>resolveOld({ok:true,json:async()=>place('gajo')}));await settle();
    assert(!document.body.textContent.includes('가조 위치 fixture'));
    await click('위치정보 보완');assert.match(document.body.textContent,/합천 위치 fixture/);
    start=calls.length;await select('okcheon');
    assert.match(document.body.textContent,/현재 관리 지역: 옥천/);assert.match(document.body.textContent,/검수 지역: 옥천/);assert.match(document.body.textContent,/옥천 Spotlight 관리/);
    assert(!document.body.textContent.includes('합천 위치 fixture'));
    assert(!document.querySelector('[aria-label="선택 장소 위치 검토"]'));
    assert(calls.slice(start).filter(c=>c.region).every(c=>c.region==='okcheon'));
    const before=router.state.location.pathname;window.innerWidth=width===390?1440:390;
    await act(async()=>window.dispatchEvent(new window.Event('resize')));assert.equal(router.state.location.pathname,before);
    start=calls.length;await act(async()=>router.navigate(-1));await settle();
    assert.equal(router.state.location.pathname,'/hapcheon/admin');assert.match(document.body.textContent,/현재 관리 지역: 합천/);
    assert(calls.slice(start).filter(c=>c.region).every(c=>c.region==='hapcheon'));
    assert(!calls.some(c=>c.method&&c.method!=='GET'));
  }finally{await act(async()=>root.unmount());router.dispose();}
});
