import { useEffect, useState } from 'react';
import { fetchAiUsageSummary } from '../api/client';

type UsageSummary = {
  calls:number;
  successes:number;
  errors:number;
  skips:number;
  blocked:number;
  inputTokens:number;
  outputTokens:number;
};

type AiUsageData = {
  generatedAt:string;
  today:UsageSummary;
  last7Days:UsageSummary;
  month:UsageSummary;
};

const emptySummary:UsageSummary = {
  calls:0,
  successes:0,
  errors:0,
  skips:0,
  blocked:0,
  inputTokens:0,
  outputTokens:0,
};

function UsagePeriod({
  title,
  summary,
}:{
  title:string;
  summary:UsageSummary;
}) {
  const totalTokens=(summary.inputTokens||0)+(summary.outputTokens||0);

  return (
    <div className="card" style={{margin:0}}>
      <h3>{title}</h3>
      <div className="grid-2">
        <div className="stat-box">
          <div className="num">{summary.calls||0}</div>
          <div className="label">AI 호출</div>
        </div>
        <div className="stat-box">
          <div className="num">{totalTokens.toLocaleString()}</div>
          <div className="label">Tokens</div>
        </div>
        <div className="stat-box">
          <div className="num">{summary.successes||0}</div>
          <div className="label">성공</div>
        </div>
        <div className="stat-box">
          <div className="num">{summary.errors||0}</div>
          <div className="label">오류</div>
        </div>
        <div className="stat-box">
          <div className="num">{summary.skips||0}</div>
          <div className="label">LLM 호출 절약</div>
        </div>
        <div className="stat-box">
          <div className="num">{summary.blocked||0}</div>
          <div className="label">한도 차단</div>
        </div>
      </div>

      <div className="tag-row" style={{marginTop:12}}>
        <span className="badge">Input {summary.inputTokens.toLocaleString()}</span>
        <span className="badge">Output {summary.outputTokens.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function AIUsageCostDashboard() {
  const [data,setData]=useState<AiUsageData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);

  const load=()=>{
    setLoading(true);
    setError(false);

    fetchAiUsageSummary()
      .then(setData)
      .catch(()=>{
        setData(null);
        setError(true);
      })
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{
    load();
  },[]);

  const today=data?.today||emptySummary;
  const apiBlocked=today.errors>0 && today.successes===0;

  return (
    <section className="card" aria-label="AI 사용량 및 비용 관리">
      <div style={{
        display:'flex',
        justifyContent:'space-between',
        alignItems:'flex-start',
        gap:12,
        flexWrap:'wrap',
      }}>
        <div>
          <h2 style={{marginBottom:6}}>AI Usage & Cost Control</h2>
          <p className="text-muted" style={{marginTop:0}}>
            EXKOVIA 서버에 영속 저장된 AI 호출·토큰·절약 현황입니다.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={load}
          disabled={loading}
        >
          {loading ? '새로고침 중...' : '새로고침'}
        </button>
      </div>

      {error && (
        <p style={{fontWeight:700}}>
          AI 사용량 데이터를 불러오지 못했습니다.
        </p>
      )}

      {!error && (
        <>
          <div className="tag-row" style={{marginBottom:16}}>
            <span className="badge">
              {apiBlocked ? '🔴 OpenAI API 오류 감지' : '🟢 AI Usage 계측 정상'}
            </span>
            <span className="badge">
              영속 Ledger
            </span>
            <span className="badge">
              서버 재시작 후에도 유지
            </span>
          </div>

          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',
            gap:14,
          }}>
            <UsagePeriod title="오늘" summary={data?.today||emptySummary} />
            <UsagePeriod title="최근 7일" summary={data?.last7Days||emptySummary} />
            <UsagePeriod title="이번 달" summary={data?.month||emptySummary} />
          </div>

          <p className="text-muted" style={{marginTop:16}}>
            마지막 집계: {data?.generatedAt
              ? new Date(data.generatedAt).toLocaleString('ko-KR')
              : '-'}
          </p>
        </>
      )}
    </section>
  );
}