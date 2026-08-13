import { useState } from 'react';
import { getSessionLocation, isOperationalLocation, locationConfidence, observeVisitorLocation, type VisitorLocation } from '../utils/visitorLocation';

export default function VisitorLocationControl({onLocation}:{onLocation?:(location:VisitorLocation)=>void}){
  const[location,setLocation]=useState<VisitorLocation|null>(getSessionLocation());
  const[loading,setLoading]=useState(false);
  const request=async()=>{setLoading(true);const value=await observeVisitorLocation();setLocation(value);setLoading(false);onLocation?.(value)};
  const confidence=location?.status==='AVAILABLE'?locationConfidence(location.accuracy):undefined;
  return <div className="visitor-location-control">
    <p>현재 위치를 사용하면 가까운 장소와 이동 부담을 고려한 일정을 추천할 수 있습니다. 위치는 브라우저 세션에서만 사용합니다.</p>
    {isOperationalLocation(location)&&<p><b>현재 위치 확인됨</b> · 정확도 약 {Math.round(location!.accuracy||0)}m · {confidence} · 위치 기반 추천 적용</p>}
    {location?.status==='AVAILABLE'&&!isOperationalLocation(location)&&<p><b>현재 위치를 정확하게 확인하지 못했습니다.</b><br/>위치를 다시 확인하면 가까운 장소와 이동시간을 더 정확하게 안내할 수 있습니다.</p>}
    {location&&location.status!=='AVAILABLE'&&<p>위치 권한 없이도 이용할 수 있습니다. 거리 정보는 표시하지 않을 수 있습니다.</p>}
    <button type="button" className="btn btn-outline btn-block" onClick={request} disabled={loading}>{loading?'위치 확인 중…':location?'위치 다시 확인':'현재 위치 사용'}</button>
  </div>
}
