import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { REGION_CONFIG, entryCopy, resolveEntry } from '../regionConfig';
import { ensureTripSession } from '../tripSession';
import { track } from '../analytics';

export default function HomePage(){
  const navigate=useNavigate();const location=useLocation();const resolved=resolveEntry(location.search);const session=ensureTripSession(REGION_CONFIG.id);
  useEffect(()=>{track('ENTRY_SOURCE',session.id,{source:resolved.entrySource});if(resolved.intent)track('QUICK_INTENT_SELECTED',session.id,{intent:resolved.intent.id,campaign:true})},[]);
  const open=(intent:typeof REGION_CONFIG.quickIntents[number])=>{track('QUICK_INTENT_SELECTED',session.id,{intent:intent.id});navigate(intent.destination,{state:{quickStartPreset:intent.preset,quickIntent:intent.id,quickContext:intent.context,freeTextOpen:intent.id==='free-talk'}})};
  return <div className="home-page">
    <section className="hero"><small>{REGION_CONFIG.regionName} 여행 안내</small><h2>{resolved.intent?.title||entryCopy[resolved.entrySource]||'지금 무엇이 필요하세요?'}</h2><p>{REGION_CONFIG.heroCopy}</p><span>{REGION_CONFIG.serviceName}</span></section>
    <section className="mode-entry"><button onClick={()=>navigate('/concierge?mode=plan',{state:{tripMode:'PLAN'}})}><b>여행 미리 준비하기</b><small>당일·숙박 일정 미리 만들기</small></button><button onClick={()=>navigate('/concierge?mode=now',{state:{tripMode:'NOW'}})}><b>지금 필요한 것</b><small>현재 상황에 맞춰 이어보기</small></button></section>
    <section className="quick-section" aria-labelledby="quick-title"><div className="section-heading"><small>여행 시작하기</small><h2 id="quick-title">지금 무엇이 필요하세요?</h2></div><div className="quick-list">{REGION_CONFIG.quickIntents.map((intent,index)=><button key={intent.id} onClick={()=>open(intent)}><span className={`service-icon service-icon-${index%4+1}`} aria-hidden="true"/><span><b>{intent.title}</b><small>{intent.description}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>)}</div></section>
    <section className="direct-concierge"><small>계획이 달라져도 괜찮아요</small><h2>상황이 달라졌나요?</h2><p>비, 피로, 지연, 휴무 같은 변화를 알려주면 남은 일정만 다시 살펴봐요.</p><button className="btn btn-primary" onClick={()=>navigate('/concierge',{state:{freeTextOpen:true}})}>그냥 말할게요 <span aria-hidden="true">→</span></button></section>
  </div>;
}
