import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { postConciergeChat, runDemoScenario, type ConciergeChatResponse } from '../api/client';
import { shortUri } from '../utils/uri';

interface Message {
  role: 'user' | 'ai';
  text: string;
  result?: ConciergeChatResponse;
}

function summarizeResult(result: ConciergeChatResponse): string {
  const rec = result.recommendation;
  if (result.error) {
    return '죄송합니다. 요청을 처리할 수 있는 운영(Operation)을 온톨로지에서 찾지 못했습니다. 조금 더 구체적으로 말씀해주시겠어요?';
  }
  if (!rec) {
    return '요청을 접수했습니다. 조건을 분석했지만 아직 추천할 프로그램을 찾지 못했습니다.';
  }
  return rec.reasonSummary || '맞춤 일정을 준비했습니다. 아래 근거와 함께 확인해보세요.';
}

export default function ConciergePage() {
  const location = useLocation() as { state?: { prefill?: string } };
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: '안녕하세요! 가조 온천단지 AI 컨시어지입니다. 방문 상황(동반 가족, 건강 상태, 날씨, 혼잡도 등)을 자유롭게 말씀해주시면 온톨로지 그래프 추론을 통해 설명 가능한 맞춤 일정을 안내해드립니다.',
    },
  ]);
  const [input, setInput] = useState(location.state?.prefill || '');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const result = await postConciergeChat({ rawMessage: text });
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: summarizeResult(result), result },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: '오류가 발생했습니다: ' + (e?.message || '알 수 없는 오류') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const runDemo = async () => {
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: '이번 토요일에 어머니를 모시고 가조온천에 하루 다녀오려고 합니다. 어머니는 78세이고 무릎이 좋지 않습니다. 비가 올 것 같고 사람이 많을까 걱정됩니다.',
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
      <div className="card" style={{ marginBottom: 10 }}>
        <button className="btn btn-outline btn-block" onClick={runDemo} disabled={loading}>
          🎬 스펙 데모 시나리오 실행 (78세 어머니 · 무릎통증 · 우천 · 혼잡)
        </button>
      </div>

      <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`chat-bubble ${m.role === 'user' ? 'user' : 'ai'}`}>{m.text}</div>
            {m.result && <ResultPanel result={m.result} onViewItinerary={() => navigate('/itinerary', { state: { result: m.result } })} />}
          </div>
        ))}
        {loading && <div className="loading">AI 컨시어지가 온톨로지 그래프를 탐색하고 있습니다...</div>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <textarea
          rows={2}
          placeholder="예: 무릎이 아프신 부모님과 방문하려고 하는데 비가 올 것 같아요"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={loading}>
          전송
        </button>
      </div>
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

function labelFor(map: Record<string, string>, uri: string): string {
  return map[uri] || shortUri(uri);
}

function ResultPanel({
  result,
  onViewItinerary,
}: {
  result: ConciergeChatResponse;
  onViewItinerary: () => void;
}) {
  const rec = result.recommendation;
  const labelMap = buildLabelMap(result);
  const itinerarySteps: any[] = rec?.itinerary?.steps || rec?.steps || [];

  return (
    <div className="card" style={{ marginTop: 8 }}>
      {result.risks && result.risks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <b style={{ fontSize: 12 }}>⚠️ 감지된 위험 요소</b>
          <div className="tag-row">
            {result.risks.map((r) => (
              <span className="badge risk" key={r}>
                {labelFor(labelMap, r)}
              </span>
            ))}
          </div>
        </div>
      )}

      {rec && itinerarySteps.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <b style={{ fontSize: 12 }}>📋 추천 일정</b>
          {itinerarySteps.map((step: any, i: number) => (
            <div className="itinerary-step" key={i} style={{ marginTop: 10 }}>
              <div className="step-index">{step.order ?? i + 1}</div>
              <div className="step-body">
                <h3>{step.programLabel || step.label || labelFor(labelMap, step.programUri)}</h3>
                {step.facilityLabel && <p>📍 {step.facilityLabel}</p>}
                {step.durationMinutes && <p>소요 시간: 약 {step.durationMinutes}분</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {rec && !itinerarySteps.length && (
        <>
          <b style={{ fontSize: 12 }}>추천 프로그램</b>
          <div className="tag-row">
            {(rec.recommendedPrograms || []).map((p: string) => (
              <span className="badge" key={p}>
                {labelFor(labelMap, p)}
              </span>
            ))}
          </div>
        </>
      )}

      {rec && (
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-block" onClick={onViewItinerary}>
            📋 전체 일정 및 근거 보기
          </button>
        </div>
      )}

      {result.firedRules && result.firedRules.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <b style={{ fontSize: 12 }}>발동된 규칙 (Policy/Rule)</b>
          {result.firedRules.map((fr) => (
            <div className="evidence-item" key={fr.ruleUri}>
              <b>{fr.ruleLabel}</b>
              {fr.policyLabel ? ` · 정책: ${fr.policyLabel}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
