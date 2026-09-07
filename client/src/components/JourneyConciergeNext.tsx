import { useEffect, useRef, useState } from 'react';
import { api, recordPartnerRecommendations } from '../api/client';
import { ensureTripSession, sessionContext, isFreshTripLocation, confirmTripLocation, saveTripSession, type TripSession } from '../tripSession';
import { executionState } from '../journeyExecution';
import { locationPermissionState, mayRefreshLocationSilently, observeVisitorLocation } from '../utils/visitorLocation';
import { canOfferDiscovery, discoveryKey, readDiscovery, rememberDiscovery, nextTripAction } from '../localDiscovery';
import { canonicalEntityId, recommendationItemLabel } from '../recommendationItem';
import { track } from '../analytics';
import { useRegion } from '../RegionContext';
import { useRegionalLanguage } from '../RegionalLanguageContext';
import EntityActions from './EntityActions';

export default function JourneyConciergeNext({ busy, onReplan, mode = 'NOW' }: { busy: boolean; onReplan: (text:string)=>void; mode?:string }) {
  const region=useRegion(),{language}=useRegionalLanguage();
  const [trip,setTrip]=useState<TripSession>(()=>ensureTripSession(region.id)),[offer,setOffer]=useState<any>(),[notice,setNotice]=useState('');
  const [tick,setTick]=useState(0),[requested,setRequested]=useState(0),[keep,setKeep]=useState(false);
  const consumedRequest=useRef(0);
  const displayedOffer=useRef<any>(undefined);
  const [review,setReview]=useState<string>();
  useEffect(()=>{
    const refresh=()=>{setTrip(ensureTripSession(region.id));setTick(t=>t+1)};
    let disposed=false,refreshing=false;
    const visible=async()=>{
      if(document.visibilityState!=='visible'||refreshing)return;
      refreshing=true;
      try {
        const current=ensureTripSession(region.id),saved=current.locationContext?.now;
        if(mode!=='PLAN'&&saved?.source==='GPS'&&!isFreshTripLocation(saved,Date.now(),5*60000)&&mayRefreshLocationSilently(await locationPermissionState())){
          const fix=await observeVisitorLocation();
          if(!disposed&&fix.status==='AVAILABLE'&&(fix.accuracy||Infinity)<=200)confirmTripLocation(region.id,'NOW',{
            ...saved,status:'CONFIRMED',latitude:fix.latitude,longitude:fix.longitude,accuracy:fix.accuracy,observedAt:fix.observedAt,
            label:'현재 위치 주변',address:undefined,searchRegionId:undefined,regionMembership:'UNCERTAIN',
          });
        }
        if(!disposed)refresh();
      } finally {refreshing=false}
    };
    window.addEventListener('regional-trip-saved',refresh);document.addEventListener('visibilitychange',visible);
    const timer=setInterval(visible,5*60000);
    return()=>{disposed=true;window.removeEventListener('regional-trip-saved',refresh);document.removeEventListener('visibilitychange',visible);clearInterval(timer)};
  },[region.id]);
  useEffect(()=>{
    if(busy || document.visibilityState==='hidden')return;
    let active=true;
    const location=trip.locationContext?.now,key=discoveryKey(trip),memory=readDiscovery(key,localStorage);
    const userRequested=requested>consumedRequest.current;
    setOffer(undefined);
    if(!isFreshTripLocation(location)){setReview(undefined);return;}
    void api.post('/concierge/local-discovery',{
      ...sessionContext(trip),regionId:region.id,firstVisit:trip.plannedContext?.firstVisit,
      latitude:location?.latitude,longitude:location?.longitude,locationAccuracy:location?.accuracy,
      locationStatus:'AVAILABLE',locationObservedAt:location?.observedAt,
      excludedEntityIds:[...memory.shown.filter(id=>userRequested||id!==displayedOffer.current?.entityId),...memory.declined],
    }).then(({data})=>{
      if(!active)return;
      setReview(data.review);
      consumedRequest.current=requested;
      const latest=readDiscovery(key,localStorage),next=(data.offers||[]).find((o:any)=>o.regionId===region.id&&
        ((!userRequested&&o.entityId===displayedOffer.current?.entityId&&!latest.paused) || canOfferDiscovery(latest,o.entityId,Date.now(),userRequested)));
      if(next){
        setOffer(next);setNotice('');
      }else if(userRequested)setNotice(language==='ko'?'지금 조건에서 새로 제안할 경험은 아직 없어요. 원래 여행을 이어가세요.':'No additional experience fits right now. Continue your trip.');
    }).catch(()=>{if(active){setReview(undefined);consumedRequest.current=requested;if(userRequested)setNotice(language==='ko'?'지금은 추가 경험을 확인하지 못했어요. 원래 여행을 이어갈 수 있어요.':'Unable to check more experiences right now.')}});
    return()=>{active=false};
  },[region.id,trip.updatedAt,tick,busy,requested]);
  useEffect(()=>{
    if(!offer||busy||offer.entityId===displayedOffer.current?.entityId)return;
    const key=discoveryKey(trip),memory=readDiscovery(key,localStorage);
    if(memory.shown.includes(offer.entityId)||memory.declined.includes(offer.entityId)){setOffer(undefined);return}
    displayedOffer.current=offer;
    rememberDiscovery(key,{...memory,shown:[...memory.shown,offer.entityId],lastShownAt:Date.now()},localStorage);
    track('RECOMMENDATION_SHOWN',trip.id,{entityId:offer.entityId,mode,source:'PROACTIVE_LOCAL_DISCOVERY'});
    void recordPartnerRecommendations({regionId:region.id,anonymousTripId:trip.anonymousTripId,entityIds:[offer.entityId]}).catch(()=>undefined);
  },[offer,busy]);
  const next=nextTripAction(trip),needsReplan=Boolean(trip.locationContext?.pendingReplan||review);
  const dismiss=()=>{const key=discoveryKey(trip),memory=readDiscovery(key,localStorage);rememberDiscovery(key,{...memory,declined:offer?[...memory.declined,offer.entityId]:memory.declined,paused:true},localStorage);displayedOffer.current=undefined;setOffer(undefined);setKeep(true)};
  if(!next&&!offer&&!notice)return null;
  return <section className="concierge-next" aria-label={language==='ko'?'지금 다음 행동':'Your next action'}>
    {next&&mode!=='PLAN'&&<div><small>{language==='ko'?'이어서 할 일':'Up next'}</small><h2>{recommendationItemLabel(next)}</h2>
      <p>{needsReplan&&!keep?(language==='ko'?review||'위치가 달라져 남은 일정을 다시 살펴볼 수 있어요.':'Conditions changed. Review the remaining trip.'):(language==='ko'?'저장한 일정의 다음 장소예요. 출발하거나 다른 곳을 살펴보세요.':'This is the next place in your saved trip.')}</p>
      <EntityActions entity={next} showItineraryAdd={false} onNavigate={()=>{
        const entityId=canonicalEntityId(next);if(!entityId)return;
        saveTripSession(executionState(ensureTripSession(region.id),entityId,'EN_ROUTE'));
        track('JOURNEY_START_ACTION',trip.id,{entityId});
      }}/>
      <button className="btn btn-outline" disabled={busy} onClick={()=>onReplan('현재 위치와 시간·날씨를 보고 남은 일정에서 다음 장소를 다시 추천해 주세요.')}>{language==='ko'?'다른 곳 보기':'See another place'}</button>
      {needsReplan&&!keep&&<button className="btn btn-text" onClick={dismiss}>{language==='ko'?'원래 일정 유지':'Keep my plan'}</button>}
    </div>}
    {offer&&!busy&&<div className="local-discovery-offer"><small>{language==='ko'?'이런 경험도 있어요':'You might also enjoy'}</small><h2>{offer.label}</h2><p>{language==='ko'?offer.reason:'I found another nearby experience that fits the available trip information.'}</p><p>{language==='ko'?offer.detail:'Checked against registered opening and visit times. Confirm the actual route and today’s availability before leaving.'}</p>
      <EntityActions entity={offer}/>
      <button className="btn btn-text" onClick={()=>{displayedOffer.current=undefined;setOffer(undefined);setRequested(n=>n+1)}}>{language==='ko'?'다른 경험 보기':'Another experience'}</button>
      <button className="btn btn-text" onClick={dismiss}>{language==='ko'?'괜찮아요, 원래대로':'No thanks, keep my plan'}</button>
    </div>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
