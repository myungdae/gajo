import { useState } from 'react';
import { track } from '../analytics';
import { ensureTripSession } from '../tripSession';
import { navigationTarget, launchNavigation, type NavigationProvider } from '../utils/placeNavigation';
import { getSessionLocation, isOperationalLocation } from '../utils/visitorLocation';
import { useRegion } from '../RegionContext';
import { addEntityToRegionalItinerary, type ItineraryAddResult } from '../journeyExecution';
import { canonicalEntityId, navigationActionLabel } from '../recommendationItem';
import ItineraryAddContinuation from './ItineraryAddContinuation';

type ActionSet={detail?:{url?:string};reserve?:{url?:string};call?:{phone?:string};navigate?:{latitude?:number;longitude?:number;evidenceMode?:'VERIFIED'|'OFFICIAL_PREVIEW'};website?:{url?:string}};
export default function EntityActions({entity,hideDetail=false,navigationLabel,onNavigate,showItineraryAdd=true}:{entity:any;hideDetail?:boolean;navigationLabel?:string;onNavigate?:(provider:NavigationProvider)=>void;showItineraryAdd?:boolean}){
  const region=useRegion(),session=ensureTripSession(region.id),actions=(entity.actions||entity.literalProps?.actions||{})as ActionSet,normalized={...entity,actions},resolvedNavigationLabel=navigationLabel||navigationActionLabel(normalized);
  const[result,setResult]=useState<ItineraryAddResult|null>(null),[startChoices,setStartChoices]=useState(false);
  const id=canonicalEntityId(normalized)||'',name=entity.programLabel||entity.facilityLabel||entity.canonicalLabel||entity.label||entity.name||'';
  const event=(type:any,actionType:string)=>track(type,session.id,{entityId:id,entityType:entity.entityType||entity.literalProps?.category||'UNKNOWN',actionType});
  const open=(url:string,type:any,actionType:string)=>{event(type,actionType);window.open(url,'_blank','noopener,noreferrer')};
  const navigate=(provider:NavigationProvider)=>{const latitude=Number(actions.navigate?.latitude??entity.latitude),longitude=Number(actions.navigate?.longitude??entity.longitude);if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;const location=getSessionLocation(),origin=isOperationalLocation(location)?{latitude:location!.latitude!,longitude:location!.longitude!}:undefined;onNavigate?.(provider);event('NAVIGATION_HANDOFF',provider.toUpperCase());launchNavigation(navigationTarget(provider,{name,latitude,longitude},origin),{mobile:/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)})};
  const add=()=>setResult(addEntityToRegionalItinerary(region.id,normalized,localStorage,track));
  const providers=<div className="tag-row">{(['naver','kakao','tmap']as NavigationProvider[]).map(provider=><button type="button" key={provider} className="btn btn-text" onClick={()=>navigate(provider)}>{({naver:'네이버지도',kakao:'카카오맵',tmap:'TMAP'}as const)[provider]}</button>)}</div>;
  return <><div className="entity-actions">{!hideDetail&&actions.detail?.url&&<button className="btn btn-text" onClick={()=>open(actions.detail!.url!,'ENTITY_DETAIL_OPENED','DETAIL')}>상세보기</button>}{actions.reserve?.url&&<button className="btn btn-primary" onClick={()=>open(actions.reserve!.url!,'BOOKING_HANDOFF','RESERVE')}>예약하기</button>}{actions.call?.phone&&<a className="btn btn-text" href={`tel:${actions.call.phone}`} onClick={()=>event('PHONE_HANDOFF','CALL')}>전화하기</a>}{actions.website?.url&&<button className="btn btn-text" onClick={()=>open(actions.website!.url!,'WEBSITE_HANDOFF','WEBSITE')}>홈페이지</button>}{actions.navigate&&<details><summary className="btn btn-text">{resolvedNavigationLabel}</summary>{providers}{actions.navigate.evidenceMode==='OFFICIAL_PREVIEW'&&<p className="action-helper">공식 데이터에 등록된 위치를 기준으로 길찾기를 엽니다.</p>}</details>}{showItineraryAdd&&id&&<button type="button" className="btn btn-text" onClick={add}>내 여행에 담기</button>}</div>{result&&<ItineraryAddContinuation entity={normalized} result={result} onStart={actions.navigate?()=>setStartChoices(true):undefined} onReset={()=>{setResult(null);setStartChoices(false)}}/>}{startChoices&&<div className="entity-start-providers" role="group" aria-label={`${name}으로 출발할 내비 선택`}>{providers}</div>}</>;
}
