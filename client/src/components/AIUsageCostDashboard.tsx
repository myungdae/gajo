import { useEffect, useState } from 'react';
import { fetchContextExtractionMetrics } from '../api/client';

export default function AIUsageCostDashboard() {
  const [metrics,setMetrics]=useState<any>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    fetchContextExtractionMetrics()
      .then(setMetrics)
      .catch(()=>setMetrics(null))
      .finally(()=>setLoading(false));
  },[]);

  if(loading){
    return (
      <section className="card">
        <h2>AI Usage & Cost Control</h2>
        <p>AI 사용량을 불러오는 중...</p>
      </section>
    );
  }

  if(!metrics){
    return (
      <section className="card">
        <h2>AI Usage & Cost Control</h2>
        <p>AI 사용량을 불러올 수 없습니다.</p>
      </section>
    );
  }

  const inputTokens=metrics.inputTokens||0;
  const outputTokens=metrics.outputTokens||0;
  const totalTokens=inputTokens+outputTokens;

  return (
    <section className="card" aria-label="AI 사용량 및 비용 관리">
      <h2>AI Usage & Cost Control</h2>
      <p className="text-muted">
        EXKOVIA 서버에서 실제 집계한 OpenAI Context 사용 현황입니다.
      </p>

      <div className="grid-2">
        <div className="stat-box">
          <div className="num">{metrics.totalCalls||0}</div>
          <div className="label">Context LLM 호출</div>
        </div>

        <div className="stat-box">
          <div className="num">{totalTokens.toLocaleString()}</div>
          <div className="label">누적 Tokens</div>
        </div>

        <div className="stat-box">
          <div className="num">{metrics.successfulCalls||0}</div>
          <div className="label">성공 호출</div>
        </div>

        <div className="stat-box">
          <div className="num">{metrics.fallbackCalls||0}</div>
          <div className="label">Fallback</div>
        </div>

        <div className="stat-box">
          <div className="num">{metrics.duplicateSkips||0}</div>
          <div className="label">중복 호출 절약</div>
        </div>

        <div className="stat-box">
          <div className="num">{metrics.limitSkips||0}</div>
          <div className="label">세션 한도 차단</div>
        </div>
      </div>

      <div className="tag-row" style={{marginTop:12}}>
        <span className="badge">Input {inputTokens.toLocaleString()}</span>
        <span className="badge">Output {outputTokens.toLocaleString()}</span>
        <span className="badge">활성 세션 {metrics.activeSessions||0}</span>
        <span className="badge">세션당 최대 {metrics.maxCallsPerSession||0}회</span>
      </div>

      <p className="text-muted" style={{marginTop:12}}>
        현재 단계는 서버 런타임 집계입니다. 다음 단계에서 일별 저장·Semantic 호출·OpenAI 실제 비용을 연결합니다.
      </p>
    </section>
  );
}