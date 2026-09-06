import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createServer } from 'vite';

const vite = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent',plugins:[{name:'fixture-map',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/components/LocationPinMap.tsx')) return "export default function Map(){return null}";}}]});
after(()=>vite.close());
const {default: AdminPage} = await vite.ssrLoadModule('/src/pages/AdminEntry.tsx');
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
const names={gajo:'가조',hapcheon:'합천',okcheon:'옥천',muan:'무안',gyeryong:'계룡','future-region':'신규 지역'};
const place=r=>({id:`location-${r}`,regionId:r,canonicalEntityId:`urn:${r}`,displayName:`${names[r]} 위치 fixture`,publicDisplayName:`${names[r]} 위치 fixture`,needsLocationReview:true,canWrite:true,proposal:{verificationStatus:'PROPOSED',latitude:35.5,longitude:128,reason:'fixture 검토 이유',sourceType:'FIELD_SURVEY',sourceReference:'fixture evidence'},precondition:{expectedVersion:1,expectedHash:'a'.repeat(64)},coordinateEvidence:{verificationStatus:'UNVERIFIED'},warnings:{boundaryKnown:true,approvalBlocked:false,duplicates:[]}});
async function settle(){await act(async()=>{await new Promise(r=>setTimeout(r,0));});}

async function change(selector,value){
 const node=document.querySelector(selector);assert(node,selector);
 const props=node[Object.keys(node).find(k=>k.startsWith('__reactProps$'))];
 await act(async()=>props.onChange({target:{value}}));await settle();
}
for(const width of [1440,390])for(const entry of ['/admin','/hapcheon/admin'])test(width+' '+entry+' shares authorized scope, Yuseong and future regions',async()=>{
 window.innerWidth=width;values.delete('admin-write-token');
 const calls=[];let late;
 api.defaults.adapter=async config=>{
  const u=new URL(config.url,'http://localhost/api/');
  for(const [k,v] of Object.entries(config.params||{}))u.searchParams.set(k,v);
  const region=u.searchParams.get('regionId');calls.push({path:u.pathname,region,method:config.method});
  let data=null;
  if(u.pathname.endsWith('/admin/regions'))data=Object.entries(names).map(([id,regionName])=>({id,regionName,serviceName:regionName}));
  if(u.pathname.endsWith('/admin/dashboard'))data={totals:{},recentContexts:[],recentRecommendations:[],recentReservations:[]};
  if(u.pathname.endsWith('/admin/regional-data'))data={records:[],quality:{totalActive:1}};
  if(u.pathname.endsWith('/admin/regional-spotlights')||u.pathname.endsWith('/admin/businesses'))data=[];
  return {data,status:200,statusText:'OK',headers:{},config};
 };
 globalThis.fetch=async(url,init)=>{
  assert.equal(init.headers.Authorization,undefined);assert.equal(init.headers['x-admin-token'],'fixture-admin');
  const u=new URL(url,'http://localhost');const region=u.searchParams.get('regionId');calls.push({path:u.pathname,region,method:init.method});
  if(u.pathname.endsWith('/location-hapcheon'))return new Promise(resolve=>{late=resolve});
  return {ok:true,json:async()=>({records:[{...place(region),publicDisplayName:region==='hapcheon'?'유성가든식당':names[region]}]})};
 };
 document.body.innerHTML='<div id="root"></div>';
 const router=createMemoryRouter([{path:'/admin',element:React.createElement(AdminPage)},{path:'/:regionId/admin',element:React.createElement(AdminPage)}],{initialEntries:[entry]});
 const root=createRoot(document.querySelector('#root'));
 try{
  await act(async()=>root.render(React.createElement(RouterProvider,{router})));await settle();
  assert.equal(calls.length,0);assert.match(document.body.textContent,/관리자 인증이 필요/);
  await change('input[type="password"]','fixture-admin');
  if(entry==='/admin'){assert(!calls.some(c=>c.region));await change('select[aria-label="관리 지역"]','hapcheon');}
  assert.match(document.body.textContent,/유성가든식당/);
  assert.match(document.body.textContent,/합천 업소 관리/);
  assert.match(document.body.textContent,/합천 Spotlight 관리/);
  assert.equal(document.querySelectorAll('input[type="password"]').length,1);
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('위치정보 보완'));
  await act(async()=>button.click());await settle();assert(late);
  for(const region of Object.keys(names)){
   const start=calls.length;await change('select[aria-label="관리 지역"]',region);
   assert.equal(router.state.location.pathname,'/admin');
   assert.equal(new URLSearchParams(router.state.location.search).get('regionId'),region);
   assert.match(document.body.textContent,new RegExp(names[region]+' 업소 관리'));
   const form=document.querySelector('.business-registration form');
   const props=form[Object.keys(form).find(k=>k.startsWith('__reactProps$'))];
   await act(async()=>props.onSubmit({preventDefault(){}}));await settle();
   assert(calls.slice(start).filter(c=>c.region).every(c=>c.region===region));
   assert(calls.slice(start).some(c=>c.path.endsWith('/businesses')&&c.region===region));
  }
  await act(async()=>late({ok:true,json:async()=>place('hapcheon')}));await settle();
  assert(!document.querySelector('[aria-label="선택 장소 위치 검토"]'));
  const before=router.state.location;window.innerWidth=width===390?1440:390;
  await act(async()=>window.dispatchEvent(new Event('resize')));assert.equal(router.state.location,before);
  await act(async()=>router.navigate(-1));await settle();assert.match(document.body.textContent,/계룡 업소 관리/);
  let start=calls.length;await act(async()=>router.navigate('/unauthorized/admin'));await settle();
  assert.match(document.body.textContent,/관리 권한이 없습니다/);assert.equal(calls.length,start);
  await change('input[type="password"]','');assert(!document.querySelector('.location-review-manager'));
  assert(!calls.some(c=>c.method&&c.method.toUpperCase()!=='GET'));
 }finally{await act(async()=>root.unmount());router.dispose();}
});
