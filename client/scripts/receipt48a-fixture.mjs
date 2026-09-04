// UI-only in-memory fixture. It does not use a database, external services, or a real microphone.
import http from "node:http";
const speech = `<script>class FixtureSpeech {start(){this.onstart?.({});} stop(){const r=[{transcript:document.documentElement.lang==='en'?'Find a quiet café nearby':'가까운 조용한 카페를 찾아줘',confidence:1}];r.isFinal=true;this.onresult?.({resultIndex:0,results:[r]});this.onend?.({});} abort(){this.onend?.({});}} window.SpeechRecognition=FixtureSpeech;</script>`;
const place = (id,label,enLabel) => ({ entityId:`urn:receipt48:${id}`, regionId:"hapcheon", label, englishLabel:enLabel, order:id==="lake"?1:2, dayIndex:1, latitude:35.568, longitude:128.165, address:"경상남도 합천군", description:"운영 정보는 방문 전에 확인해 주세요." });
http.createServer(async (req,res) => {
  const url = new URL(req.url,"http://127.0.0.1:5188");
  if (!url.pathname.startsWith("/api/")) {
    const upstream=http.request({hostname:"127.0.0.1",port:5178,path:req.url,method:req.method,headers:{...req.headers,host:"127.0.0.1:5178"}},response=>{
      if(response.headers["content-type"]?.includes("text/html")){let html="";response.on("data",chunk=>html+=chunk);response.on("end",()=>{res.writeHead(response.statusCode,{"Content-Type":"text/html"});res.end(html.replace("<head>","<head>"+speech));});}
      else{res.writeHead(response.statusCode,response.headers);response.pipe(res);}
    }); upstream.on("error",()=>{res.writeHead(502);res.end("Start Vite on 5178");}); req.pipe(upstream); return;
  }
  let body={}; try{let raw="";for await(const chunk of req)raw+=chunk;body=raw?JSON.parse(raw):{};}catch{}
  const en=body.locale==="en"||url.searchParams.get("locale")==="en"; let data={};
  if(url.pathname==="/api/concierge/chat"){
    await new Promise(resolve=>setTimeout(resolve,500));
    const steps=[place("lake",en?"Hapcheon Lake":"합천호","Hapcheon Lake"),place("cafe",en?"Local Café":"지역 카페","Local Café")];
    data={context:{regionId:"hapcheon",contextNo:"receipt48a",weatherState:"CLOUDY"},visitorMessage:en?"I understood that you want a comfortable journey for your situation now.":"지금 상황에 맞는 편안한 여정을 원하시는 것으로 이해했어요.",intentRoute:"JOURNEY_PLAN",recommendation:{reasonSummary:en?"A short route using verified regional places.":"검증된 지역 장소를 잇는 짧은 동선입니다.",itinerary:{itineraryNo:"receipt48a",regionId:"hapcheon",steps}},usedAgents:[],risks:[]};
  } else if(url.pathname==="/api/runtime-context/live") data={context:{regionId:"hapcheon",currentTime:"14:30",temperature:23,weatherState:"CLOUDY"},metadata:{regionId:"hapcheon",status:"LIVE"}};
  else if(url.pathname==="/api/nearby/status") data={configured:true,state:"READY",provider:"FIXTURE"};
  else if(url.pathname==="/api/facilities"||url.pathname==="/api/action-channels/public") data=[];
  else if(url.pathname==="/api/runtime-replanning/observe") data={events:[],impacts:[],replanningRecommended:false};
  else if(url.pathname.startsWith("/api/trips/anonymous/")) data={};
  res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(data));
}).listen(5188,"127.0.0.1",()=>console.log("Receipt 48-A fixture: http://127.0.0.1:5188/hapcheon"));
