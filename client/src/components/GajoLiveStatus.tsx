import { RECOMMENDATION_REQUEST_COPY } from '../recommendationRequestCopy';
import { useRegionalLanguage } from '../RegionalLanguageContext';
import { useEffect, useRef, useState } from 'react';
import { fetchLiveRuntimeContext, type LiveRuntimeResponse } from '../api/client';
import { liveRuntimeForRegion } from '../liveRuntimeGuard';

import { weatherStatusLabel, liveStatusHeading, liveRegionName } from '../liveStatusPresentation';

export default function GajoLiveStatus({ contextNo, onLiveRefresh,regionName,regionId,liveEnabled,actionOnly=false,disabled=false }: { actionOnly?:boolean;disabled?:boolean;contextNo?: string;regionName:string;regionId:string;liveEnabled:boolean; onLiveRefresh?: (live: LiveRuntimeResponse) => Promise<void> | void }) {
  const {language}=useRegionalLanguage(); const [live, setLive] = useState<LiveRuntimeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshFailed,setRefreshFailed]=useState(false);
  const requestVersion=useRef(0),refreshPending=useRef(false);
  const requestCopy=RECOMMENDATION_REQUEST_COPY[language];
  const refresh = async (notify: boolean) => {
    if(notify&&(refreshPending.current||disabled))return;
    if(!liveEnabled){setLive(null);return}
    if(notify){refreshPending.current=true;setRefreshFailed(false);}
    const version=++requestVersion.current;setLoading(true);
    try {
      const response = liveRuntimeForRegion(await fetchLiveRuntimeContext(regionId,contextNo),regionId);
      if(version!==requestVersion.current)return;
      setLive(response||null);
      if(notify&&!response)setRefreshFailed(true);
      if (response&&notify && onLiveRefresh) await onLiveRefresh(response);
    } catch { setLive(null);if(notify)setRefreshFailed(true); } finally { if(notify)refreshPending.current=false;setLoading(false); }
  };
  useEffect(() => { requestVersion.current+=1;setLive(null);if(liveEnabled&&!actionOnly)void refresh(false);return()=>{requestVersion.current+=1} }, [contextNo,liveEnabled,regionId,actionOnly]);
  const context = live?.context;
  const status = live?.metadata.status;
  const time = context?.currentTime?.slice(0, 5);
  const weather = weatherStatusLabel(context?.weatherState || context?.weather, language);
  const temperature = typeof context?.temperature === 'number' ? `${Math.round(context.temperature)}°C` : null;
  const precipitation = typeof context?.precipitation === 'number' && context.precipitation > 0 ? `${language === 'en' ? 'Rain' : '비'} ${context.precipitation}mm` : null;
  const automaticAction=onLiveRefresh&&<section className="automatic-recommendation-choice" aria-label={requestCopy.automatic} aria-busy={loading}><p>{requestCopy.automaticHelp}</p><button type="button" className="btn btn-primary btn-block" onClick={()=>void refresh(true)} disabled={loading||disabled||!liveEnabled}>{loading?requestCopy.checking:requestCopy.automatic}</button>{refreshFailed&&<p role="status">{requestCopy.unavailable}</p>}</section>;
  if(actionOnly)return automaticAction;
  return (
    <div className="live-runtime-status" aria-live="polite">
      <div><span className="live-dot" data-status={status || 'UNAVAILABLE'} /><b>{liveStatusHeading(regionId, regionName, language)}</b></div>
      {context&&status!=='UNAVAILABLE' ? <p>{[time, temperature, precipitation || weather].filter(Boolean).join(' · ')}</p> : <p>{new Date().toLocaleTimeString(language === 'en' ? 'en-US' : 'ko-KR',{hour:'2-digit',minute:'2-digit'})} · {language === 'en' ? 'Weather not checked' : '날씨 정보 확인 전'}</p>}
      <small>{language === 'en' ? (status === 'LIVE' ? 'Current weather checked' : status === 'STALE' ? 'Recently checked weather' : `Weather information for ${liveRegionName(regionId, regionName, language)} is being prepared.`) : status === 'LIVE' ? '실시간 날씨 확인됨' : status === 'STALE' ? '최근 확인한 날씨 정보' : `현재 ${regionName} 날씨 정보는 확인 준비 중입니다.`}</small>
      {automaticAction}
    </div>
  );
}
