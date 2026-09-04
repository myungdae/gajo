import { useEffect, useRef } from 'react';
import { visitorTrack } from '../visitorAnalytics';
import { useRegion } from '../RegionContext';
import { ensureTripSession } from '../tripSession';
export default function RecommendationExposure({placeKey}:{placeKey:string}) {
  const region=useRegion(), ref=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    if (!placeKey || !window.location.pathname.includes('/concierge') || !ref.current || typeof IntersectionObserver==='undefined') return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){visitorTrack('PLACE_RECOMMENDATION_SHOWN',region.id,ensureTripSession(region.id).id,{placeKey});observer.disconnect();}});
    observer.observe(ref.current);return()=>observer.disconnect();
  },[region.id,placeKey]);
  return <span ref={ref} aria-hidden="true" style={{display:'block',height:1}}/>;
}
