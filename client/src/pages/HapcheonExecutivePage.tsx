import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import PublicBrand from "../components/PublicBrand";
import "./hapcheon-executive.css";

type NetworkChangeItem = {
  kind: "NEWLY_RELEASED" | "STRENGTHENED" | "WEAKENED" | "NO_LONGER_PUBLIC";
  sourceNodeId: string;
  targetNodeId: string;
  sourceName: string;
  targetName: string;
  stage: string;
  previousTotal?: number;
  currentTotal?: number;
  delta?: number;
};

type NetworkChangeSnapshot = {
  status: "AVAILABLE" | "INSUFFICIENT_HISTORY";
  notice?: string;
  comparison?: {
    currentPeriodKey: string;
    previousPeriodKey: string;
    currentSnapshotAt?: string;
    previousSnapshotAt?: string;
  };
  summary?: {
    previousConnections: number;
    currentConnections: number;
    newlyReleased: number;
    strengthened: number;
    weakened: number;
    noLongerPublic: number;
    previousInterest: number;
    currentInterest: number;
    interestDelta: number;
    previousMovement: number;
    currentMovement: number;
    movementDelta: number;
    newlyReleasedInterestContribution: number;
  };
  changes?: {
    newlyReleased: NetworkChangeItem[];
    strengthened: NetworkChangeItem[];
    weakened: NetworkChangeItem[];
    noLongerPublic: NetworkChangeItem[];
  };
  interpretation?: {
    interestIncreaseMostlyFromNewlyReleased: boolean;
    caution: string;
  };
};

export default function HapcheonExecutivePage() {
  const [change, setChange] = useState<NetworkChangeSnapshot>();
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const response = await api.get(
          "/public/regional-network/hapcheon/change",
        );
        setChange(response.data || undefined);
    } catch {
  setError("");
  setChange({
    status: "INSUFFICIENT_HISTORY",
    notice: "시연용 예시 데이터",
  });
}
    };

    void load();
  }, []);

  const highlights = useMemo(
    () =>
      [
        ...(change?.changes?.newlyReleased || []).slice(0, 2),
        ...(change?.changes?.strengthened || []).slice(0, 2),
      ].slice(0, 3),
    [change],
  );

const demoMode = change?.status === "INSUFFICIENT_HISTORY";

const summary =
  change?.summary ??
  (demoMode
    ? {
        previousConnections: 5,
        currentConnections: 8,
        newlyReleased: 3,
        strengthened: 2,
        weakened: 1,
        noLongerPublic: 0,
        previousInterest: 12,
        currentInterest: 19,
        interestDelta: 7,
        previousMovement: 6,
        currentMovement: 10,
        movementDelta: 4,
        newlyReleasedInterestContribution: 4,
      }
    : undefined);
    const demoHighlights: NetworkChangeItem[] = [
  {
    kind: "NEWLY_RELEASED",
    sourceNodeId: "demo-1",
    targetNodeId: "demo-2",
    sourceName: "합천호",
    targetName: "지역 음식점",
    stage: "MOVEMENT_INTENT",
  },
  {
    kind: "STRENGTHENED",
    sourceNodeId: "demo-3",
    targetNodeId: "demo-4",
    sourceName: "숙박",
    targetName: "관광지",
    stage: "MOVEMENT_INTENT",
  },
  {
    kind: "NEWLY_RELEASED",
    sourceNodeId: "demo-5",
    targetNodeId: "demo-6",
    sourceName: "관광지",
    targetName: "카페",
    stage: "INTEREST",
  },
];

const executiveHighlights =
  highlights.length > 0 ? highlights : demoMode ? demoHighlights : [];

  return (
    <main className="executive-view">
      <PublicBrand />

{demoMode && (
  <div className="executive-demo-badge">
    시연용 예시 데이터 · 실제 운영 시 누적 snapshot으로 자동 전환
  </div>
)}

      <header className="executive-hero">
        <div>
          <small>HAPCHEON OPERATIONAL INTELLIGENCE</small>
          <h1>합천 관광·스포츠 운영 인텔리전스</h1>
          <p>군수 Decision View</p>
        </div>

        <a
          className="executive-detail-link"
          href="/hapcheon/network-report?demo=1"
        >
          상세 Network 분석 보기
        </a>
      </header>

      {error && <section className="executive-error">{error}</section>}

      {!error && !change && (
        <section className="executive-loading">
          현재 지역 변화를 불러오고 있습니다...
        </section>
      )}

      {summary && (
        <>
          <section className="executive-section">
            <div className="executive-section-heading">
              <span>01</span>
              <div>
                <small>WHAT CHANGED</small>
                <h2>지금 무엇이 달라졌나</h2>
              </div>
            </div>

            <div className="executive-kpis">
              <article className="executive-kpi executive-kpi-primary">
                <small>공개 연결</small>
                <strong>
                  {summary.previousConnections}
                  <i>→</i>
                  {summary.currentConnections}
                </strong>
              </article>

              <article className="executive-kpi">
                <small>새로 공개된 연결</small>
                <strong>+{summary.newlyReleased}</strong>
              </article>

              <article className="executive-kpi">
                <small>강해진 연결</small>
                <strong>+{summary.strengthened}</strong>
              </article>
            </div>
          </section>

          <section className="executive-section">
            <div className="executive-section-heading">
              <span>02</span>
              <div>
                <small>WHY IT MATTERS</small>
                <h2>이 변화가 뜻하는 것</h2>
              </div>
            </div>

            <div className="executive-meaning">
              <p>
                관광객의 실제 행동이 관광지·음식점·숙박·체험을
                서로 연결하는 지역의 흐름으로 나타나고 있습니다.
              </p>

              <p>
                반복해서 강해지는 연결과 새롭게 나타난 연결을 보면
                다음 관광동선과 지역상권 연결의 우선순위를 검토할 수
                있습니다.
              </p>
            </div>

            {executiveHighlights.length > 0 && (
              <div className="executive-highlights">
                <small>주목할 변화</small>

                {executiveHighlights.map((item, index) => (
                  <div
                    key={`${item.kind}-${item.sourceNodeId}-${item.targetNodeId}-${index}`}
                  >
                    <span>
                      {item.kind === "NEWLY_RELEASED"
                        ? "새로 공개"
                        : "강화"}
                    </span>

                    <strong>
                      {item.sourceName} <i>→</i> {item.targetName}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="executive-section">
            <div className="executive-section-heading">
              <span>03</span>
              <div>
                <small>DECISION OPTIONS</small>
                <h2>지금 검토할 세 가지 방향</h2>
              </div>
            </div>

            <div className="executive-coa-grid">
              <article>
                <div>
                  <span>COA-A</span>
                  <em>빠른 성과형</em>
                </div>
                <h3>강한 연결 확대</h3>
                <p>
                  반복되거나 강화되고 있는 연결을 우선 활용해
                  추천 동선과 연계 자원으로 확장합니다.
                </p>
                <strong>근거 · 강해진 연결 +{summary.strengthened}</strong>
              </article>

              <article>
                <div>
                  <span>COA-B</span>
                  <em>균형 확장형</em>
                </div>
                <h3>약한 연결 보완</h3>
                <p>
                  약해지거나 끊어진 흐름을 살펴보고 관광·음식·숙박
                  사이의 연결을 보완합니다.
                </p>
                <strong>
                  근거 · 약화 {summary.weakened} · 공개 중단{" "}
                  {summary.noLongerPublic}
                </strong>
              </article>

              <article>
                <div>
                  <span>COA-C</span>
                  <em>가치 발굴형</em>
                </div>
                <h3>신규 연결 실험</h3>
                <p>
                  새롭게 나타난 연결을 새로운 관광동선과 지역상권
                  연계 가능성으로 시험합니다.
                </p>
                <strong>
                  근거 · 신규 연결 +{summary.newlyReleased}
                </strong>
              </article>
            </div>
          </section>

          <section className="executive-principle">
            <small>DECISION PRINCIPLE</small>
            <h2>AI는 결정을 대신하지 않습니다.</h2>
            <p>
              현재의 상황과 근거, 검토 가능한 선택지를 제시합니다.
              <br />
              최종 판단과 책임은 사람에게 있습니다.
            </p>
          </section>

          {change?.interpretation?.caution && (
  <p className="executive-caution">
    ※ {change.interpretation.caution}
  </p>
)}

        </>
      )}
    </main>
  );
}