import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { entryCopy, resolveEntry } from '../regionConfig';
import { ensureTripSession } from '../tripSession';
import { track } from '../analytics';
import { useRegion } from '../RegionContext';
import { regionalPath } from '../regionRouting';
import { useSpeechInput } from '../hooks/useSpeechInput';
import TripContinuity from '../components/TripContinuity';
import ExkoRegionKnowledgeLink from '../components/ExkoRegionKnowledgeLink';
import RegionalHero from '../components/RegionalHero';
import type { NearbyCategory } from '../api/client';

export default function HomePage(){
  const navigate=useNavigate(),location=useLocation(),region=useRegion();
  const resolved=resolveEntry(location.search,region),[message,setMessage]=useState('');
  const{listening,voiceSupported,voiceError,toggleListening}=useSpeechInput(message,setMessage);
  const link=(path:string)=>regionalPath(path,region.id,location.pathname.startsWith('/gajo'));
  const session=()=>ensureTripSession(region.id);
  const open=(intent:typeof region.quickIntents[number])=>{const initialMessage=intent.context?.rawMessage,current=session();track('QUICK_INTENT_SELECTED',current.id,{intent:intent.id});navigate(link(intent.destination),{state:{quickStartPreset:intent.preset,quickIntent:intent.id,quickContext:intent.context,freeTextOpen:intent.id==='free-talk'||Boolean(initialMessage),initialMessage,autoSubmit:Boolean(initialMessage)}})};
  const conciergePath=resolved.mode?`/concierge?mode=${resolved.mode.toLowerCase()}`:'/concierge';
  const beginConversation=()=>{session();navigate(link(conciergePath),{state:{freeTextOpen:true,initialMessage:message.trim()||undefined,autoSubmit:Boolean(message.trim()),tripMode:resolved.mode}})};
  const submit=(event:React.FormEvent)=>{event.preventDefault();if(message.trim())beginConversation()};
  const contextualTitle=resolved.intent?.title||entryCopy[resolved.entrySource],examples=region.home.examples.slice(0,3);
  const secondaryIntents=region.quickIntents.filter(intent=>['first-time','food-now','place-now','senior-comfort','nearby','events-today'].includes(intent.id));
  const chooseMode=(mode:'PLAN'|'NOW')=>{session();navigate(link(`/concierge?mode=${mode.toLowerCase()}`),{state:{tripMode:mode}})};
  const findNearby=(category:NearbyCategory='TOURIST_ATTRACTION')=>{const current=session();track('QUICK_INTENT_SELECTED',current.id,{intent:category==='LODGING'?'nearby-lodging':category==='FOOD'?'food-now':'nearby'});navigate(link('/nearby-discovery'),{state:{category}})};
  const askNow=(initialMessage:string)=>{session();navigate(link('/concierge?mode=now'),{state:{tripMode:'NOW',freeTextOpen:true,initialMessage,autoSubmit:true}})};
  return <div className="home-page home-conversation-first" style={{'--region-accent':region.accent}as React.CSSProperties}>
    <RegionalHero region={region} description={contextualTitle} onPlan={()=>chooseMode('PLAN')} onNearby={()=>findNearby()} />
    <section className="home-arrival" aria-labelledby="home-arrival-title"><div><p className="eyebrow">여행 중 필요한 다음 행동</p><h2 id="home-arrival-title">{region.regionName}에 오셨나요?<br/>지금 필요한 것을 말씀해 주세요.</h2><p>현재 위치와 여행 상황에 맞춰<br/>먹을 곳 · 쉴 곳 · 갈 곳을 찾아드립니다.</p></div><div className="home-arrival-actions" aria-label={`${region.regionName}에서 지금 필요한 것`}><button type="button" onClick={()=>findNearby('FOOD')}>지금 밥 먹고 싶어요</button><button type="button" onClick={()=>askNow('잠깐 쉬고 싶어요.')}>잠깐 쉬고 싶어요</button><button type="button" onClick={()=>findNearby('TOURIST_ATTRACTION')}>주변을 찾고 싶어요</button><button type="button" onClick={()=>askNow('지금 상황에서 다음 갈 곳을 추천해 주세요.')}>다음 갈 곳 추천</button><button type="button" onClick={()=>findNearby('LODGING')}>숙소 찾기</button></div><small>위치 권한은 주변 찾기에서 ‘현재 위치로 찾기’를 누를 때만 요청합니다.</small></section>
    <ExkoRegionKnowledgeLink regionId={region.id}/>
    <TripContinuity />
    <section className="home-conversation" aria-labelledby="home-question"><h2 id="home-question">{region.home.question}</h2><p>{region.home.supportingCopy}</p>
      <form onSubmit={submit} className="home-conversation-form"><label className="sr-only" htmlFor="home-message">여행 요청</label><textarea id="home-message" className={listening?'is-voice-listening':undefined} rows={3} value={message} onChange={event=>setMessage(event.target.value)} placeholder="편하게 말씀해 주세요." onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(message.trim())beginConversation()}}}/><div className="home-input-actions"><button type="button" className={`home-voice-button${listening?' is-listening':''}`} onClick={toggleListening} aria-pressed={listening} aria-label={listening?'말하기 중지':'음성으로 말하기'}><span aria-hidden="true">●</span>{listening?' 듣고 있어요… · 중지':' 말하기'}</button><button type="submit" className="btn btn-primary" disabled={!message.trim()}>보내기</button></div></form>
      {(!voiceSupported||voiceError)&&<p className="home-voice-error" role="alert">{voiceError}</p>}
      <div className="home-examples" aria-label={`${region.regionName} 예시 질문`}>{examples.map(example=><button type="button" key={example} onClick={()=>setMessage(example)}>{example}</button>)}</div>
    </section>
    <section className="mode-entry" aria-label="여행 시작 방법" style={region.id==='hapcheon'?{gridTemplateColumns:'minmax(0, 1fr)'}:undefined}><button type="button" onClick={()=>chooseMode('PLAN')}><span className="mode-entry-icon" aria-hidden="true">✦</span><b>여행을 계획하고 싶어요</b><small>일정과 가볼 곳을 함께 만들어 드려요.</small></button><button type="button" onClick={()=>chooseMode('NOW')}><span className="mode-entry-icon" aria-hidden="true">→</span><b>지금 어디로 갈까요?</b><small>식당·카페·관광지 등 지금 필요한 곳을 찾아드려요.</small></button></section>
    <p className="home-no-signup">회원가입 없이 바로 시작할 수 있어요</p>
    <section className="home-quick-intents" aria-labelledby="home-shortcuts"><h2 id="home-shortcuts">바로 찾기</h2><div>{secondaryIntents.map(intent=><button type="button" key={intent.id} onClick={()=>open(intent)}>{intent.title}</button>)}<button type="button" onClick={()=>findNearby('LODGING')}>근처 숙소</button></div></section>
  </div>
}
