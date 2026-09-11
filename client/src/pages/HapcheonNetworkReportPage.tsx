import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import PublicBrand from "../components/PublicBrand";
import "./hapcheon-network-report.css";

import ContextResourceNetwork from "../components/ContextResourceNetwork";
import { GROUPS, type PlaceNode, type Ecosystem } from "../contextNetwork";

type LiveNetworkNode = {
  id: string;
  name: string;
  category: string;
};

type LiveNetworkEdge = {
  sourceNodeId: string;
  targetNodeId: string;
  stage: "INTEREST" | "MOVEMENT_INTENT" | string;
  total: number;
  unit: string;
};

type LiveNetworkSnapshot = {
  snapshotAt?: string;
  released?: {
    status?: string;
    notice?: string;
    nodes?: LiveNetworkNode[];
    edges?: LiveNetworkEdge[];
    stageTotals?: Array<{
      stage: string;
      total: number;
      unit: string;
    }>;
  };
};

export default function HapcheonNetworkReportPage() {
  const [data, setData] = useState<Ecosystem>();
  const [live, setLive] = useState<LiveNetworkSnapshot>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PlaceNode>();
  const [showNetworkDemo, setShowNetworkDemo] = useState(false);
  const [networkDemoStep, setNetworkDemoStep] = useState(0);
  const load = async () => {
    setError("");

    try {
      const [ecosystemResponse, liveResponse] = await Promise.all([
        api.get("/public/regional-network/hapcheon"),
        api.get("/public/regional-network/hapcheon/live"),
      ]);

      const ecosystem = ecosystemResponse.data;
      if (ecosystem?.region?.id !== "hapcheon") throw new Error();

      setData(ecosystem);
      setLive(liveResponse.data || undefined);
    } catch {
      setData(undefined);
      setLive(undefined);
      setError("합천 지역 연결망을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showNetworkDemo) {
      setNetworkDemoStep(0);
      return;
    }

    const timers = [
      window.setTimeout(() => setNetworkDemoStep(1), 3000),
      window.setTimeout(() => setNetworkDemoStep(2), 6000),
      window.setTimeout(() => setNetworkDemoStep(3), 10000),
      window.setTimeout(() => setNetworkDemoStep(4), 13000),
    ];

    return () => timers.forEach(window.clearTimeout);
  }, [showNetworkDemo]);
  const displayData = useMemo<Ecosystem | undefined>(() => {
    if (!data) return undefined;
    if (live?.released?.status !== "AVAILABLE") return data;

    const liveNodes = live.released.nodes || [];
    const liveEdges = live.released.edges || [];

    const ecosystemIdByLiveId = new Map<string, string>();

    for (const liveNode of liveNodes) {
      const match = data.nodes.find(
        (node) => node.label.trim() === liveNode.name.trim(),
      );

      if (match) ecosystemIdByLiveId.set(liveNode.id, match.id);
    }

    const convertedLiveEdges = liveEdges.flatMap((edge) => {
      const source = ecosystemIdByLiveId.get(edge.sourceNodeId);
      const target = ecosystemIdByLiveId.get(edge.targetNodeId);

      if (!source || !target || source === target) return [];

      return [{
        source,
        target,
        relation: edge.stage,
        evidenceLevel:
          edge.stage === "MOVEMENT_INTENT"
            ? "MOVEMENT_INTENT" as const
            : "INTEREST" as const,
        basis: "최근 30일 익명 관광객 행동 흐름",
        total: edge.total,
      }];
    });

    return {
      ...data,
      edges: [
        ...data.edges,
        ...convertedLiveEdges,
      ],
    };
  }, [data, live]);
  const livePriorityNodeIds = useMemo(() => {
    if (!data || live?.released?.status !== "AVAILABLE") return new Set<string>();

    const idByLiveNodeId = new Map<string, string>();

    for (const liveNode of live.released.nodes || []) {
      const match = data.nodes.find(
        (node) => node.label.trim() === liveNode.name.trim(),
      );
      if (match) idByLiveNodeId.set(liveNode.id, match.id);
    }

    const ids = new Set<string>();

    for (const edge of live.released.edges || []) {
      const source = idByLiveNodeId.get(edge.sourceNodeId);
      const target = idByLiveNodeId.get(edge.targetNodeId);

      if (source) ids.add(source);
      if (target) ids.add(target);
    }

    return ids;
  }, [data, live]);
  const groups = useMemo(() => GROUPS.map(([kind, label]) => ({ kind, label, nodes: data?.nodes.filter((node) => node.kind === kind) || [] })), [data]);
  if (!data) return <main className="mayor-login"><PublicBrand compact linked={false}/><small>합천 정책 리포트 · 읽기 전용</small><h1>합천 지역 중심 네트워크</h1><p>{error || "실제 합천 지역 데이터를 불러오고 있습니다."}</p>{error&&<button onClick={()=>void load()}>다시 시도</button>}</main>;
  return <main className="mayor-report">
    <header><div><PublicBrand compact linked={false}/><span>합천 정책 리포트 · 읽기 전용</span><h1>흩어진 관광자원을<br/><em>하나의 지역경제 흐름</em>으로</h1><p>관광객의 현재 상황을 중심으로 합천의 장소·서비스·행동을 연결합니다.</p></div><div className="mayor-kpi"><strong>{data.counts.total}</strong><span>실제 등록 자원</span><strong>{data.counts.verified}</strong><span>검증 완료 자원</span><strong>{data.edges.length}</strong><span>데이터 기반 관계</span></div></header>
    <section className="mayor-thesis"><strong>합천의 자원이 부족한 것이 아닙니다.</strong><span>지금까지 서로 연결되어 움직이지 않았을 뿐입니다.</span></section>
    {live?.released?.status === "AVAILABLE" && (
      <section className="live-network-summary">
        <div>
          <small>RECENT 30 DAYS · LIVE NETWORK</small>
          <h2>최근 30일 실제 이용 흐름</h2>
          <p>
            실제 이용 행동이 누적되면서 합천 지역자원 간 연결이 매일 갱신됩니다.
          </p>
        </div>

        <div className="live-network-kpis">
          {(live.released.stageTotals || []).map((item) => (
            <div key={item.stage}>
              <strong>{item.total}</strong>
              <span>
                {item.stage === "INTEREST"
                  ? "관심 행동"
                  : item.stage === "MOVEMENT_INTENT"
                    ? "이동 의도"
                    : item.stage}
              </span>
            </div>
          ))}

          <div>
            <strong>{live.released.edges?.length || 0}</strong>
            <span>공개 연결</span>
          </div>
        </div>

        {live.snapshotAt && (
          <small className="live-network-updated">
            마지막 갱신{" "}
            {new Date(live.snapshotAt).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </small>
        )}
      </section>
    )}
    <section className="ecosystem-panel"><div className="panel-title"><div><small>REGIONAL OPERATIONAL ONTOLOGY</small><h2>합천 지역 중심 네트워크 그래프</h2></div><div className="legend"><span><i className="verified"/>검증 데이터</span><span><i className="partial"/>추가 검증 필요</span></div></div>
            <button
        type="button"
        className="network-demo-trigger"
        onClick={() => {
          setNetworkDemoStep(0);
          setShowNetworkDemo(true);
        }}
      >
        ✨ 이 그래프가 무엇을 보여주는지, 15초만 보세요
      </button>

      <ContextResourceNetwork data={displayData || data} selected={selected} onSelect={setSelected} priorityNodeIds={livePriorityNodeIds}/>
      <h3 className="resource-details-title">연결된 지역자원 상세</h3>
      <div className="resource-groups">{groups.map(group=><section key={group.kind} className={`resource-group kind-${group.kind.toLowerCase()}`}><h3>{group.label}<small>{group.nodes.length}</small></h3><div>{group.nodes.map(node=><button key={node.id} className={node.status === "VERIFIED" ? "verified" : "partial"} aria-pressed={selected?.id === node.id} onClick={()=>setSelected(node)}>{node.label}</button>)}</div>{!group.nodes.length && <p>공개 등록 자원 없음</p>}</section>)}</div>
      <p className="context-usage-note">지역경제 연결 목표</p>
      <div className="outcome-flow">{data.outcomePath.map((item,index)=><span key={item} className={index===data.outcomePath.length-1?"final":""}>{item}</span>)}</div>
      {selected&&<aside className="node-evidence"><button onClick={()=>setSelected(undefined)} aria-label="닫기">×</button><small>{selected.area} · {selected.status === "VERIFIED" ? "검증 완료" : "추가 검증 필요"}</small><h3>{selected.label}</h3><p>출처: {selected.sourceName}</p><p>이 노드는 운영 DB의 실제 합천 RegionalDataRecord에서 생성되었습니다.</p></aside>}
    </section>
    <section className="evidence-boundary"><div><small>공개 데이터 범위</small><strong>{data.counts.total.toLocaleString()}개 자원</strong><p>합천 운영 DB에 등록되어 출처와 검증상태를 확인할 수 있는 지역 자원</p></div><div><small>온톨로지 연결</small><strong>{data.edges.length.toLocaleString()}개</strong><p>승인 좌표 기반 인접 관계와 공개 기준을 통과한 검증 혜택 이용 관계</p></div><aside><strong>해석 원칙</strong><p>분류선은 구조 설명이며 근접 관계는 이동·매출 실적이 아닙니다. 실제 이용 흐름은 개인정보 보호 기준을 통과한 검증 혜택 이용 집계이며 이동 순서나 매출을 증명하지 않습니다.</p></aside></section>

    {showNetworkDemo && (
      <div className="network-demo-overlay" role="dialog" aria-modal="true" aria-label="합천 지역 네트워크 15초 설명">
        <div className="network-demo-card">
          <button
            type="button"
            className="network-demo-close"
            onClick={() => setShowNetworkDemo(false)}
            aria-label="설명 닫기"
          >
            ×
          </button>

          <div className="network-demo-head">
            <span>15초 설명 시연</span>
            <div className="network-demo-progress">
              <i style={{ width: `${(networkDemoStep + 1) * 20}%` }} />
            </div>
          </div>

          {networkDemoStep === 0 && (
            <div className="network-demo-scene">
              <div className="network-demo-icon">🏡</div>
              <small>여행의 시작</small>
              <h2>스마일펜션 QR에서<br/>여행도우미를 시작합니다.</h2>
              <p>관광객의 출발점이 지역 연결망의 첫 노드가 됩니다.</p>
            </div>
          )}

          {networkDemoStep === 1 && (
            <div className="network-demo-scene">
              <div className="network-demo-icon">🍚</div>
              <small>관광객의 필요</small>
              <h2>“근처에서 식사할 곳이 필요해요.”</h2>
              <p>관광객의 상황과 현재 위치를 기준으로 다음 행동을 찾습니다.</p>
            </div>
          )}

          {networkDemoStep === 2 && (
            <div className="network-demo-scene">
              <div className="network-demo-icon">📍</div>
              <small>지역자원 연결</small>
              <h2>가까운 검증 식당과<br/>관광객을 연결합니다.</h2>

              <div className="network-demo-link">
                <span>🏡 스마일펜션</span>
                <b>→</b>
                <span>🍽️ 지역 식당</span>
              </div>

              <p>이 화면은 설명용 시연이며 실제 이용 실적을 의미하지 않습니다.</p>
            </div>
          )}

          {networkDemoStep === 3 && (
            <div className="network-demo-scene">
              <div className="network-demo-icon">➕</div>
              <small>행동의 증거</small>
              <h2>추천 → 선택 → 길찾기</h2>

              <div className="network-demo-plus">지역 연결 +1</div>

              <p>이런 행동이 쌓이면 지역자원 간 연결 흐름을 확인할 수 있습니다.</p>
            </div>
          )}

          {networkDemoStep === 4 && (
            <div className="network-demo-scene network-demo-final">
              <div className="network-demo-icon">🌐</div>
              <small>지역경제의 흐름</small>
              <h2>관광객을 돕는 순간,<br/>지역의 자원들이 서로 연결됩니다.</h2>
              <strong>Exkovia는 관광객의 이동을 지역의 가치로 연결합니다.</strong>

              <button
                type="button"
                className="network-demo-done"
                onClick={() => setShowNetworkDemo(false)}
              >
                그래프 보기
              </button>
            </div>
          )}
        </div>
      </div>
    )}
    <footer><strong>검색에서 행동으로</strong><p>방문 → 지역 내 이동 → 식사·체험·숙박 → 체류 연장·지역 소비로 연결하는 합천형 AI 관광 실행 플랫폼</p></footer>
  </main>;
}
