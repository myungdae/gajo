import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { postConciergeChat, runDemoScenario, type ConciergeChatResponse, type CreateContextInput } from '../api/client';
import GajoLiveStatus from '../components/GajoLiveStatus';
import VisitorLocationControl from '../components/VisitorLocationControl';
import RecommendationItineraryItem from '../components/RecommendationItineraryItem';
import { getSessionLocation } from '../utils/visitorLocation';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { buildContextSummary } from '../utils/contextSummary';
import StructuredVisitorIntake from '../components/StructuredVisitorIntake';
import PlanVisitorIntake from '../components/PlanVisitorIntake';
import { getQuickStartPreset } from '../quickStartPresets';
import { ensureTripSession, loadTripSession, mergeTravelContext, saveTripSession, sessionContext, type PlannedContext } from '../tripSession';
import { REGION_INTEREST_OPTIONS } from '../regionConfig';
import { track } from '../analytics';
import { buildNowContinuation } from '../nowContinuation';
import { useRegion } from '../RegionContext';
import { regionalPath } from '../regionRouting';
import { regionalRuntimeView } from '../regionalRuntime';
import { SHARED_VISITOR_COPY } from '../visitorCopy';
import InstallExperience from '../components/InstallExperience';
import FullJourneySave from '../components/FullJourneySave';

interface Message {
  role: 'user' | 'ai';
  text: string;
  result?: ConciergeChatResponse;
}

function summarizeResult(result: ConciergeChatResponse): string {
  const rec = result.recommendation;
  if (result.error) {
    return '죄송합니다. 말씀하신 내용을 일정으로 구성하지 못했습니다. 원하는 방문 상황을 조금 더 구체적으로 말씀해 주세요.';
  }
  if (result.visitorMessage) return result.visitorMessage;
  if(result.discovery)return result.discovery.entities.length?`${result.discovery.entities.length}곳을 조건에 맞춰 찾았습니다.`:'조건에 맞는 검증된 장소를 아직 찾지 못했습니다.';
  if (!rec) {
    return '요청을 접수했습니다. 조건을 분석했지만 아직 추천할 프로그램을 찾지 못했습니다.';
  }
  return rec.reasonSummary || '말씀하신 상황에 맞춰 편안한 일정을 준비했습니다.';
}

export default function ConciergePage() {
  const region=useRegion();
  const regionLink=(path:string)=>regionalPath(path,region.id);
  const navigate = useNavigate();
  const location = useLocation();
  const entryState=(location.state as {quickStartPreset?:unknown;quickContext?:CreateContextInput;freeTextOpen?:boolean;tripMode?:'PLAN'|'NOW';initialMessage?:string;autoSubmit?:boolean}|null);const queryMode=new URLSearchParams(location.search).get('mode')?.toUpperCase();const tripMode: 'PLAN'|'NOW'|'GENERIC'=entryState?.tripMode||(queryMode==='PLAN'||queryMode==='NOW'?queryMode:'GENERIC');const preset = getQuickStartPreset(entryState?.quickStartPreset);const tripSession=ensureTripSession(region.id);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: tripMode==='PLAN'?'여행 날짜를 아직 정하지 않았어도 괜찮아요. 알고 있는 내용만으로 준비할게요.':tripMode==='NOW'?'필요한 선택을 누르거나 달라진 상황을 편하게 알려주세요.':'함께 오신 분, 머무는 시간, 이동 방법, 걷기 편한 정도를 알려주시면 알맞은 일정을 안내해 드릴게요.',
    },
  ]);
  const [input, setInput] = useState(entryState?.initialMessage||'');
  const [loading, setLoading] = useState(false);
  const [requestError,setRequestError]=useState(false);
  const [freeTextOpen,setFreeTextOpen]=useState(Boolean(entryState?.freeTextOpen));
  const [structuredDraft,setStructuredDraft]=useState<CreateContextInput>(()=>mergeTravelContext(sessionContext(tripSession),entryState?.quickContext||preset?.context||{inputMode:'STRUCTURED'}));
  const contextSessionKey=`regional-context-session:${region.id}`;const contextSessionIdRef=useRef(sessionStorage.getItem(contextSessionKey)||crypto.randomUUID());
  const liveStoryRef = useRef<HTMLDivElement>(null);
  const hadRecommendationRef = useRef(false);
  const requestInFlightRef=useRef(false);
  const homeSubmittedRef=useRef(false);
  const voiceButtonRef=useRef<HTMLButtonElement>(null);
  const lastRequestRef=useRef<{text:string;structured?:CreateContextInput}|null>(null);
  const{listening,voiceSupported,voiceError,toggleListening}=useSpeechInput(input,setInput);

  useEffect(()=>{sessionStorage.setItem(contextSessionKey,contextSessionIdRef.current)},[contextSessionKey]);
  useEffect(()=>{if(tripMode==='PLAN')track(tripSession.plannedContext?'PLAN_RESUMED':'PLAN_SESSION_STARTED',tripSession.id);if(tripMode==='NOW'){track('NOW_SESSION_STARTED',tripSession.id);if(tripSession.plannedContext)track('PLAN_NOW_CONTINUED',tripSession.id)}},[]);

  const send = async (overrideText?: string, structured?: CreateContextInput, retry=false) => {
    const text = (overrideText ?? input).trim();
    if ((!text && !structured) || requestInFlightRef.current) return;
    requestInFlightRef.current=true;
    setRequestError(false);
    if(!retry){
      lastRequestRef.current={text,structured};
      setMessages((prev) => [...prev, { role: 'user', text: text || '선택한 조건으로 일정을 추천해 주세요.' }]);
      setInput('');
    }
    setLoading(true);
    track(text?'FREE_LANGUAGE_REQUEST':'STRUCTURED_RECOMMENDATION_REQUESTED',tripSession.id,{mode:tripMode});
    try {
      const gps = tripMode==='PLAN'?null:getSessionLocation();
      const previousContext = [...messages].reverse().find(message => message.result?.context)?.result?.context || {};
      const previousInput = previousContext.raw?.input || previousContext;
      const carriedContext = {
        visitorNo: previousInput.visitorNo || previousContext.visitorNo,
        visitorAge: previousInput.visitorAge,
        healthConditions: previousContext.healthConditions || previousInput.healthConditions,
        wellnessGoals: previousContext.wellnessGoals || previousInput.wellnessGoals,
        activityPreferences: previousContext.activityPreferences || previousInput.activityPreferences,
        companions: previousContext.companions || previousInput.companions,
        weather: previousInput.weather || previousContext.weather,
        congestion: previousInput.congestion,
        temperature: previousContext.temperature,
        precipitation: previousContext.precipitation,
        transportMode: previousContext.transportMode,
        stayUntil: previousContext.stayUntil,
        walkingLevel: previousContext.walkingLevel,
        companionConstraints: previousContext.companionConstraints,
        congestionState: previousContext.congestionState,
        runtimeStates: previousContext.runtimeStates,
      };
      const result = await postConciergeChat({ regionId:region.id,...(hasRecommendation?carriedContext:structuredDraft), ...structured, ...(text?{rawMessage:text,inputMode:'FREE_TEXT' as const}:{}), contextSessionId:contextSessionIdRef.current,isFollowup:hasRecommendation, ...(gps?.status === 'AVAILABLE' ? { latitude: gps.latitude, longitude: gps.longitude, locationAccuracy: gps.accuracy, locationObservedAt: gps.observedAt, locationStatus: gps.status } : tripMode==='PLAN'?{}:{ locationStatus: gps?.status }) });
      const latestSession=loadTripSession(localStorage,region.id)||tripSession;saveTripSession({...latestSession,mode:tripMode==='GENERIC'?latestSession.mode:tripMode,runtimeContext:tripMode==='PLAN'?latestSession.runtimeContext:result.context});
      if(tripMode==='PLAN')track('PLAN_COMPLETED',tripSession.id);if(tripMode==='NOW')track('RUNTIME_HYDRATED',tripSession.id,{location:Boolean(gps?.status==='AVAILABLE')});
      if(result.recommendation)track('RECOMMENDATION_SHOWN',tripSession.id,{mode:tripMode,candidateRegionIds:(result.recommendation.candidateRegionIds||[]).join(',')});
      if(result.intentRoute)track('INTENT_ROUTED',tripSession.id,{intentRoute:result.intentRoute});
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: summarizeResult(result), result },
      ]);
    } catch (e: any) {
      console.error('[concierge] request failed',e);
      setRequestError(true);
      track('RETRY_ERROR',tripSession.id,{stage:'recommendation'});
    } finally {
      requestInFlightRef.current=false;
      setLoading(false);
    }
  };

  useEffect(()=>{if(entryState?.autoSubmit&&entryState.initialMessage&&!homeSubmittedRef.current){homeSubmittedRef.current=true;send(entryState.initialMessage)}},[]);

  const hasRecommendation = messages.some(message => Boolean(message.result?.recommendation));
  const hasPrimaryResult=messages.some(message=>Boolean(message.result?.recommendation||message.result?.discovery));
  const latestRecommendation = [...messages].reverse().find(message => message.result?.recommendation)?.result;
  const latestPrimaryResult=[...messages].reverse().find(message=>message.result?.recommendation||message.result?.discovery)?.result;

  useEffect(() => {
    if (hasPrimaryResult && !hadRecommendationRef.current) {
      requestAnimationFrame(() => liveStoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    hadRecommendationRef.current = hasPrimaryResult;
  }, [hasPrimaryResult]);

  const runDemo = async () => {
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: '맑은 날 78세 어머니를 모시고 자동차로 방문합니다. 어머니는 무릎이 불편해 짧은 보행이 필요하고 오후 5시까지 머물 예정입니다.',
      },
    ]);
    try {
      const result = await runDemoScenario();
      const merged: ConciergeChatResponse = {
        ...result,
        recommendation: (result as any).runResult?.recommendation,
        risks: (result as any).context?.risks,
      } as any;
      setMessages((prev) => [...prev, { role: 'ai', text: summarizeResult(merged), result: merged }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: '데모 시나리오 실행 중 오류: ' + (e?.message || '') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {tripMode!=='PLAN'&&<div ref={liveStoryRef} className="journey-live-context">{tripMode==='NOW'&&<header className="journey-mode-header now"><small>NOW · 여행 중</small><h1>지금 필요한 것</h1><p>현재 시간과 상황에 맞춰 지금 할 수 있는 선택을 찾아드릴게요.</p></header>}<GajoLiveStatus regionName={region.regionName} regionId={region.id} liveEnabled={regionalRuntimeView(region).weatherEnabled}/></div>}
      {tripMode==='NOW'&&tripSession.plannedContext&&<NowContinuationSummary planned={tripSession.plannedContext}/>}
      {tripMode==='NOW'&&!hasPrimaryResult&&(
        <NowImmediateActions onSelect={label=>send(label)}/>
      )}
      {!hasPrimaryResult&&tripMode!=='PLAN'&&<div className="visitor-location-section"><VisitorLocationControl /></div>}
      {!hasPrimaryResult && <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`chat-bubble ${m.role === 'user' ? 'user' : 'ai'}`}>{m.text}</div>
          </div>
        ))}
        {loading && <div className="loading">말씀하신 상황에 맞는 일정을 살펴보고 있습니다...</div>}
      </div>}
      {requestError&&<div className="visitor-error" role="alert"><b>잠시 연결이 원활하지 않습니다.</b><p>다시 한 번 시도해 주세요.</p><button type="button" className="btn btn-outline" onClick={()=>{const last=lastRequestRef.current;if(last)send(last.text,last.structured,true)}}>다시 시도</button></div>}

      {!hasPrimaryResult && <>
        {tripMode==='PLAN'?<PlanVisitorIntake loading={loading} initial={tripSession.plannedContext} onSubmit={(structured,planned:PlannedContext)=>{saveTripSession({...tripSession,mode:'PLAN',plannedContext:planned});send('',structured)}}/>:<StructuredVisitorIntake loading={loading} initialValues={preset?.intakeValues} initialPreferences={preset?.selectedPreferences} entryMessage={preset?.entryMessage} onChange={setStructuredDraft} onSubmit={structured=>send('',structured)}/>}
        <div className="free-text-option"><span>또는</span><button type="button" className="btn btn-outline btn-block" aria-expanded={freeTextOpen} onClick={()=>setFreeTextOpen(open=>!open)}>그냥 말로 알려줄게요</button><p>선택하기 번거로우시면 편하게 말씀해 주세요.</p></div>
      </>}

      {hasRecommendation && latestRecommendation && <div className="recommendation-journey-start">
        {tripMode==='PLAN'&&tripSession.plannedContext&&<PlanSummary planned={tripSession.plannedContext}/>}
        <UnderstoodContext result={latestRecommendation} />
        <ResultPanel result={latestRecommendation} onFindNearbyRestaurants={() => navigate(regionLink('/nearby-discovery'))} />
        <FullJourneySave itinerary={latestRecommendation.recommendation?.itinerary} durationLabel={tripSession.plannedContext?.duration==='1N2D'?'1박2일':tripSession.plannedContext?.duration==='2N3D'?'2박3일':undefined}/>
        <section className="card runtime-journey-card">
          <h2>상황이 바뀌면</h2>
          <p>날씨와 현재 상황이 달라지면 남은 일정을 다시 확인할 수 있어요.</p>
          <button className="btn btn-primary btn-block" onClick={() => navigate(regionLink('/itinerary'), { state: { result: latestRecommendation } })}>지금 상황 다시 확인</button>
          <details className="demo-tools"><summary>시연·테스트</summary><p>발표용으로 13시 강한 비 상황을 재현합니다.</p><button className="btn btn-outline btn-block" onClick={runDemo} disabled={loading}>13시 강한 비 상황 재현</button></details>
        </section>
        {loading && <div className="loading">이어서 살펴보고 있습니다...</div>}
      </div>}

      {latestPrimaryResult?.discovery&&<div className="recommendation-journey-start"><UnderstoodContext result={latestPrimaryResult}/><PlaceDiscoveryPanel result={latestPrimaryResult}/>{loading&&<div className="loading">이어서 살펴보고 있습니다...</div>}</div>}
      <InstallExperience usefulResult={hasPrimaryResult}/>

      {(hasPrimaryResult||freeTextOpen) && <div className={hasPrimaryResult ? 'concierge-followup-composer' : 'concierge-input-panel'}>
        <div className="input-panel-heading">
          {!hasPrimaryResult && <small>말하거나 직접 입력하세요</small>}
          <h2>{hasPrimaryResult ? '다른 조건도 말씀해 주세요' : '직접 이야기해 보세요'}</h2>
        </div>
        <textarea
          className={listening ? 'is-voice-listening' : undefined}
          rows={hasPrimaryResult ? 2 : 5}
          placeholder={hasPrimaryResult ? '다른 장소나 조건을 말씀해주세요.' : '예: 가족과 함께 편안하게 힐링할 수 있는 온천 코스를 추천해주세요.'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="voice-input">
          <button ref={voiceButtonRef} type="button" className={`speech-session-button${listening?' is-listening':''}`} onClick={toggleListening} disabled={loading} aria-pressed={listening} aria-label={listening?'말하기 끝':'한국어로 여행 조건 말하기'}>
            <span className="voice-dot" aria-hidden="true">●</span>
            <strong>{listening?'듣고 있어요... · 말하기 끝':'말하기'}</strong>
            <span className={`voice-bars${listening?' is-listening':''}`} aria-hidden="true"><i/><i/><i/><i/><i/><i/></span>
          </button>
          {!hasPrimaryResult && <p>말씀하신 내용이 위 입력창에 들어갑니다. 음성은 저장하지 않아요.</p>}
        </div>
        <p className="voice-helper" role="status">{listening?'듣고 있어요. 계속 말씀하시거나 ‘말하기 끝’을 눌러 주세요.':'말씀하신 내용이 위 입력창에 들어갑니다. 음성은 저장하지 않아요.'}</p>
        {(!voiceSupported||voiceError)&&<p className="voice-error" role="alert">{voiceError}</p>}
        <button className="btn btn-primary btn-block concierge-submit" onClick={() => send()} disabled={loading}>
          {hasPrimaryResult ? '전송' : '대화로 찾기'}
        </button>
      </div>}
    </div>
  );
}

/**
 * Builds a uri -> 한글 라벨 lookup from every source available on the
 * response (riskLabels/usedAgentLabels from the backend, plus every
 * subject/object label already present in the recommendation's evidence
 * chain). Falls back to a shortened URI (gajo:xxx / roo:xxx) when no
 * label can be found, so the chat panel never shows a bare full URI.
 */
function NowContinuationSummary({planned}:{planned:PlannedContext}){const summary=buildNowContinuation(planned);if(!summary)return null;return <section className="plan-continuity now-continuation" aria-labelledby="now-continuation-title"><h2 id="now-continuation-title">준비해 둔 여행을 이어갈게요.</h2>{summary.circumstances.length>0&&<p>{summary.circumstances.join(' · ')}</p>}{summary.interests.length>0&&<p>{summary.interests.join(' · ')}</p>}<strong>달라진 점만 알려주세요.</strong></section>}

function NowImmediateActions({onSelect}:{onSelect:(label:string)=>void}){return <section className="now-needs" aria-labelledby="now-needs-title"><h2 id="now-needs-title">바로 필요한 것을 선택하세요</h2>{['지금 갈 곳','오늘 뭐 먹을까요?','한 시간 남았어요','내 주변','오늘 행사','비가 와요','쉬고 싶어요'].map(label=><button type="button" key={label} onClick={()=>onSelect(label)}>{label}</button>)}</section>}

function PlanSummary({planned}:{planned:PlannedContext}){const duration={DAY:'당일','1N2D':'1박 2일','2N3D':'2박 3일',CUSTOM:'날짜 직접 선택'}[planned.duration||'CUSTOM'];const companion=planned.companions?.[0]?.relationship;return <section className="plan-summary"><small>내 여행 준비</small><h2>{duration}</h2><p>{[companion==='parent'?'부모님과 함께':companion==='spouse'?'부부 여행':companion==='child'?'아이와 함께':companion?'가족 여행':'동행 미정',planned.transportMode==='CAR'?'자동차':planned.transportMode==='WALK'?'도보':planned.transportMode==='PUBLIC_TRANSPORT'?'대중교통':null,planned.walkingLevel==='LOW'?'짧은 보행':planned.walkingLevel==='HIGH'?'걷기 여유':planned.walkingLevel==='MODERATE'?'보통 걷기':null].filter(Boolean).join(' · ')}</p><p>{planned.interests?.map(id=>REGION_INTEREST_OPTIONS.find(x=>x.id===id)?.label||id).join(' · ')}</p>{planned.mustVisitPlaces?.length?<p>꼭 가고 싶은 곳: {planned.mustVisitPlaces.map(x=>x.label).join(', ')}</p>:null}</section>}

function UnderstoodContext({ result }: { result: ConciergeChatResponse }) {
  const rows = buildContextSummary(result.context || {});
  return <section className="understood-context-card"><h2>{SHARED_VISITOR_COPY.understoodHeading}</h2>{rows.length ? <dl>{rows.map(row => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl> : <p className="muted-line">말씀하신 방문 상황을 바탕으로 일정을 구성했습니다.</p>}</section>;
}

function ResultPanel({
  result,
  onFindNearbyRestaurants,
}: {
  result: ConciergeChatResponse;
  onFindNearbyRestaurants: () => void;
}) {
  const rec = result.recommendation;
  const itinerarySteps: any[] = rec?.itinerary?.steps || rec?.steps || [];

  return (
    <section className="recommendation-section">
      {rec && <><h2>{SHARED_VISITOR_COPY.recommendationHeading}</h2>{rec.reasonSummary && <div className="visitor-reason-summary"><b>이렇게 추천한 이유</b><p>{rec.reasonSummary}</p></div>}</>}
      {(result.nearbyDiscoveryIntent || result.nearbyRestaurantIntent) && (
        <div
          style={{
            marginBottom: 12,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 10,
            padding: 12,
          }}
        >
          <b style={{ fontSize: 13 }}>실제 내 위치 기준으로 찾아드릴까요?</b>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '6px 0 10px' }}>
            현재 위치를 기준으로 맛집, 카페, 숙박, 온천, 체험 등 실제 주변 장소를 찾아볼 수 있어요.
            보여주고, 선택하시면 도보 경로와 길찾기까지 안내해드립니다.
          </p>
          <button className="btn btn-primary btn-block" onClick={onFindNearbyRestaurants}>
            주변 즐길거리 찾기
          </button>
        </div>
      )}

      {rec && itinerarySteps.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <b className="itinerary-label">추천 일정</b>
          {itinerarySteps.map((step: any, i: number) => <RecommendationItineraryItem step={step} index={i} key={step.itemId||step.entityId||step.programUri||i}/>)}
        </div>
      )}

    </section>
  );
}

function PlaceDiscoveryPanel({result}:{result:ConciergeChatResponse}){const discovery=result.discovery!,label={CAFE:'카페',FOOD:'식당',LODGING:'숙소',ACTIVITY:'체험',TOURISM_NATURE:'관광지',CONVENIENCE:'편의시설'}[discovery.category]||'장소';return <section className="recommendation-section place-discovery-results"><h2>조건에 맞는 {label}</h2><p className="text-muted">검증된 지역 운영 데이터에서 맞는 장소만 보여드려요. 현재 영업 여부는 방문 전에 확인해 주세요.</p>{discovery.entities.length?discovery.entities.map((entity:any,index:number)=><div className="place-discovery-item" key={entity.entityId}><RecommendationItineraryItem step={entity} index={index}/>{entity.reasons?.length>0&&<p className="place-discovery-reasons">{entity.reasons.join(' · ')}</p>}</div>):<p className="text-muted">현재 조건에 맞는 검증된 장소가 없습니다.</p>}</section>}
