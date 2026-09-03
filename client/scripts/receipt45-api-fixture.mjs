// Test-only HTTP fixture. No database or external services are used.
import {createServer} from 'node:http';
import {appendFileSync} from 'node:fs';
const log=new URL('../../docs/evidence/receipt-45-current/api-fixture-requests.jsonl',import.meta.url);
const place=(category='TOURIST_ATTRACTION')=>({id:'receipt45-place',provider:'REGIONAL_DATA',providerPlaceId:'urn:receipt45:place',name:'Test Visitor Place',category,categoryLabel:category==='FOOD'?'Restaurants':'Attractions',providerCategoryName:category,address:'테스트 주소',roadAddress:'테스트 주소',phone:'000-000-0000',lat:35.568,lng:128.165,distanceMeters:120,placeUrl:'https://example.test/place',indoorRelevance:'UNKNOWN',operatingState:'UNKNOWN',operatingMessage:'Check current opening hours before visiting.',contextualReasons:['Verified local tourism information.'],canonicalEntityUri:'urn:receipt45:place',canonicalLabel:'Test Visitor Place',masterVerificationStatus:'VERIFIED',transient:false,relevanceScore:5,administrativeRegion:'합천',visitorContent:{reviewedEnglishName:'Test Visitor Place',en:{signatureMenu:'Test menu',priceRange:'KRW 10,000–20,000',payment:'Card payment',parking:'On-site parking',reservation:'Call to reserve'}}});
createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');let raw='';for await(const chunk of req)raw+=chunk;let body={};try{body=raw?JSON.parse(raw):{}}catch{} const locale=body.locale||url.searchParams.get('locale');appendFileSync(log,JSON.stringify({path:url.pathname,locale,regionId:body.regionId||url.searchParams.get('regionId')})+'\n');res.setHeader('Content-Type','application/json');const send=x=>res.end(JSON.stringify(x));
if(url.pathname==='/api/nearby/status')return send({configured:true,state:'READY',provider:'REGIONAL_OPERATIONAL_DATA'});
if(url.pathname==='/api/nearby/anchors'||url.pathname==='/api/nearby/location-search')return send({results:[place()]});
if(url.pathname==='/api/nearby/discovery')return send({searchedAt:new Date().toISOString(),timeZone:'Asia/Seoul',distanceTrusted:true,experienceRegionId:body.regionId,searchRegionId:body.regionId,category:body.category,radius:1000,initialRadius:1000,expanded:false,coverageStatus:'COMPLETE',distanceBands:[],results:[place(body.category)],total:1,resultStatus:'AVAILABLE'});
if(url.pathname==='/api/nearby/navigation-links')return send({kakaoMapWeb:'https://map.kakao.com/link/map/Test,35.568,128.165'});
if(url.pathname==='/api/facilities')return send([{uri:'urn:receipt45:place',label:'Test Visitor Place',comment:'A fixture attraction for local verification.',literalProps:{latitude:35.568,longitude:128.165,category:'Attractions',address:'테스트 주소'}}]);
if(url.pathname==='/api/concierge/chat') {
  const replan=/replan/i.test(body.rawMessage||'');
  const steps=[{entityId:'urn:receipt45:place',label:'Test Visitor Place',order:1},{entityId:replan?'urn:receipt45:cafe':'urn:receipt45:restaurant',label:replan?'Test Local Café':'Test Local Restaurant',order:2}].map(step=>({...step,regionId:body.regionId,dayIndex:1,latitude:35.568,longitude:128.165,address:'테스트 주소',description:'Check opening hours before visiting.'}));
  return send({context:{regionId:body.regionId,contextNo:'fixture-context'},visitorMessage:replan?'The revised trip connects your attraction visit with a local café. Apply this change?':'Visit the attraction, then explore a local restaurant.',intentRoute:replan?'REPLAN':'JOURNEY_PLAN',requestedDestinations:['Test Visitor Place','Test Local Restaurant'],recommendation:{reasonSummary:'A local attraction and a nearby small business.',itinerary:{itineraryNo:replan?'fixture-replanned':'fixture-plan',regionId:body.regionId,steps}},usedAgents:[],risks:[]});
}
if(url.pathname==='/api/runtime-replanning/observe')return send({events:[],impacts:[],replanningRecommended:false,proposedRevision:null});
if(url.pathname==='/api/trips/anonymous/sync')return send({});
if(url.pathname.startsWith('/api/trips/anonymous/'))return send({});
if(url.pathname==='/api/analytics/events'||url.pathname==='/api/partners/recommendations')return send({ok:true});
res.statusCode=503;return send({message:'Test fixture: this API is unavailable.'});
}).listen(3000,'localhost',()=>console.log('Receipt 45 test API fixture on localhost:3000'));
