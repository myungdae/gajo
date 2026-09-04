// UI-only in-memory fixture. No server/DB and no real microphone capture.
import http from 'node:http';
const speech=`<script>class FixtureSpeech {start(){this.onstart?.({});} stop(){const r=[{transcript:document.documentElement.lang==='en'?'Tell me about Hapcheon Lake':'합천호 스마일펜션 알려줘',confidence:1}];r.isFinal=true;this.onresult?.({resultIndex:0,results:[r]});this.onend?.({});} abort(){this.onend?.({});}} window.SpeechRecognition=FixtureSpeech;</script>`;
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:5188');
  if(!url.pathname.startsWith('/api/')){
    const upstream=http.request({hostname:'127.0.0.1',port:5178,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:5178'}},r=>{
      if(r.headers['content-type']?.includes('text/html')){let html='';r.on('data',d=>html+=d);r.on('end',()=>{res.writeHead(r.statusCode,{'Content-Type':'text/html'});res.end(html.replace('<head>','<head>'+speech))})}
      else{res.writeHead(r.statusCode,r.headers);r.pipe(res)}
    });upstream.on('error',()=>{res.writeHead(502);res.end('Start Vite on 5178')});req.pipe(upstream);return;
  }
  let body={};try{let raw='';for await(const d of req)raw+=d;body=raw?JSON.parse(raw):{}}catch{}
  const en=body.locale==='en'||url.searchParams.get('locale')==='en';let data={};
  if(url.pathname==='/api/concierge/chat'){
    const entityId='https://hapcheon.example/ontology#hapcheonLakeSmilePension';
    data={context:{regionId:'hapcheon',contextNo:'ux-fixture',raw:{input:body}},visitorMessage:en?'I found a place for your Hapcheon trip.':'합천 여행에서 바로 확인할 장소를 찾았습니다.',intentRoute:'PLACE_DISCOVERY',discovery:{category:'LODGING',regionId:'hapcheon',entities:[{entityId,regionId:'hapcheon',label:en?'Hapcheon Lake Smile Pension':'합천호 스마일펜션',entityType:'ACCOMMODATION',latitude:35.5245,longitude:128.0158,actions:{call:{phone:'055-931-1638'},navigate:{latitude:35.5245,longitude:128.0158}}}]},usedAgents:[],risks:[]};
    await new Promise(resolve=>setTimeout(resolve,2000));
  } else if(url.pathname==='/api/runtime-context/live')data={context:{regionId:'hapcheon',currentTime:'14:30',temperature:23,weatherState:'CLOUDY'},metadata:{regionId:'hapcheon',status:'LIVE'}};
  else if(url.pathname==='/api/nearby/status')data={configured:true,state:'READY',provider:'FIXTURE'};
  else if(url.pathname==='/api/nearby/anchors')data={results:[]};
  else if(url.pathname==='/api/facilities'||url.pathname==='/api/action-channels/public')data=[];
  else if(url.pathname==='/api/runtime-replanning/observe')data={events:[],impacts:[],replanningRecommended:false};
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));
}).listen(5188,'127.0.0.1',()=>console.log('Urgent UX fixture: http://127.0.0.1:5188/hapcheon/concierge?mode=NOW&lang=ko'));
