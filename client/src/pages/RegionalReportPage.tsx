import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { entrySourceLabel, featureLabel } from "../regionalReportPresentation";
import {
  canonicalRegionalReportPath,
  regionalReportRegion,
  reportScopeMatchesRoute,
} from "../regionalReportRouting";
import "./regional-report.css";
import RegionalTourismNetwork, {
  type TourismNetworkReport,
} from "../components/RegionalTourismNetwork";
import PublicBrand from "../components/PublicBrand";
type Cell = {
  status: "AVAILABLE" | "SUPPRESSED" | "PREPARING";
  total?: number;
  label?: string;
};
const value = (v: Cell | number | undefined) =>
  typeof v === "number"
    ? v.toLocaleString()
    : v?.status === "AVAILABLE"
      ? Number(v.total || 0).toLocaleString()
      : v?.label || "측정 준비 중";
export default function RegionalReportPage() {
  const navigate = useNavigate(),
    { regionId: routeRegionId } = useParams(),
    routeRegion = regionalReportRegion(routeRegionId),
    unsupportedRegion = Boolean(routeRegionId && !routeRegion),
    [token, setToken] = useState(
      () => sessionStorage.getItem("regional-report-token") || "",
    ),
    [period, setPeriod] = useState("7d"),
    [reportState, setReport] = useState<any>(),
    [networkState, setNetwork] = useState<TourismNetworkReport>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const load = async (current = token) => {
    if (!current || unsupportedRegion) return;
    setLoading(true);
    setError("");
    setReport(undefined);
    setNetwork(undefined);
    try {
      const headers = { "x-regional-report-token": current },
        params = {
          period,
          ...(routeRegion ? { regionId: routeRegion.id } : {}),
        },
        [{ data }, { data: network }] = await Promise.all([
          api.get("/regional-report", { params, headers }),
          api.get("/regional-report/network", { headers }),
        ]);
      const responseRegion = regionalReportRegion(data?.region?.id);
      if (
        !responseRegion ||
        !reportScopeMatchesRoute(routeRegion?.id, responseRegion.id)
      )
        throw new Error("Regional report scope mismatch");
      if (network?.region?.id !== responseRegion.id)
        throw new Error("Regional network scope mismatch");
      sessionStorage.setItem("regional-report-token", current);
      if (!routeRegion)
        navigate(canonicalRegionalReportPath(responseRegion.id), {
          replace: true,
        });
      setReport(data);
      setNetwork(network);
    } catch {
      setReport(undefined);
      setNetwork(undefined);
      setError("리포트 인증을 확인하거나 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (token) void load();
    // A period change refreshes the already-authenticated report. Token submission is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, routeRegionId]);
  const login = (e: FormEvent) => {
    e.preventDefault();
    void load();
  };
  const logout = () => {
    sessionStorage.removeItem("regional-report-token");
    setToken("");
    setReport(undefined);
    setNetwork(undefined);
    setError("");
  };
  const report =
    reportState &&
    reportScopeMatchesRoute(routeRegion?.id, reportState.region?.id)
      ? reportState
      : undefined;
  if (unsupportedRegion)
    return (
      <section className="report-login">
        <PublicBrand compact linked={false} />
        <h1>지원하지 않는 지역 리포트</h1>
        <p className="notice">Legacy / unknown 집계입니다. 내부 검증·자동 점검이 분리되지 않은 기존 이벤트이며 신규 관리자 통계와 합산하지 않습니다.</p>
        <p>등록된 지역 운영 리포트 주소인지 확인해 주세요.</p>
      </section>
    );
  if (!report)
    return (
      <section className="report-login">
        <PublicBrand compact linked={false} />
        <h1>
          {routeRegion
            ? `${routeRegion.regionName} 현장 운영 리포트`
            : "현장 운영 리포트"}
        </h1>
        <p>지역 운영자용 읽기 전용 화면입니다.</p>
        <form onSubmit={login}>
          <label htmlFor="report-token">읽기 전용 접근 키</label>
          <input
            id="report-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
          <button disabled={loading || !token}>
            {loading ? "확인 중" : "리포트 열기"}
          </button>
        </form>
        {error && (
          <p role="alert" className="report-error">
            {error}
          </p>
        )}
      </section>
    );
  const cards = [
    ["익명 이용 세션", report.summary.anonymousSessions, "세션 수"],
    ["AI 여행안내 시작", report.summary.aiGuideStarts, "시작 이벤트"],
    ["추천 노출", report.summary.recommendationImpressions, "노출 횟수"],
    ["이동 의도", report.summary.movementIntent, "연결 횟수"],
    ["검색 실패", report.summary.searchFailures, "검색 대체·재시도 오류"],
  ];
  return (
    <article className="regional-report">
      <header>
        <div>
          <PublicBrand compact linked={false} />
          <span className="readonly-badge">읽기 전용</span>
          <h1>{report.region.name} 현장 운영 리포트</h1>
          <p>
            마지막 집계{" "}
            {new Date(report.generatedAt).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}
          </p>
          <button className="report-logout" type="button" onClick={logout}>
            접근 키 지우기
          </button>
        </div>
        <div className="period-tabs" role="group" aria-label="집계 기간">
          {[
            ["today", "오늘"],
            ["7d", "최근 7일"],
            ["30d", "최근 30일"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {loading && <p role="status">집계 중입니다.</p>}
      <section className="summary-grid" aria-label="요약">
        {cards.map(([label, total, unit]) => (
          <div className="metric-card" key={String(label)}>
            <span>{label}</span>
            <strong>{Number(total).toLocaleString()}</strong>
            <small>{unit}</small>
          </div>
        ))}
      </section>
      <section>
        <h2>관심에서 실제 이용까지</h2>
        <div className="funnel-grid">
          {report.funnel.map((x: any, i: number) => (
            <div className="funnel-card" key={x.stage}>
              <small>0{i + 1}</small>
              <h3>{x.stage}</h3>
              <strong>{value(x)}</strong>
              <span>{x.unit || "현재 수집 경계 없음"}</span>
            </div>
          ))}
        </div>
        <p className="report-note">
          길찾기 연결은 실제 방문이 아니며, 현장 QR 확인은 GPS로 검증된 도착을
          의미하지 않습니다.
        </p>
      </section>
      <div className="report-columns">
        <section>
          <h2>카테고리별 이용</h2>
          <div className="compact-list">
            {report.categories.map((x: any) => (
              <div key={x.label}>
                <span>{x.label}</span>
                <strong>
                  {x.total.toLocaleString()} <small>{x.unit}</small>
                </strong>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2>기능별 이용</h2>
          <div className="compact-list">
            {Object.entries(report.features).map(([label, total]) => (
              <div key={label}>
                <span>{featureLabel(label)}</span>
                <strong>{Number(total).toLocaleString()}회</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="report-columns">
        <section>
          <h2>유입 경로</h2>
          {report.entrySources.length ? (
            <div className="compact-list">
              {report.entrySources.map((x: any) => (
                <div key={x.label}>
                  <span>{entrySourceLabel(x.label)}</span>
                  <strong>{value(x.value)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">집계된 유입 경로가 없습니다.</p>
          )}
        </section>
        <section>
          <h2>오류·검색 실패</h2>
          <div className="compact-list">
            <div>
              <span>검색 대체 안내</span>
              <strong>{report.errors.fallback}회</strong>
            </div>
            <div>
              <span>재시도 오류</span>
              <strong>{report.errors.retry}회</strong>
            </div>
          </div>
        </section>
      </div>
      <section>
        <h2>업소별 성과</h2>
        {report.partners.length ? (
          <div className="partner-table" role="table">
            <div className="partner-row partner-head" role="row">
              <span>업소</span>
              <span>AI 노출</span>
              <span>상세조회</span>
              <span>이동 연결</span>
              <span>현장 QR</span>
              <span>검증 이용</span>
            </div>
            {report.partners.map((p: any) => (
              <div className="partner-row" role="row" key={p.entityId}>
                <strong>{p.name}</strong>
                <span>{value(p.impressions)}</span>
                <span>{value(p.detail)}</span>
                <span>{value(p.movement)}</span>
                <span>{value(p.qr)}</span>
                <span>{value(p.verifiedUses)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            공개 상태와 안정 entity 연결을 충족한 업소 집계가 없습니다.
          </p>
        )}
      </section>
      <RegionalTourismNetwork report={networkState} />
      <footer>
        <strong>개인정보 보호 안내</strong>
        <p>{report.privacy.notice}</p>
        <small>
          세부 통계는 기본 {report.privacy.minimumCellSize}건 미만일 때 정확한
          수를 표시하지 않습니다. 이 기준은 초기 보호 기본값이며 법률 준수를
          보증하지 않습니다.
        </small>
      </footer>
    </article>
  );
}
