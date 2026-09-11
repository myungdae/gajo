import { useEffect, useState } from 'react';
import { fetchAiUsageSummary } from '../api/client';

type Summary = {
  calls:number;
  successes:number;
  errors:number;
  skips:number;
  blocked:number;
  inputTokens:number;
  outputTokens:number;
};

type RegionSummary = Summary & {
  regionId:string;
};

type Data = {
  generatedAt:string;
  today:Summary;
  last7Days:Summary;
  month:Summary;
  byRegion:RegionSummary[];
};

const regionLabel=(id:string)=>{
  const labels:Record<string,string>={
    hapcheon:'합천',
    geochang:'거창',
    okcheon:'옥천',
    haman:'함안',
    gajo:'가조',
    unknown:'기존 미분류',
  };
  return labels[id]||id;
};

function SummaryCards({summary}:{summary:Summary}) {
  const tokens=(summary.inputTokens||0)+(summary.outputTokens||0);

  return (
    <div className="grid-2">
      <div className="stat-box">
        <div className="num">{summary.calls||0}</div>
        <div className="label">AI 호출</div>
      </div>
      <div className="stat-box">
        <div className="num">{tokens.toLocaleString()}</div>
        <div className="label">Tokens</div>
      </div>
      <div className="stat-box">
        <div className="num">{summary.errors||0}</div>
        <div className="label">오류</div>
      </div>
      <div className="stat-box">
        <div className="num">{summary.skips||0}</div>
        <div className="label">LLM 호출 절약</div>
      </div>
    </div>
  );
}

export default function NationalAIUsageDashboard() {
  const [data,setData]=useState<Data|null>(null);
  const [loading,setLoading]=useState(true);

  const load=()=>{
    setLoading(true);
    fetchAiUsageSummary()
      .then(setData)
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{ load(); },[]);

  if(loading){
    return <section className="card"><h2>전국 AI 운영 현황</h2><p>불러오는 중...</p></section>;
  }

  if(!data){
    return <section className="card"><h2>전국 AI 운영 현황</h2><p>데이터를 불러올 수 없습니다.</p></section>;
  }

  return (
    <section className="card" aria-label="전국 AI 운영 현황">
      <div style={{
        display:'flex',
        justifyContent:'space-between',
        alignItems:'flex-start',
        gap:12,
        flexWrap:'wrap'
      }}>
        <div>
          <h2 style={{marginBottom:6}}>National AI Operations Cockpit</h2>
          <p className="text-muted" style={{marginTop:0}}>
            전국 EXKOVIA AI 사용량을 통합해서 봅니다.
          </p>
        </div>

        <button className="btn btn-secondary" type="button" onClick={load}>
          새로고침
        </button>
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',
        gap:14,
        marginTop:14
      }}>
        <div className="card" style={{margin:0}}>
          <h3>오늘</h3>
          <SummaryCards summary={data.today}/>
        </div>

        <div className="card" style={{margin:0}}>
          <h3>최근 7일</h3>
          <SummaryCards summary={data.last7Days}/>
        </div>

        <div className="card" style={{margin:0}}>
          <h3>이번 달</h3>
          <SummaryCards summary={data.month}/>
        </div>
      </div>

      <div className="card" style={{marginTop:16,marginBottom:0}}>
        <h3>지역별 AI 사용량</h3>

        <table className="simple">
          <thead>
            <tr>
              <th>지역</th>
              <th>호출</th>
              <th>오류</th>
              <th>절약</th>
              <th>차단</th>
              <th>Tokens</th>
            </tr>
          </thead>
          <tbody>
            {(data.byRegion||[]).map((row)=>(
              <tr key={row.regionId}>
                <td>{regionLabel(row.regionId)}</td>
                <td>{row.calls||0}</td>
                <td>{row.errors||0}</td>
                <td>{row.skips||0}</td>
                <td>{row.blocked||0}</td>
                <td>{((row.inputTokens||0)+(row.outputTokens||0)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted" style={{marginTop:14}}>
        마지막 집계: {new Date(data.generatedAt).toLocaleString('ko-KR')}
      </p>
    </section>
  );
}