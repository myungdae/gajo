import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../../server/package.json',import.meta.url));
require('ts-node').register({compiler:require.resolve('typescript'),skipProject:true,transpileOnly:true,compilerOptions:{target:'ES2022',module:'CommonJS',moduleResolution:'node',experimentalDecorators:true}});
const {buildVisitorReport,visitorPeriod}=require('./src/analytics/visitor-report.ts');
const output=new URL('../../docs/evidence/receipt-47-2a/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await fetch('http://127.0.0.1:9226/json/version').then(r=>r.json());
const socket=new WebSocket(browser.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let sequence=0;const pending=new Map(),requests=[],checks=[],errors=[];
const now=new Date('2026-09-04T03:00:00Z');
const rows=Array.from({length:15},(_,i)=>['NEARBY_SEARCH_SUBMITTED','SEARCH_RESULTS_SHOWN','PLACE_DETAIL_OPENED','PHONE_CLICKED'].map((eventType,j)=>({eventType,regionId:'hapcheon',visitSessionId:'visit-'+i,anonymousTripId:'trip-'+i,searchId:'search-'+i,resultSetId:'result-'+i,placeKey:j>=2?'검증 장소':undefined,resultCount:3,screen:'NEARBY',uiLocale:i<5?'ko':i<10?'en':j<2?'ko':'en',trafficClass:i<10?'GENERAL_VISIT':'INTERNAL_TEST',occurredAt:new Date(now.getTime()+j),receivedAt:new Date(now.getTime()+j)}))).flat();
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
socket.addEventListener('message',async({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}return;}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails?.text);
  if(m.method==='Fetch.requestPaused'){
    const {request,requestId}=m.params,url=new URL(request.url);requests.push({path:url.pathname,query:Object.fromEntries(url.searchParams)});let result={},status=200;
    if(url.pathname==='/api/admin/dashboard')result={totals:{runtimeContexts:0,recommendations:0,reservations:0,facilities:0,programs:0,agents:0,ontologyTriples:0}};
    else if(url.pathname==='/api/analytics/v2/report'){
      const q=Object.fromEntries(url.searchParams);if(q.regionId!=='hapcheon'){status=403;result={message:'Region access denied'};}else{
        const period=visitorPeriod(q,now),selected=rows.filter(r=>r.receivedAt>=period.start&&r.receivedAt<period.endExclusive);
        result={regionId:'hapcheon',...buildVisitorReport(selected,period,q.includeInternal==='true',now,now,true)};
      }
    }else if(url.pathname==='/api/analytics/summary')result=null;
    else if(url.pathname.includes('regional-data'))result={records:[],summary:{}};
    else if(url.pathname.includes('spotlight'))result=[];
    await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(result)).toString('base64')},m.sessionId);
  }
});
const{targetId}=await send('Target.createTarget',{url:'about:blank'});const{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const call=(m,p)=>send(m,p,sessionId);
const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=async(expression)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,80));}throw new Error('Timeout '+expression);};
await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['https://*']});await call('Fetch.enable',{patterns:[{urlPattern:'http://127.0.0.1:5176/api/*'}]});
await call('Page.addScriptToEvaluateOnNewDocument',{source:"sessionStorage.setItem('admin-write-token','receipt47-local-fixture');"});
await call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:'http://127.0.0.1:5176/hapcheon/admin'});await wait("Boolean(document.querySelector('.visitor-stats form'))");
const query=async()=>{await evaluate("document.querySelector('.visitor-stats form').requestSubmit()");await wait("Boolean(document.querySelector('.visitor-stats-totals'))||Boolean(document.querySelector('.visitor-stats [role=alert]'))");};
await query();assert.deepEqual(await evaluate("[...document.querySelectorAll('.visitor-stats-totals dd')].map(x=>x.textContent)"),['40','10','10']);checks.push('default excludes 5 internal sessions; separates events / visit sessions / anonymous trips');
await evaluate("document.querySelector('.visitor-stats input[type=checkbox]').click()");await query();assert.deepEqual(await evaluate("[...document.querySelectorAll('.visitor-stats-totals dd')].map(x=>x.textContent)"),['60','15','15']);assert.ok(await evaluate("document.querySelector('.visitor-stats').innerText.includes('혼합')"));checks.push('authenticated inclusion toggle and Korean/English/mixed labels');
await evaluate("document.querySelector('.visitor-stats').scrollIntoView();document.querySelector('.visitor-stats details').open=true");
await writeFile(new URL('dashboard-desktop.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate("(()=>{const el=document.querySelector('.visitor-stats select');el.value='custom';el.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelectorAll('.visitor-stats input[type=date]').length===2");
await evaluate("document.querySelectorAll('.visitor-stats input[type=date]').forEach(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'2026-09-04');el.dispatchEvent(new Event('input',{bubbles:true}));})");await query();assert.equal(requests.filter(r=>r.path.endsWith('/v2/report')).at(-1).query.from,'2026-09-04');checks.push('custom Seoul period is sent explicitly');
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("document.querySelector('.visitor-stats').scrollIntoView()");
assert.ok(await evaluate("document.querySelector('.visitor-stats').getBoundingClientRect().width<=innerWidth"));
const ax=await call('Accessibility.getFullAXTree');assert.ok(ax.nodes.some(n=>n.role?.value==='checkbox'&&n.name?.value.includes('내부 검증')));checks.push('mobile dashboard bounds and accessible controls');
await writeFile(new URL('dashboard-mobile.png',output),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await call('Page.navigate',{url:'http://127.0.0.1:5176/muan/admin'});await wait("Boolean(document.querySelector('.visitor-stats form'))");await query();assert.equal(await evaluate("document.querySelectorAll('.visitor-stats-totals').length"),0);checks.push('denied region shows an error and no previous regional statistics');
assert.deepEqual(errors,[]);assert.equal(requests.some(r=>/analytics\/v2\/events/.test(r.path)),false,'admin views do not count as tourism');checks.push('administrator views do not generate visitor telemetry');
await writeFile(new URL('browser-report.json',output),JSON.stringify({fixture:true,productionApi:false,checks,errors,requests},null,2));
await send('Target.closeTarget',{targetId});socket.close();console.log('PASS '+checks.length+' administrator browser checks');
