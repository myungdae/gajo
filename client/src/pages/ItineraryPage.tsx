import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { shortUri } from '../utils/uri';
import { approveReplanning, hydrateRuntimeLocation, observeRuntime, rejectReplanning, type ConciergeChatResponse, type LiveRuntimeResponse, type ReplanningProposal } from '../api/client';
import RecommendationItineraryItem from '../components/RecommendationItineraryItem';
import GajoLiveStatus from '../components/GajoLiveStatus';
import VisitorLocationControl from '../components/VisitorLocationControl';
import MovementPlan from '../components/MovementPlan';
import { ensureTripSession } from '../tripSession';
import { track } from '../analytics';
import { useRegion } from '../RegionContext';
import { regionalPath } from '../regionRouting';
import { SHARED_VISITOR_COPY } from '../visitorCopy';
import { liveRuntimeForRegion, runtimeContextForRegion } from '../liveRuntimeGuard';
import { regionalRuntimeView } from '../regionalRuntime';

export default function ItineraryPage() {
  const region=useRegion();const tripSession=ensureTripSession(region.id);const regionLink=(path:string)=>regionalPath(path,region.id);
  const location = useLocation() as { state?: { result?: ConciergeChatResponse } };
  const navigate = useNavigate();
  const [result, setResult] = useState(location.state?.result);
  const [proposal, setProposal] = useState<ReplanningProposal | null>(null);
  const [runtimeMessage, setRuntimeMessage] = useState('');
  const [observing, setObserving] = useState(false);
  const [knownRuntimeContext, setKnownRuntimeContext] = useState<any>(()=>runtimeContextForRegion(location.state?.result?.context,region.id)||runtimeContextForRegion(tripSession.runtimeContext,region.id));

  if (!result || !result.recommendation) {
    return (
      <div className="card">
        <h2>표시할 일정이 없습니다</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          AI 컨시어지와 대화하여 맞춤 일정을 먼저 생성해주세요.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => navigate(regionLink('/concierge'))}>
          AI 컨시어지로 이동
        </button>
      </div>
    );
  }

  const rec = result.recommendation;
  const itinerarySteps: any[] = rec.itinerary?.steps || rec.steps || [];
  const visitorLabel = (uri: string, fallback: string) => {
    const step = itinerarySteps.find((item: any) => item.programUri === uri || item.facilityUri === uri);
    if (step) return step.programUri === uri ? step.programLabel || fallback : step.facilityLabel || fallback;
    const evidence = (rec.evidence || []).find((item: any) => item.subject === uri || item.object === uri);
    return evidence?.subject === uri ? evidence.subjectLabel || fallback : evidence?.objectLabel || fallback;
  };

  const observeHeavyRain = async () => {
    track('REPLAN_REQUESTED',tripSession.id,{source:'demo-weather-change'});
    setObserving(true);
    setRuntimeMessage('');
    try {
      const previousContext = runtimeContextForRegion(result.context,region.id)||{regionId:region.id};
      const demoSteps = itinerarySteps.map((step: any) => ({ ...step, status: step.status || 'PLANNED' }));
      const currentContext = { ...previousContext, regionId:region.id,contextNo: `${previousContext.contextNo || 'runtime'}-heavy-rain`, observedAt: new Date().toISOString(), currentTime: '13:00', precipitation: 20, weather: 'gajo:heavyRain', environmentConditions: [...(previousContext.environmentConditions || []), 'gajo:heavyRain'],runtimeProvenance:{kind:'SYNTHETIC_DEMO',liveWeatherConfirmed:false} };
      const response = await observeRuntime({ regionId:region.id,previousContext, currentContext, itinerary: { ...rec.itinerary, steps: demoSteps } });
      setProposal(response.proposedRevision);
      setRuntimeMessage(response.suppressed ? '같은 조건의 제안이 이미 거절되어 다시 알리지 않습니다.' : response.replanningRecommended ? '' : '현재 미래 일정에는 재계획이 필요한 영향이 없습니다.');
    } catch (error: any) {
      setRuntimeMessage(`런타임 관측 실패: ${error?.message || '알 수 없는 오류'}`);
    } finally { setObserving(false); }
  };

  const approve = async () => {
    if (!proposal) return;
    const response = await approveReplanning(proposal.proposalNo);
    setResult((current: any) => ({ ...current, recommendation: { ...current.recommendation, itinerary: response.itinerary } }));
    setProposal(null); setRuntimeMessage('승인된 미래 일정만 반영했습니다. 완료된 일정은 그대로 유지됩니다.');
  };

  const observeLiveRuntime = async (live: LiveRuntimeResponse) => {
    const owned=liveRuntimeForRegion(live,region.id);if(!owned)return;
    track('REPLAN_REQUESTED',tripSession.id,{source:'live-runtime'});
    const previousContext = knownRuntimeContext || result.context || {};
    const response = await observeRuntime({ regionId:region.id,previousContext, currentContext: owned.context, itinerary: rec.itinerary });
    setKnownRuntimeContext(owned.context);
    setProposal(response.proposedRevision);
    setRuntimeMessage(response.replanningRecommended ? '' : '현재 일정에 영향을 주는 변화는 없습니다.');
  };

  const reject = async () => {
    if (!proposal) return;
    await rejectReplanning(proposal.proposalNo);
    setProposal(null); setRuntimeMessage('기존 일정을 유지합니다. 같은 조건은 다시 알리지 않습니다.');
  };

  return (
    <div>
      <div className="card">
        <h2>추천 근거 요약</h2>
        <p style={{ fontSize: 13 }}>{rec.reasonSummary}</p>
        {typeof rec.confidenceScore === 'number' && (
          <div className="tag-row">
            <span className="badge">신뢰도 {(rec.confidenceScore * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      <MovementPlan result={result} />

      <div className="card">
        <h2>런타임 상황 확인</h2>
        <VisitorLocationControl onLocation={async (gps) => observeLiveRuntime(await hydrateRuntimeLocation(knownRuntimeContext || runtimeContextForRegion(result.context,region.id)||{regionId:region.id}, gps,region.id))} />
        <GajoLiveStatus contextNo={result.context?.contextNo} regionName={region.regionName} regionId={region.id} liveEnabled={regionalRuntimeView(region).weatherEnabled} onLiveRefresh={observeLiveRuntime} />
        {runtimeMessage && <p style={{ fontSize: 12 }}>{runtimeMessage}</p>}
        <div className="demo-runtime-control">
          <small>시연·테스트 기능</small>
          <p>완료된 앞의 두 일정을 보존하고 13:00, 강수량 20mm 상황을 재현합니다.</p>
          <button className="btn btn-outline btn-block" onClick={observeHeavyRain} disabled={observing}>
            {observing ? '데모 실행 중…' : '데모: 13시 강한 비 발생'}
          </button>
        </div>
      </div>

      {proposal && (
        <div className="card replanning-card">
          <h2>상황이 바뀌었습니다</h2>
          <div className="replanning-section"><b>무엇이 바뀌었나요?</b><p>강한 비가 시작되었습니다.</p></div>
          <div className="replanning-section"><b>영향받는 일정</b>{proposal.removedItems.map((step: any) => <span className="badge risk" key={step.itemId || step.order}>{step.programLabel || step.facilityLabel || step.label}</span>)}</div>
          <div className="replanning-section"><b>제안하는 대안</b>{proposal.proposedNewItems.map((step: any) => <span className="badge" key={step.itemId || step.order}>{step.programLabel || step.facilityLabel || step.label}</span>)}</div>
          <div className="replanning-section"><b>추천 이유</b><p>{proposal.explanation}</p></div>
          <div className="sequence-comparison"><div><b>기존 남은 일정</b><p>{itinerarySteps.filter((step:any)=>step.status!=='COMPLETED'&&step.status!=='SKIPPED').map((step:any)=>step.programLabel||step.facilityLabel||step.label).join(' → ')||'-'}</p></div><div><b>{SHARED_VISITOR_COPY.replanningProposal}</b><p>{proposal.proposedFutureSteps.map((step:any)=>step.programLabel||step.facilityLabel||step.label).join(' → ')||'-'}</p></div></div>
          {proposal.preservedHistory?.length>0&&<p className="preserved-history">🔒 완료된 {proposal.preservedHistory.length}개 일정은 그대로 보존됩니다.</p>}
          <div className="grid-2"><button className="btn btn-primary" onClick={approve}>변경하기</button><button className="btn btn-outline" onClick={reject}>기존 일정 유지</button></div>
        </div>
      )}

      {itinerarySteps.length > 0 && (
        <div className="card">
          <h2>일정 단계</h2>
          {itinerarySteps.map((step: any, i: number) => <RecommendationItineraryItem step={step} index={i} key={step.itemId||step.programUri||i}/>)}
        </div>
      )}

      {rec.risks && rec.risks.length > 0 && (
        <div className="card">
          <h2>안전 · 위험 안내</h2>
          <div className="tag-row">
            {rec.risks.map((r: string) => (
              <span className="badge risk" key={r}>
                ⚠️ {visitorLabel(r, '안전 주의사항')}
              </span>
            ))}
          </div>
        </div>
      )}

      {rec.evidence && rec.evidence.length > 0 && (
        <div className="card">
          <h2>설명 가능한 근거 (Evidence Chain)</h2>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            아래는 온톨로지 그래프에서 실제로 추적된 RDF 트리플입니다. 이 서비스의 모든 추천은
            프롬프트 규칙이 아닌 그래프 순회(graph traversal)를 통해 도출됩니다.
          </p>
          {rec.evidence.map((e: any, i: number) => (
            <div className="evidence-item" key={i}>
              <b>{shortUri(e.subjectLabel || e.subject)}</b> —{' '}
              <i>{shortUri(e.predicateLabel || e.predicate)}</i> →{' '}
              <b>{shortUri(e.objectLabel || e.object)}</b>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-primary btn-block" style={{ marginBottom: 10 }} onClick={() => navigate(regionLink('/nearby-discovery'))}>
        🧭 주변 즐길거리 찾기
      </button>

      <button className="btn btn-outline btn-block" onClick={() => navigate(regionLink('/concierge'))}>
        ← AI 컨시어지로 돌아가기
      </button>
    </div>
  );
}
