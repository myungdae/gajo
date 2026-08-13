import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOntologyStats } from '../api/client';
import { QUICK_START_PRESETS } from '../quickStartPresets';

const quickStarts=Object.values(QUICK_START_PRESETS);

export default function HomePage(){
  const navigate=useNavigate(); const[stats,setStats]=useState<any>(null); const[statsState,setStatsState]=useState<'loading'|'ready'|'unavailable'>('loading');
  useEffect(()=>{fetchOntologyStats().then(value=>{const valid=['totalTriples','classCount','propertyCount','individualCount'].every(key=>Number.isFinite(value?.[key])&&value[key]>0);if(valid){setStats(value);setStatsState('ready')}else setStatsState('unavailable')}).catch(()=>setStatsState('unavailable'))},[]);
  return <div>
    <div className="hero"><h2>가조온천에 오신 것을 환영합니다</h2><p>함께 오신 분, 머무는 시간, 이동 방법과 현재 상황을 고려해 지금 가장 편안한 일정을 추천해드려요.</p></div>
    <div className="quick-grid">{quickStarts.map(preset=><button key={preset.id} onClick={()=>navigate(preset.destination,{state:{quickStartPreset:preset.id}})}><span className="emoji">{preset.emoji}</span>{preset.title}</button>)}</div>
    <div className="card"><h2>AI 컨시어지에게 바로 물어보세요</h2><p style={{fontSize:13,color:'var(--color-text-muted)',marginBottom:12}}>자연어로 편하게 말하거나 몇 가지 조건을 선택해 주세요.</p><button className="btn btn-primary btn-block" onClick={()=>navigate('/concierge')}>💬 AI 컨시어지 시작하기</button></div>
    <div className="card engine-status" aria-live="polite"><h2>서비스 엔진 상태</h2>{statsState==='loading'&&<p>엔진 상태 확인 중</p>}{statsState==='unavailable'&&<p>엔진 상태를 확인할 수 없습니다.</p>}{statsState==='ready'&&stats&&<p>맞춤 일정 추천 엔진이 준비되었습니다.</p>}</div>
  </div>;
}
