import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import PublicBrand from "../components/PublicBrand";
import "./hapcheon-network-report.css";

type PlaceNode = { id: string; label: string; kind: string; status: string; area: string; sourceName: string };
type Ecosystem = {
  status: string;
  nodes: PlaceNode[];
  edges: Array<{ source: string; target: string; relation: string; basis: string }>;
  counts: { total: number; verified: number; byKind: Record<string, number> };
  runtimeSignals: string[];
  actionPath: string[];
  outcomePath: string[];
};
const GROUPS = [
  ["ATTRACTION", "관광·체험"], ["FESTIVAL", "축제"], ["FOOD", "음식점"],
  ["CAFE", "카페"], ["STAY", "숙박"],
] as const;

export default function HapcheonNetworkReportPage() {
  const [data, setData] = useState<Ecosystem>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PlaceNode>();
  const load = async () => {
    setError("");
    try {
      const { data: ecosystem } = await api.get("/public/regional-network/hapcheon");
      if (ecosystem?.region?.id !== "hapcheon") throw new Error();
      setData(ecosystem);
    } catch { setData(undefined); setError("합천 지역 연결망을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => GROUPS.map(([kind, label]) => ({ kind, label, nodes: data?.nodes.filter((node) => node.kind === kind) || [] })), [data]);
  if (!data) return <main className="mayor-login"><PublicBrand compact linked={false}/><small>합천 정책 리포트 · 읽기 전용</small><h1>합천 지역 중심 네트워크</h1><p>{error || "실제 합천 지역 데이터를 불러오고 있습니다."}</p>{error&&<button onClick={()=>void load()}>다시 시도</button>}</main>;
  return <main className="mayor-report">
    <header><div><PublicBrand compact linked={false}/><span>합천 정책 리포트 · 읽기 전용</span><h1>흩어진 관광자원을<br/><em>하나의 지역경제 흐름</em>으로</h1><p>관광객의 현재 상황을 중심으로 합천의 장소·서비스·행동을 연결합니다.</p></div><div className="mayor-kpi"><strong>{data.counts.total}</strong><span>실제 등록 자원</span><strong>{data.counts.verified}</strong><span>검증 완료 자원</span><strong>{data.edges.length}</strong><span>데이터 기반 관계</span></div></header>
    <section className="mayor-thesis"><strong>합천의 자원이 부족한 것이 아닙니다.</strong><span>지금까지 서로 연결되어 움직이지 않았을 뿐입니다.</span></section>
    <section className="ecosystem-panel"><div className="panel-title"><div><small>REGIONAL OPERATIONAL ONTOLOGY</small><h2>합천 지역 중심 네트워크 그래프</h2></div><div className="legend"><span><i className="verified"/>검증 데이터</span><span><i className="partial"/>추가 검증 필요</span></div></div>
      <div className="ecosystem-grid">
        <div className="signal-column"><h3>현재 상황</h3>{data.runtimeSignals.map(signal=><span key={signal}>{signal}</span>)}</div>
        <div className="decision-core"><small>Regional Concierge</small><strong>여행자<br/>현재 맥락</strong><p>상황을 이해하고<br/>연결을 다시 구성</p><div>{data.actionPath.map(step=><b key={step}>{step}</b>)}</div></div>
        <div className="resource-groups">{groups.map(group=><section key={group.kind} className={`resource-group kind-${group.kind.toLowerCase()}`}><h3>{group.label}<small>{group.nodes.length}</small></h3><div>{group.nodes.map(node=><button key={node.id} className={node.status.toLowerCase()} onClick={()=>setSelected(node)}>{node.label}</button>)}</div></section>)}</div>
      </div>
      <div className="outcome-flow">{data.outcomePath.map((item,index)=><span key={item} className={index===data.outcomePath.length-1?"final":""}>{item}</span>)}</div>
      {selected&&<aside className="node-evidence"><button onClick={()=>setSelected(undefined)} aria-label="닫기">×</button><small>{selected.area} · {selected.status === "VERIFIED" ? "검증 완료" : "부분 검증"}</small><h3>{selected.label}</h3><p>출처: {selected.sourceName}</p><p>이 노드는 서버의 실제 합천 마스터데이터에서 생성되었습니다.</p></aside>}
    </section>
    <section className="evidence-boundary"><div><small>공개 데이터 범위</small><strong>{data.counts.total.toLocaleString()}개 자원</strong><p>합천 마스터데이터에 등록되어 출처와 검증상태를 확인할 수 있는 지역 자원</p></div><div><small>온톨로지 연결</small><strong>{data.edges.length.toLocaleString()}개</strong><p>명시 관계·공통 테마·합천호 권역 태그로 확인된 연결 가능성</p></div><aside><strong>해석 원칙</strong><p>온톨로지 관계는 실적이나 매출의 증거가 아닙니다. 실제 이용 연결 통계는 개인정보 보호 기준을 통과한 집계만 관리자 운영 리포트에서 확인합니다.</p></aside></section>
    <footer><strong>검색에서 행동으로</strong><p>방문 → 지역 내 이동 → 식사·체험·숙박 → 체류 연장·지역 소비로 연결하는 합천형 AI 관광 실행 플랫폼</p></footer>
  </main>;
}
