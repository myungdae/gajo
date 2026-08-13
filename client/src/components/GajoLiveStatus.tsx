import { useEffect, useState } from 'react';
import { fetchLiveRuntimeContext, type LiveRuntimeResponse } from '../api/client';

const WEATHER_LABELS: Record<string, string> = {
  CLEAR: '맑음', CLOUDY: '흐림', LIGHT_RAIN: '약한 비', RAIN: '비', HEAVY_RAIN: '강한 비',
  THUNDERSTORM: '뇌우', SNOW: '눈', UNKNOWN: '날씨 정보 없음',
};

export default function GajoLiveStatus({ contextNo, onLiveRefresh }: { contextNo?: string; onLiveRefresh?: (live: LiveRuntimeResponse) => Promise<void> | void }) {
  const [live, setLive] = useState<LiveRuntimeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = async (notify: boolean) => {
    setLoading(true);
    try {
      const response = await fetchLiveRuntimeContext(contextNo);
      setLive(response);
      if (notify && onLiveRefresh) await onLiveRefresh(response);
    } catch { setLive(null); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(false); }, [contextNo]);
  const context = live?.context;
  const status = live?.metadata.status;
  const time = context?.currentTime?.slice(0, 5);
  const weather = WEATHER_LABELS[context?.weatherState || context?.weather] || '날씨 정보 없음';
  const temperature = typeof context?.temperature === 'number' ? `${Math.round(context.temperature)}°C` : null;
  const precipitation = typeof context?.precipitation === 'number' && context.precipitation > 0 ? `비 ${context.precipitation}mm` : null;
  return (
    <div className="live-runtime-status" aria-live="polite">
      <div><span className="live-dot" data-status={status || 'UNAVAILABLE'} /><b>지금 가조</b></div>
      {context ? <p>{[time, temperature, precipitation || weather].filter(Boolean).join(' · ')}</p> : <p>현재 상황을 확인하고 있습니다.</p>}
      <small>{status === 'LIVE' ? '실시간 날씨 확인됨' : status === 'STALE' ? '최근 확인한 날씨 정보' : '실시간 날씨를 확인할 수 없습니다'}</small>
      {onLiveRefresh && <button type="button" className="btn btn-primary btn-block" onClick={() => void refresh(true)} disabled={loading}>{loading ? '확인 중…' : '지금 상황 다시 확인'}</button>}
    </div>
  );
}
