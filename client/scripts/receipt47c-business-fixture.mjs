// Local browser fixture only. No DB, credentials or external writes. State disappears on exit.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
const placeKey='urn:regional-business:hapcheon-business-fixture', rows=[], businesses=[];
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:5189');
  if(!url.pathname.startsWith('/api/')){
    const upstream=http.request({hostname:'127.0.0.1',port:5178,path:req.url==='/'?'/scripts/receipt47c-business-fixture.html':req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:5178'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});upstream.on('error',()=>{res.writeHead(502);res.end('Start Vite on 5178')});req.pipe(upstream);return;
  }
  let body={};try{let raw='';for await(const chunk of req)raw+=chunk;body=raw?JSON.parse(raw):{}}catch{return json(res,{},400)}
  if(url.pathname.startsWith('/api/admin/businesses')) {
    if(req.headers['x-admin-token']!=='receipt47-local-fixture'||url.searchParams.get('regionId')!=='hapcheon')return json(res,{},403);
    if(req.method==='GET')return json(res,businesses);
    if(url.pathname.endsWith('/duplicates'))return json(res,businesses.filter(r=>r.displayName===body.displayName));
    if(url.pathname==='/api/admin/businesses'){const row={id:'new-business',canonicalEntityId:placeKey,displayName:body.displayName,regionId:'hapcheon',source:{sourceUrl:body.sourceUrl},registration:{input:body,revision:1},lifecycleStatus:'NEW_CANDIDATE',verificationStatus:'UNVERIFIED',auditTrail:[]};businesses.push(row);return json(res,row)}
    const row=businesses[0], action=url.pathname.split('/').at(-1);if(!row||body.revision!==row.registration.revision)return json(res,{},409);
    if(action==='VERIFY'){if(!body.confirmed)return json(res,{},400);row.lifecycleStatus='APPROVED';row.verificationStatus='VERIFIED'}
    if(action==='PUBLISH'){if(row.lifecycleStatus!=='APPROVED')return json(res,{},400);row.lifecycleStatus='ACTIVE'}
    if(action==='EDIT'){row.registration.input=body.input;row.lifecycleStatus='NEEDS_VERIFICATION';row.verificationStatus='REVERIFY_REQUIRED'}
    if(action==='STOP')row.lifecycleStatus='ARCHIVED';row.registration.revision++;return json(res,row);
  }
  if(url.pathname==='/api/admin/regional-data')return json(res,{records:[{id:'smile',canonicalEntityId:placeKey,regionId:'hapcheon',displayName:'합천호 스마일펜션',entityType:'ACCOMMODATION',lifecycleStatus:'ACTIVE',verificationStatus:'VERIFIED',source:{sourceType:'OFFICIAL_BUSINESS',sourceUrl:'https://www.lakesmile.com/'}}],quality:{}});
  if(url.pathname==='/api/action-channels/public')return json(res,rows.filter(r=>businesses[0]?.lifecycleStatus==='ACTIVE'&&r.published&&r.verificationStatus==='VERIFIED').map(({channelId,regionId,placeKey,kind,labelKo,labelEn,revision})=>({channelId,regionId,placeKey,kind,labelKo,labelEn,revision})));
  if(url.pathname.startsWith('/api/action-channels/admin')){
    if(req.headers['x-admin-token']!=='receipt47-local-fixture')return json(res,{},403);
    if(req.method==='GET')return json(res,rows);
    if(url.pathname==='/api/action-channels/admin'){const row={...body,channelId:randomUUID(),regionId:'hapcheon',placeKey,revision:1,verificationStatus:'DRAFT',published:false,audit:[{action:'CREATE',actorId:'fixture-reviewer',at:new Date().toISOString(),revision:1}]};rows.push(row);return json(res,row)}
    const [,id,action]=url.pathname.match(/admin\/([^/]+)\/(\w+)/)||[];const row=rows.find(r=>r.channelId===id);if(!row||body.revision!==row.revision)return json(res,{},409);
    if(action==='VERIFY'){if(!body.confirmed)return json(res,{},400);row.verificationStatus='VERIFIED';row.published=false}
    if(action==='PUBLISH'){if(row.verificationStatus!=='VERIFIED')return json(res,{},400);row.published=true}
    if(action==='SUSPEND'){row.verificationStatus='SUSPENDED';row.published=false}
    if(action==='EDIT'){Object.assign(row,body.fields);row.verificationStatus='REVIEW_REQUIRED';row.published=false}
    row.revision++;row.audit.push({action,actorId:'fixture-reviewer',at:new Date().toISOString(),revision:row.revision});return json(res,row);
  }
  if(url.pathname.endsWith('/outbound')||url.pathname.endsWith('/click')){const row=rows.find(r=>url.pathname.includes(r.channelId)&&r.published);if(!row)return json(res,{},404);return json(res,url.pathname.endsWith('/click')?{accepted:true}:{href:row.target,channelId:row.channelId,revision:row.revision})}
  return json(res,{});
}).listen(5189,'127.0.0.1',()=>console.log('UI fixture http://127.0.0.1:5189/ · dummy token receipt47-local-fixture'));
