import { useMemo, useState } from "react";

type Stage =
  | "ALL"
  | "INTEREST"
  | "MOVEMENT_INTENT"
  | "QR_VISIT_CONFIRMED"
  | "BENEFIT_USE_CONFIRMED";
type Node = { id: string; entityId: string; name: string; category: string };
type Edge = {
  sourceNodeId: string;
  targetNodeId: string;
  stage: Exclude<Stage, "ALL">;
  total: number;
  unit: string;
};
export type TourismNetworkReport = {
  period: {
    key: "30d";
    timeZone: "Asia/Seoul";
    start?: string;
    endExclusive?: string;
  };
  privacy: { minimumCellSize: number };
  network: {
    status: "AVAILABLE" | "PREPARING";
    notice?: string;
    nodes: Node[];
    edges: Edge[];
    stageTotals: Array<{ stage: string; total: number; unit: string }>;
    categoryConnections: Array<{
      sourceCategory: string;
      targetCategory: string;
      stage: string;
      total: number;
      unit: string;
    }>;
  };
};
const STAGES: Array<[Stage, string]> = [
  ["ALL", "전체"],
  ["INTEREST", "관심"],
  ["MOVEMENT_INTENT", "이동 의도 연결"],
  ["QR_VISIT_CONFIRMED", "현장 QR 확인"],
  ["BENEFIT_USE_CONFIRMED", "검증된 혜택 이용"],
];
const stageLabel = (stage: string) =>
  STAGES.find(([key]) => key === stage)?.[1] || "기타 연결";

export default function RegionalTourismNetwork({
  report,
}: {
  report?: TourismNetworkReport;
}) {
  const [stage, setStage] = useState<Stage>("ALL"),
    nodes = useMemo(
      () =>
        new Map((report?.network.nodes || []).map((node) => [node.id, node])),
      [report],
    ),
    edges = (report?.network.edges || []).filter(
      (edge) => stage === "ALL" || edge.stage === stage,
    ),
    max = Math.max(1, ...edges.map((edge) => edge.total));
  return (
    <section
      className="tourism-network"
      aria-labelledby="tourism-network-title"
    >
      <div className="network-heading">
        <div>
          <small>최근 완료된 30일 · Asia/Seoul</small>
          <h2 id="tourism-network-title">익명·집계 기반 지역 관광 연결망</h2>
          <p>같은 익명 이용 흐름에서 함께 관찰된 연결만 집계합니다.</p>
        </div>
        <div className="network-filters" role="group" aria-label="연결 단계">
          {STAGES.map(([key, label]) => (
            <button
              key={key}
              aria-pressed={stage === key}
              onClick={() => setStage(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!report ||
      report.network.status === "PREPARING" ||
      edges.length === 0 ? (
        <div className="network-empty">
          <strong>연결 데이터 준비 중</strong>
          <p>개인정보 보호 기준을 통과한 연결이 쌓이면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <>
          <div className="network-map" aria-hidden="true">
            {edges.map((edge) => {
              const source = nodes.get(edge.sourceNodeId),
                target = nodes.get(edge.targetNodeId);
              if (!source || !target) return null;
              return (
                <div
                  className={`network-link stage-${edge.stage.toLowerCase()}`}
                  key={`${edge.sourceNodeId}-${edge.targetNodeId}-${edge.stage}`}
                >
                  <span className="network-node">{source.name}</span>
                  <span
                    className="network-line"
                    style={{
                      height: `${Math.max(4, Math.round((edge.total / max) * 14))}px`,
                    }}
                  />
                  <span className="network-node">{target.name}</span>
                </div>
              );
            })}
          </div>
          <div className="network-cards" aria-label="주요 장소 간 연결">
            {edges.map((edge) => {
              const source = nodes.get(edge.sourceNodeId),
                target = nodes.get(edge.targetNodeId);
              if (!source || !target) return null;
              return (
                <article
                  key={`${edge.sourceNodeId}-${edge.targetNodeId}-${edge.stage}`}
                >
                  <small>{stageLabel(edge.stage)}</small>
                  <h3>
                    {source.name} → {target.name}
                  </h3>
                  <p>
                    {source.category}에서 {target.category}로 함께 관찰된 연결
                  </p>
                  <strong>{edge.total.toLocaleString()}회</strong>
                  <span>연결 이벤트 횟수</span>
                </article>
              );
            })}
          </div>
          <div className="network-category-list">
            <h3>카테고리별 연결</h3>
            {report.network.categoryConnections
              .filter((item) => stage === "ALL" || item.stage === stage)
              .map((item) => (
                <div
                  key={`${item.sourceCategory}-${item.targetCategory}-${item.stage}`}
                >
                  <span>
                    {item.sourceCategory} → {item.targetCategory} ·{" "}
                    {stageLabel(item.stage)}
                  </span>
                  <strong>{item.total.toLocaleString()}회</strong>
                </div>
              ))}
          </div>
        </>
      )}
      <aside className="network-privacy-note">
        <strong>개인정보 보호 및 해석상의 한계</strong>
        <p>
          개별 이용 흐름이나 위치 정보는 제공하지 않습니다. 연결은 방문·도착·매출의
          인과관계가 아니며, 현장 QR 확인은 GPS 확인을 뜻하지 않습니다. 모든
          node·edge·단계별 통계는 {report?.privacy.minimumCellSize || 5}건
          미만일 때 공개되지 않습니다.
        </p>
      </aside>
    </section>
  );
}
