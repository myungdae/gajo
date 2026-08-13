import { useEffect, useMemo, useState } from 'react';
import { fetchOperationalPlaces, type ConciergeChatResponse } from '../api/client';
import { approximateDistance, estimatedTravelMinutes, getSessionLocation, isOperationalLocation, locationConfidence, observeVisitorLocation } from '../utils/visitorLocation';

type Place = { uri:string; label:string; latitude:number; longitude:number; operatingHours?:any[]; coordinateVerification:'VERIFIED' };
type Leg = { place:Place; distanceMeters?:number; travelMinutes?:number; arrival?:string; departure?:string; durationMinutes?:number; reasons:string[] };

const minutes=(value?:string)=>{const match=value?.match(/(?:T|^)(\d{1,2}):(\d{2})/);return match?Number(match[1])*60+Number(match[2]):undefined};
const clock=(value?:number)=>value===undefined?undefined:`${String(Math.floor(value/60)%24).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
const distanceLabel=(meters?:number)=>meters===undefined?'':meters<1000?`${meters}m`:`${(meters/1000).toFixed(1)}km`;
const modeLabel=(mode?:string)=>mode==='WALK'?'도보':mode==='PUBLIC_TRANSPORT'||mode==='PUBLIC_TRANSIT'?'대중교통':mode==='CAR'?'차량':'이동';

export default function MovementPlan({result}:{result:ConciergeChatResponse}){
  const [places,setPlaces]=useState<Place[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadFailed,setLoadFailed]=useState(false);
  const [visitor,setVisitor]=useState(getSessionLocation());
  const [locating,setLocating]=useState(false);
  useEffect(()=>{fetchOperationalPlaces().then(rows=>setPlaces(rows.filter(row=>row.coordinateVerification==='VERIFIED'&&Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)))).catch(()=>setLoadFailed(true)).finally(()=>setLoading(false))},[]);
  const context=result.context||{};
  const future=(result.recommendation?.itinerary?.steps||[]).filter((step:any)=>step.status!=='COMPLETED'&&step.status!=='SKIPPED');
  const durationByFacility=new Map<string,number>(future.filter((s:any)=>Number.isFinite(s.durationMinutes)).map((s:any)=>[s.facilityUri,s.durationMinutes]));
  const contextUsable=context.locationStatus==='AVAILABLE'&&locationConfidence(Number(context.locationAccuracy))!=='UNUSABLE'&&Number.isFinite(context.latitude)&&Number.isFinite(context.longitude);
  const contextOrigin=contextUsable?{latitude:Number(context.latitude),longitude:Number(context.longitude)}:undefined;
  const origin=visitor?(isOperationalLocation(visitor)?{latitude:visitor.latitude!,longitude:visitor.longitude!}:undefined):contextOrigin;
  const unusableGps=(visitor?.status==='AVAILABLE'&&!isOperationalLocation(visitor))||(context.locationStatus==='AVAILABLE'&&!contextUsable);
  const legs=useMemo(()=>buildLegs(places,origin,context.transportMode,context.currentTime,durationByFacility),[places,origin?.latitude,origin?.longitude,context.transportMode,context.currentTime]);
  if(loading)return <div className="card movement-plan"><h2>이동 계획</h2><p className="muted-line">검증된 실제 장소를 불러오는 중입니다.</p></div>;
  if(loadFailed||!legs.length)return <div className="card movement-plan"><h2>이동 계획</h2><p className="muted-line">검증된 실제 장소 이동 계획을 현재 불러올 수 없습니다.</p></div>;
  return <div className="card movement-plan"><div className="movement-heading"><div><h2>이동 계획</h2><p>검증된 실제 위치만 사용한 예상 이동 계획입니다. 도로 경로가 아닌 직선거리 기반 참고값입니다.</p></div></div>
    <div className="movement-origin"><span className="movement-dot visitor-dot"/><div><b>현재 위치</b>{unusableGps&&!origin&&<><p className="location-unusable">위치 정확도 부족 — 첫 장소까지 거리 계산 보류</p><p className="muted-line">현재 위치를 정확하게 확인하지 못했습니다.<br/>위치를 다시 확인하면 가까운 장소와 이동시간을 더 정확하게 안내할 수 있습니다.</p><button type="button" className="btn btn-outline" disabled={locating} onClick={async()=>{setLocating(true);setVisitor(await observeVisitorLocation());setLocating(false)}}>{locating?'위치 확인 중…':'위치 다시 확인'}</button></>}</div></div>
    {legs.map((leg,index)=><div key={leg.place.uri} className="movement-node">
      {(leg.distanceMeters!==undefined||leg.travelMinutes!==undefined)&&<div className="movement-leg"><span>↓</span><b>{modeLabel(context.transportMode)} {leg.travelMinutes!==undefined?`약 ${leg.travelMinutes}분`:''}{leg.distanceMeters!==undefined?` · ${distanceLabel(leg.distanceMeters)}`:''}</b></div>}
      <div className="movement-place"><span className="movement-number">{index+1}</span><div><h3>{leg.place.label}</h3>{leg.arrival&&<p>{leg.arrival} 도착 예상</p>}{leg.durationMinutes&&<p>약 {leg.durationMinutes}분 이용</p>}{leg.departure&&<p>{leg.departure} 출발 예상</p>}<OperatingNotice place={leg.place}/></div></div>
    </div>)}
    {legs.some(leg=>leg.reasons.length>0)&&<div className="order-reasons" role="region" aria-label="이동 순서 설명"><h3>이 순서로 추천한 이유</h3><ul>{Array.from(new Set(legs.flatMap(l=>l.reasons))).map(reason=><li key={reason}>{reason}</li>)}</ul></div>}
  </div>
}

function OperatingNotice({place}:{place:Place}){const hours=place.operatingHours;if(!Array.isArray(hours)||!hours.length)return <p className="muted-line">현재 운영시간은 확인이 필요합니다.</p>;const last=hours.find((h:any)=>h.lastEntryTime)?.lastEntryTime;return <p>{last?`입장마감 ${last}`:'운영시간 정보가 등록되어 있습니다.'}</p>}

export function buildLegs(places:Place[],origin:{latitude:number;longitude:number}|undefined,mode:string|undefined,startTime:string|undefined,durations:Map<string,number>):Leg[]{
  const remaining=[...places],result:Leg[]=[];let current=origin;let cursor=origin?minutes(startTime):undefined;
  while(remaining.length){remaining.sort((a,b)=>distanceFrom(current,a)-distanceFrom(current,b)||a.label.localeCompare(b.label));const place=remaining.shift()!;const distanceMeters=current?distanceFrom(current,place):undefined;const travelMinutes=estimatedTravelMinutes(distanceMeters,mode as any);if(cursor!==undefined&&travelMinutes!==undefined)cursor+=travelMinutes;const arrival=clock(cursor);const durationMinutes=durations.get(place.uri);if(cursor!==undefined&&durationMinutes!==undefined)cursor+=durationMinutes;const departure=durationMinutes!==undefined?clock(cursor):undefined;const reasons:string[]=[];if(current&&distanceMeters!==undefined)reasons.push(result.length?'이전 장소에서 가까워 이동 동선이 짧음':'현재 위치에서 가까운 검증 장소를 먼저 방문');if(mode==='WALK'&&distanceMeters!==undefined)reasons.push('도보 이동거리와 보행 부담을 고려');result.push({place,distanceMeters,travelMinutes,arrival,departure,durationMinutes,reasons});current={latitude:place.latitude,longitude:place.longitude}}return result;
}
function distanceFrom(origin:{latitude:number;longitude:number}|undefined,place:Place){if(!origin)return Number.MAX_SAFE_INTEGER;return approximateDistance({status:'AVAILABLE',latitude:origin.latitude,longitude:origin.longitude,accuracy:0,observedAt:''},place.latitude,place.longitude)??Number.MAX_SAFE_INTEGER}
