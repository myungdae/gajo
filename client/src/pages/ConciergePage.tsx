import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { postConciergeChat, runDemoScenario, type ConciergeChatResponse, type CreateContextInput } from '../api/client';
import GajoLiveStatus from '../components/GajoLiveStatus';
import VisitorLocationControl from '../components/VisitorLocationControl';
import MovementPlan from '../components/MovementPlan';
import { getSessionLocation } from '../utils/visitorLocation';
import { mergeCommittedSpeech, renderSpeechText, SPEECH_RESTART_DELAY_MS } from '../utils/speechTranscript';
import { buildContextSummary } from '../utils/contextSummary';
import StructuredVisitorIntake from '../components/StructuredVisitorIntake';
import { getQuickStartPreset } from '../quickStartPresets';

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
  if (!rec) {
    return '요청을 접수했습니다. 조건을 분석했지만 아직 추천할 프로그램을 찾지 못했습니다.';
  }
  return rec.reasonSummary || '말씀하신 상황에 맞춰 편안한 일정을 준비했습니다.';
}

export default function ConciergePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const preset = getQuickStartPreset((location.state as {quickStartPreset?:unknown}|null)?.quickStartPreset);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: '안녕하세요! 함께 오신 분, 머무는 시간, 이동 방법, 걷기 편한 정도를 말씀해 주시면 지금 상황에 알맞은 일정을 안내해 드릴게요.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceError, setVoiceError] = useState('');
  const [requestError,setRequestError]=useState(false);
  const [freeTextOpen,setFreeTextOpen]=useState(false);
  const [structuredDraft,setStructuredDraft]=useState<CreateContextInput>(()=>preset?.context||{inputMode:'STRUCTURED'});
  const contextSessionIdRef=useRef(sessionStorage.getItem('gajo-context-session')||crypto.randomUUID());
  const recognitionRef = useRef<any>(null);
  const userWantsListeningRef = useRef(false);
  const recognitionActiveRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimesRef = useRef<number[]>([]);
  const baseTextRef = useRef('');
  const committedSpeechRef = useRef('');
  const interimSpeechRef = useRef('');
  const fatalErrorRef = useRef(false);
  const liveStoryRef = useRef<HTMLDivElement>(null);
  const hadRecommendationRef = useRef(false);
  const requestInFlightRef=useRef(false);
  const lastRequestRef=useRef<{text:string;structured?:CreateContextInput}|null>(null);

  const renderTranscript = () => setInput(renderSpeechText(baseTextRef.current, committedSpeechRef.current, interimSpeechRef.current));
  const stopListening = () => {
    userWantsListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    if (interimSpeechRef.current) committedSpeechRef.current = mergeCommittedSpeech(committedSpeechRef.current, interimSpeechRef.current);
    interimSpeechRef.current = '';
    renderTranscript(); setListening(false);
    if (recognitionActiveRef.current) try { recognitionRef.current?.stop?.(); } catch { /* already ending */ }
  };

  useEffect(() => () => { userWantsListeningRef.current=false;if(restartTimerRef.current)clearTimeout(restartTimerRef.current);try{recognitionRef.current?.stop?.()}catch{/* already ending */} }, []);

  const startRecognitionInstance = (SpeechRecognition:any) => {
    if (!userWantsListeningRef.current || document.hidden) return;
    const now=Date.now();restartTimesRef.current=restartTimesRef.current.filter(time=>now-time<30000);
    if(restartTimesRef.current.length>=8){setVoiceError('음성 연결이 반복해서 끊겼습니다. 입력된 내용을 확인한 뒤 다시 시작해 주세요.');stopListening();return}
    restartTimesRef.current.push(now);
    const recognition = new SpeechRecognition();
    const finalIndexes = new Set<number>();
    recognition.lang = 'ko-KR'; recognition.interimResults = true; recognition.continuous = true; recognition.maxAlternatives=1;
    recognition.onstart = () => { recognitionActiveRef.current=true; setListening(true); };
    recognition.onresult = (event:any) => {
      for(let index=Number(event.resultIndex||0);index<(event.results?.length||0);index+=1){const result=event.results[index];const transcript=String(result?.[0]?.transcript||'').trim();if(!transcript)continue;const isFinal=result?.isFinal!==false;if(isFinal){if(!finalIndexes.has(index)){committedSpeechRef.current=mergeCommittedSpeech(committedSpeechRef.current,transcript);finalIndexes.add(index)}interimSpeechRef.current=''}else interimSpeechRef.current=transcript}
      renderTranscript();
    };
    recognition.onerror = (event:any) => { const fatal=['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(event?.error);fatalErrorRef.current=fatal;if(fatal){setVoiceError(['not-allowed','service-not-allowed'].includes(event?.error)?'마이크 권한을 허용하면 음성으로 말씀하실 수 있습니다.':'마이크를 계속 사용할 수 없습니다. 직접 입력해 주세요.');stopListening()} };
    recognition.onend = () => { recognitionActiveRef.current=false;recognitionRef.current=null;if(!userWantsListeningRef.current||fatalErrorRef.current)return;interimSpeechRef.current='';renderTranscript();restartTimerRef.current=setTimeout(()=>{restartTimerRef.current=null;startRecognitionInstance(SpeechRecognition)},SPEECH_RESTART_DELAY_MS); };
    recognitionRef.current=recognition;
    try{recognition.start()}catch{setVoiceError('음성 입력을 시작하지 못했습니다. 다시 시도해 주세요.');stopListening()}
  };

  const toggleListening = () => {
    if (userWantsListeningRef.current) { stopListening(); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setVoiceSupported(false); setVoiceError('이 브라우저에서는 음성 입력을 사용할 수 없습니다. 직접 입력해 주세요.'); return; }
    setVoiceError('');
    baseTextRef.current=input.trim();committedSpeechRef.current='';interimSpeechRef.current='';fatalErrorRef.current=false;restartTimesRef.current=[];userWantsListeningRef.current=true;setListening(true);startRecognitionInstance(SpeechRecognition);
  };

  useEffect(()=>{sessionStorage.setItem('gajo-context-session',contextSessionIdRef.current)},[]);

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
    try {
      const gps = getSessionLocation();
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
      const result = await postConciergeChat({ ...(hasRecommendation?carriedContext:structuredDraft), ...structured, ...(text?{rawMessage:text,inputMode:'FREE_TEXT' as const}:{}), contextSessionId:contextSessionIdRef.current,isFollowup:hasRecommendation, ...(gps?.status === 'AVAILABLE' ? { latitude: gps.latitude, longitude: gps.longitude, locationAccuracy: gps.accuracy, locationObservedAt: gps.observedAt, locationStatus: gps.status } : { locationStatus: gps?.status }) });
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: summarizeResult(result), result },
      ]);
    } catch (e: any) {
      console.error('[concierge] request failed',e);
      setRequestError(true);
    } finally {
      requestInFlightRef.current=false;
      setLoading(false);
    }
  };

  const hasRecommendation = messages.some(message => Boolean(message.result?.recommendation));
  const latestRecommendation = [...messages].reverse().find(message => message.result?.recommendation)?.result;

  useEffect(() => {
    if (hasRecommendation && !hadRecommendationRef.current) {
      requestAnimationFrame(() => liveStoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    hadRecommendationRef.current = hasRecommendation;
  }, [hasRecommendation]);

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
      <div ref={liveStoryRef} className="journey-live-context"><GajoLiveStatus /></div>
      {!hasRecommendation && <div className="visitor-location-section"><VisitorLocationControl /></div>}
      {!hasRecommendation && <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`chat-bubble ${m.role === 'user' ? 'user' : 'ai'}`}>{m.text}</div>
          </div>
        ))}
        {loading && <div className="loading">가조이가 말씀하신 상황에 맞는 일정을 살펴보고 있습니다...</div>}
      </div>}
      {requestError&&<div className="visitor-error" role="alert"><b>잠시 연결이 원활하지 않습니다.</b><p>다시 한 번 시도해 주세요.</p><button type="button" className="btn btn-outline" onClick={()=>{const last=lastRequestRef.current;if(last)send(last.text,last.structured,true)}}>다시 시도</button></div>}

      {!hasRecommendation && <>
        <StructuredVisitorIntake loading={loading} initialValues={preset?.intakeValues} initialPreferences={preset?.selectedPreferences} entryMessage={preset?.entryMessage} onChange={setStructuredDraft} onSubmit={structured=>send('',structured)}/>
        <div className="free-text-option"><span>또는</span><button type="button" className="btn btn-outline btn-block" aria-expanded={freeTextOpen} onClick={()=>setFreeTextOpen(open=>!open)}>그냥 말로 알려줄게요</button><p>선택하기 번거로우시면 편하게 말씀해 주세요.</p></div>
      </>}

      {hasRecommendation && latestRecommendation && <div className="recommendation-journey-start">
        <UnderstoodContext result={latestRecommendation} />
        <ResultPanel result={latestRecommendation} onFindNearbyRestaurants={() => navigate('/nearby-discovery')} />
        <MovementPlan result={latestRecommendation} />
        <section className="card runtime-journey-card">
          <h2>상황이 바뀌면</h2>
          <p>날씨와 현재 상황이 달라지면 남은 일정을 다시 확인할 수 있어요.</p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/itinerary', { state: { result: latestRecommendation } })}>지금 상황 다시 확인</button>
          <details className="demo-tools"><summary>시연·테스트</summary><p>발표용으로 13시 강한 비 상황을 재현합니다.</p><button className="btn btn-outline btn-block" onClick={runDemo} disabled={loading}>13시 강한 비 상황 재현</button></details>
        </section>
        {loading && <div className="loading">가조이가 이어서 살펴보고 있습니다...</div>}
      </div>}

      {(hasRecommendation||freeTextOpen) && <div className={hasRecommendation ? 'concierge-followup-composer' : 'concierge-input-panel'}>
        <div className="input-panel-heading">
          {!hasRecommendation && <small>말하거나 직접 입력하세요</small>}
          <h2>{hasRecommendation ? '가조이에게 더 물어보세요' : '직접 이야기해 보세요'}</h2>
        </div>
        <textarea
          className={listening ? 'is-voice-listening' : undefined}
          rows={hasRecommendation ? 2 : 5}
          placeholder={hasRecommendation ? '일정에 대해 궁금한 것을 말씀해주세요.' : '예: 가족과 함께 편안하게 힐링할 수 있는 온천 코스를 추천해주세요.'}
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
          <button type="button" className={`speech-session-button${listening?' is-listening':''}`} onClick={toggleListening} disabled={loading} aria-pressed={listening} aria-label={listening?'말하기 끝':'한국어로 여행 조건 말하기'}>
            <span className="voice-dot" aria-hidden="true">●</span>
            <strong>{listening?'듣고 있어요... · 말하기 끝':'말하기'}</strong>
            <span className={`voice-bars${listening?' is-listening':''}`} aria-hidden="true"><i/><i/><i/><i/><i/><i/></span>
          </button>
          {!hasRecommendation && <p>말씀하신 내용이 위 입력창에 들어갑니다. 음성은 저장하지 않아요.</p>}
        </div>
        <p className="voice-helper" role="status">{listening?'듣고 있어요. 계속 말씀하시거나 ‘말하기 끝’을 눌러 주세요.':'말씀하신 내용이 위 입력창에 들어갑니다. 음성은 저장하지 않아요.'}</p>
        {(!voiceSupported||voiceError)&&<p className="voice-error" role="alert">{voiceError}</p>}
        <button className="btn btn-primary btn-block concierge-submit" onClick={() => send()} disabled={loading}>
          {hasRecommendation ? '전송' : '대화로 일정 찾기'}
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
function buildLabelMap(result: ConciergeChatResponse): Record<string, string> {
  const map: Record<string, string> = {};
  for (const ul of result.riskLabels || []) map[ul.uri] = ul.label;
  for (const ul of result.usedAgentLabels || []) map[ul.uri] = ul.label;
  const rec = result.recommendation;
  for (const e of (rec?.evidence || result.evidence || []) as any[]) {
    if (e.subject && e.subjectLabel) map[e.subject] = e.subjectLabel;
    if (e.object && e.objectLabel) map[e.object] = e.objectLabel;
  }
  return map;
}

function labelFor(map: Record<string, string>, uri: string, fallback = '상세 정보'): string {
  return map[uri] || fallback;
}

function UnderstoodContext({ result }: { result: ConciergeChatResponse }) {
  const rows = buildContextSummary(result.context || {});
  return <section className="understood-context-card"><h2>가조이가 이해한 내용</h2>{rows.length ? <dl>{rows.map(row => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl> : <p className="muted-line">말씀하신 방문 상황을 바탕으로 일정을 구성했습니다.</p>}</section>;
}

function ResultPanel({
  result,
  onFindNearbyRestaurants,
}: {
  result: ConciergeChatResponse;
  onFindNearbyRestaurants: () => void;
}) {
  const rec = result.recommendation;
  const labelMap = buildLabelMap(result);
  const itinerarySteps: any[] = rec?.itinerary?.steps || rec?.steps || [];

  return (
    <section className="recommendation-section">
      {rec && <><h2>가조이의 추천</h2>{rec.reasonSummary && <div className="visitor-reason-summary"><b>이렇게 추천한 이유</b><p>{rec.reasonSummary}</p></div>}</>}
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
          {itinerarySteps.map((step: any, i: number) => (
            <div className="itinerary-step" key={i} style={{ marginTop: 10 }}>
              <div className="step-index">{step.order ?? i + 1}</div>
              <div className="step-body">
                <h3>{step.programLabel || step.label || labelFor(labelMap, step.programUri, '일정 항목')}</h3>
                {step.facilityLabel && <p>{step.facilityLabel}</p>}
                {step.durationMinutes && <p>소요 시간: 약 {step.durationMinutes}분</p>}
              </div>
            </div>
          ))}
        </div>
      )}

    </section>
  );
}
