import { useEffect, useRef, useState } from 'react';
import { fetchLiveRuntimeContext, type LiveRuntimeResponse } from '../api/client';
import { liveRuntimeForRegion, regionalRuntimeStatusLabel } from '../liveRuntimeGuard';

const WEATHER_LABELS: Record<string, string> = {
  CLEAR: '맑음', CLOUDY: '흐림', LIGHT_RAIN: '약한 비', RAIN: '비', HEAVY_RAIN: '강한 비',
  THUNDERSTORM: '뇌우', SNOW: '눈', UNKNOWN: '날씨 정보 없음',
};

export default function GajoLiveStatus({ contextNo, onLiveRefresh,regionName,regionId,liveEnabled }: { contextNo?: string;regionName:string;regionId:string;liveEnabled:boolean; onLiveRefresh?: (live: LiveRuntimeResponse) => Promise<void> | void }) {
  const [live, setLive] = useState<LiveRuntimeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const requestVersion=useRef(0);
  const refresh = async (notify: boolean) => {
    if(!liveEnabled){setLive(null);return}
    const version=++requestVersion.current;setLoading(true);
    try {
      const response = liveRuntimeForRegion(await fetchLiveRuntimeContext(regionId,contextNo),regionId);
      if(version!==requestVersion.current)return;
      setLive(response||null);
      if (response&&notify && onLiveRefresh) await onLiveRefresh(response);
    } catch { setLive(null); } finally { setLoading(false); }
  };
  useEffect(() => { requestVersion.current+=1;setLive(null);if(liveEnabled)void refresh(false);return()=>{requestVersion.current+=1} }, [contextNo,liveEnabled,regionId]);
  const context = live?.context;
  const status = live?.metadata.status;
  const time = context?.currentTime?.slice(0, 5);
  const weather = WEATHER_LABELS[context?.weatherState || context?.weather] || '날씨 정보 없음';
  const temperature = typeof context?.temperature === 'number' ? `${Math.round(context.temperature)}°C` : null;
  const precipitation = typeof context?.precipitation === 'number' && context.precipitation > 0 ? `비 ${context.precipitation}mm` : null;
  return (
    <div className="live-runtime-status" aria-live="polite">
      <div><span className="live-dot" data-status={status || 'UNAVAILABLE'} /><b>{regionalRuntimeStatusLabel(regionName)}</b></div>
      {context&&status!=='UNAVAILABLE' ? <p>{[time, temperature, precipitation || weather].filter(Boolean).join(' · ')}</p> : <p>{new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} · 날씨 정보 확인 전</p>}
      <small>{status === 'LIVE' ? '실시간 날씨 확인됨' : status === 'STALE' ? '최근 확인한 날씨 정보' : `현재 ${regionName} 날씨 정보는 확인 준비 중입니다.`}</small>
      {onLiveRefresh && <button type="button" className="btn btn-primary btn-block" onClick={() => void refresh(true)} disabled={loading}>{loading ? '확인 중…' : '지금 상황 다시 확인'}</button>}
    </div>
  );
}
