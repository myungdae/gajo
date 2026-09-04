// Local browser fixture only. No DB, credentials or external writes. State disappears on exit.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
const placeKey='https://hapcheon.example/ontology#hapcheonLakeSmilePension', rows=[];
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:5187');
  if(!url.pathname.startsWith('/api/')){
    const upstream=http.request({hostname:'127.0.0.1',port:5178,path:req.url==='/'?'/scripts/receipt47-channel-fixture.html':req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:5178'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});upstream.on('error',()=>{res.writeHead(502);res.end('Start Vite on 5178')});req.pipe(upstream);return;
  }
  let body={};try{let raw='';for await(const chunk of req)raw+=chunk;body=raw?JSON.parse(raw):{}}catch{return json(res,{},400)}
  if(url.pathname==='/api/admin/regional-data')return json(res,{records:[{id:'smile',canonicalEntityId:placeKey,regionId:'hapcheon',displayName:'합천호 스마일펜션',entityType:'ACCOMMODATION',lifecycleStatus:'ACTIVE',verificationStatus:'VERIFIED',source:{sourceType:'OFFICIAL_BUSINESS',sourceUrl:'https://www.lakesmile.com/'}}],quality:{}});
  if(url.pathname==='/api/action-channels/public')return json(res,rows.filter(r=>r.published&&r.verificationStatus==='VERIFIED').map(({channelId,regionId,placeKey,kind,labelKo,labelEn,revision})=>({channelId,regionId,placeKey,kind,labelKo,labelEn,revision})));
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
}).listen(5187,'127.0.0.1',()=>console.log('UI fixture http://127.0.0.1:5187/ · dummy token receipt47-local-fixture'));
