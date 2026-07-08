import { useLocation, useNavigate } from 'react-router-dom';
import { shortUri } from '../utils/uri';
import type { ConciergeChatResponse } from '../api/client';

export default function ItineraryPage() {
  const location = useLocation() as { state?: { result?: ConciergeChatResponse } };
  const navigate = useNavigate();
  const result = location.state?.result;

  if (!result || !result.recommendation) {
    return (
      <div className="card">
        <h2>표시할 일정이 없습니다</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          AI 컨시어지와 대화하여 맞춤 일정을 먼저 생성해주세요.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => navigate('/concierge')}>
          AI 컨시어지로 이동
        </button>
      </div>
    );
  }

  const rec = result.recommendation;
  const itinerarySteps: any[] = rec.itinerary?.steps || rec.steps || [];
  const reservationChecks: any[] =
    result.reservationCheck ||
    (result as any).runResult?.executionLog?.find((l: any) => l.taskLabel?.includes('예약'))?.output
      ?.reservationCheck ||
    [];

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

      <div className="card">
        <h2>추천 프로그램 &amp; 시설</h2>
        <div className="tag-row">
          {(rec.recommendedPrograms || []).map((p: string) => (
            <span className="badge" key={p}>
              🧖 {shortUri(p)}
            </span>
          ))}
          {(rec.recommendedFacilities || []).map((f: string) => (
            <span className="badge muted" key={f}>
              📍 {shortUri(f)}
            </span>
          ))}
        </div>
      </div>

      {itinerarySteps.length > 0 && (
        <div className="card">
          <h2>일정 단계</h2>
          {itinerarySteps.map((step: any, i: number) => (
            <div className="itinerary-step" key={i}>
              <div className="step-index">{step.order ?? i + 1}</div>
              <div className="step-body">
                <h3>{step.label || step.facilityLabel || shortUri(step.facilityUri)}</h3>
                {step.programLabel && <p>{step.programLabel}</p>}
                {step.durationMinutes && <p>소요 시간: 약 {step.durationMinutes}분</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {reservationChecks.length > 0 && (
        <div className="card">
          <h2>예약 가능 여부</h2>
          {reservationChecks.map((r: any, i: number) => (
            <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>
              <b>{r.facilityLabel || shortUri(r.facilityUri)}</b> —{' '}
              {r.available ? '✅ 예약 가능' : '❌ 예약 불가'}
              {r.availableSlots && (
                <div className="tag-row">
                  {r.availableSlots.map((s: string) => (
                    <span className="badge muted" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rec.risks && rec.risks.length > 0 && (
        <div className="card">
          <h2>안전 · 위험 안내</h2>
          <div className="tag-row">
            {rec.risks.map((r: string) => (
              <span className="badge risk" key={r}>
                ⚠️ {shortUri(r)}
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

      <button className="btn btn-outline btn-block" onClick={() => navigate('/concierge')}>
        ← AI 컨시어지로 돌아가기
      </button>
    </div>
  );
}
