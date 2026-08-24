import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { entryCopy, resolveEntry } from '../regionConfig';
import { ensureTripSession } from '../tripSession';
import { track } from '../analytics';
import { useRegion } from '../RegionContext';
import { regionalPath } from '../regionRouting';
import { useSpeechInput } from '../hooks/useSpeechInput';

export default function HomePage(){
  const navigate=useNavigate(),location=useLocation(),region=useRegion();
  const resolved=resolveEntry(location.search,region),session=ensureTripSession(region.id),[message,setMessage]=useState('');
  const{listening,voiceSupported,voiceError,toggleListening}=useSpeechInput(message,setMessage);
  const link=(path:string)=>regionalPath(path,region.id,location.pathname.startsWith('/gajo'));
  useEffect(()=>{track('ENTRY_SOURCE',session.id,{source:resolved.entrySource});if(resolved.intent)track('QUICK_INTENT_SELECTED',session.id,{intent:resolved.intent.id,campaign:true})},[]);
  const open=(intent:typeof region.quickIntents[number])=>{const initialMessage=intent.context?.rawMessage;track('QUICK_INTENT_SELECTED',session.id,{intent:intent.id});navigate(link(intent.destination),{state:{quickStartPreset:intent.preset,quickIntent:intent.id,quickContext:intent.context,freeTextOpen:intent.id==='free-talk'||Boolean(initialMessage),initialMessage,autoSubmit:Boolean(initialMessage)}})};
  const conciergePath=resolved.mode?`/concierge?mode=${resolved.mode.toLowerCase()}`:'/concierge';
  const beginConversation=()=>navigate(link(conciergePath),{state:{freeTextOpen:true,initialMessage:message.trim()||undefined,autoSubmit:Boolean(message.trim()),tripMode:resolved.mode}});
  const submit=(event:React.FormEvent)=>{event.preventDefault();if(message.trim())beginConversation()};
  const contextualTitle=resolved.intent?.title||entryCopy[resolved.entrySource],examples=region.home.examples.slice(0,3);
  const secondaryIntents=region.quickIntents.filter(intent=>['first-time','food-now','place-now','senior-comfort','nearby','events-today'].includes(intent.id));
  return <div className="home-page home-conversation-first" style={{'--region-accent':region.accent}as React.CSSProperties}>
    <section className="hero home-identity" style={region.home.heroImage?{backgroundImage:`linear-gradient(#1238,#1238),url(${region.home.heroImage})`}:undefined}><small>{region.regionName} 여행 안내</small><h2>{region.home.brandLine||region.heroTitle}</h2><p>{contextualTitle||region.heroSubtitle}</p><span>{region.serviceName}</span></section>
    <section className="home-conversation" aria-labelledby="home-question"><h1 id="home-question">{region.home.question}</h1><p>{region.home.supportingCopy}</p>
      <form onSubmit={submit} className="home-conversation-form"><label className="sr-only" htmlFor="home-message">여행 요청</label><textarea id="home-message" className={listening?'is-voice-listening':undefined} rows={3} value={message} onChange={event=>setMessage(event.target.value)} placeholder="편하게 말씀해 주세요." onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(message.trim())beginConversation()}}}/><div className="home-input-actions"><button type="button" className={`home-voice-button${listening?' is-listening':''}`} onClick={toggleListening} aria-pressed={listening} aria-label={listening?'말하기 중지':'음성으로 말하기'}><span aria-hidden="true">●</span>{listening?' 듣고 있어요… · 중지':' 말하기'}</button><button type="submit" className="btn btn-primary" disabled={!message.trim()}>보내기</button></div></form>
      {(!voiceSupported||voiceError)&&<p className="home-voice-error" role="alert">{voiceError}</p>}
      <div className="home-examples" aria-label={`${region.regionName} 예시 질문`}>{examples.map(example=><button type="button" key={example} onClick={()=>setMessage(example)}>{example}</button>)}</div>
    </section>
    <section className="mode-entry" aria-label="여행 안내 방식"><button onClick={()=>navigate(link('/concierge?mode=plan'),{state:{tripMode:'PLAN'}})}><b>여행 미리 준비하기</b><small>여행 전 일정과 관심사를 함께 준비해요.</small></button><button onClick={()=>navigate(link('/concierge?mode=now'),{state:{tripMode:'NOW'}})}><b>지금 필요한 것</b><small>현재 시간과 상황에 맞춰 바로 찾아드려요.</small></button></section>
    <section className="home-quick-intents" aria-labelledby="home-shortcuts"><h2 id="home-shortcuts">바로 찾기</h2><div>{secondaryIntents.map(intent=><button type="button" key={intent.id} onClick={()=>open(intent)}>{intent.title}</button>)}</div></section>
  </div>
}
