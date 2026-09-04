import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useRegion } from "../RegionContext";
import { startAnalyticsTestVisit } from "../visitorAnalytics";
import "./visitor-analytics.css";
const labels: Record<string, string> = {
  ko: "한국어",
  en: "영어",
  mixed: "혼합",
  unknown: "미확인",
  VERIFIED_ONSITE: "현장 확인",
  ATTRIBUTED_ENTRY: "QR·링크 귀속",
  GENERAL_VISIT: "일반 진입",
  INTERNAL_TEST: "내부 검증",
  AUTOMATED_CHECK: "자동 점검",
  UNKNOWN: "판별 불가",
  HOME: "홈",
  NEARBY: "주변 검색",
  CONCIERGE: "AI 여행도우미",
  MY_TRIP: "내 여행",
  MAP: "지도",
  PARTNER_ENTRY: "업체 진입",
  PAGE_VIEWED: "화면 조회",
  REGION_HOME_VIEWED: "지역 홈 진입",
  NEARBY_SEARCH_SUBMITTED: "검색 실행",
  SEARCH_RESULTS_SHOWN: "결과 노출",
  PLACE_DETAIL_OPENED: "상세 열기",
  PHONE_CLICKED: "전화 클릭",
  DIRECTIONS_CLICKED: "길찾기 클릭",
  ITINERARY_SAVE_SUCCEEDED: "일정 저장 성공",
};
const seoul = (value: string) =>
  new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
const number = (value: number | null | undefined) =>
  value == null ? "소규모 보호" : value.toLocaleString();
export default function VisitorAnalyticsDashboard({
  token,
}: {
  token: string;
}) {
  const region = useRegion(),
    [period, setPeriod] = useState("7d"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [include, setInclude] = useState(false),
    [report, setReport] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [markerNotice, setMarkerNotice] = useState("");
  const requestId = useRef(0);
  useEffect(() => {
    requestId.current++;
    setReport(null);
    setError("");
    setLoading(false);
  }, [region.id, token]);
  const load = async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const { data } = await api.get("/analytics/v2/report", {
        headers: { "x-admin-token": token },
        params: {
          regionId: region.id,
          period,
          includeInternal: String(include),
          ...(period === "custom" ? { from, to } : {}),
        },
      });
      if (id === requestId.current) setReport(data);
    } catch {
      if (id === requestId.current)
        setError(
          "통계를 불러오지 못했습니다. 토큰의 지역 권한과 기간을 확인해 주세요.",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };
  const marker = async () => {
    try {
      const visit = startAnalyticsTestVisit(region.id);
      const { data } = await api.post(
        "/analytics/v2/markers",
        {
          regionId: region.id,
          visitSessionId: visit.visitSessionId,
          kind: "INTERNAL_TEST",
        },
        { headers: { "x-admin-token": token } },
      );
      sessionStorage.setItem(`analytics-marker:${region.id}`, data.token);
      setMarkerNotice(
        `이 탭의 현재 방문 세션에 검증 표식을 적용했습니다. 만료: ${data.expiresAt}. 30분 비활동으로 세션이 바뀌면 다시 발급하세요.`,
      );
    } catch {
      setMarkerNotice("표식을 발급하지 못했습니다. 지역 권한을 확인해 주세요.");
    }
  };
  const table = (title: string, rows: any[]) => (
    <section>
      <h3>{title}</h3>
      {rows.length ? (
        <div className="visitor-stats-table">
          <table>
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">이벤트</th>
                <th scope="col">방문 세션</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{labels[row.label] || row.label}</th>
                  <td>{number(row.events)}</td>
                  <td>{number(row.visitSessions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>선택 기간에 수집된 데이터가 없습니다.</p>
      )}
    </section>
  );
  return (
    <section className="card visitor-stats" aria-label="신뢰 기반 이용 통계">
      <h2>관광 서비스 이용 통계</h2>
      <p>
        {region.regionName} · 방문 세션과 익명 여행을 집계합니다. 실제 사람 수
        또는 현장 방문 수가 아닙니다.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="visitor-stats-controls"
      >
        <label>
          집계 기간
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {[
              ["today", "오늘"],
              ["yesterday", "어제"],
              ["7d", "최근 7일"],
              ["30d", "최근 30일"],
              ["custom", "사용자 지정"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {period === "custom" && (
          <>
            <label>
              시작 날짜
              <input
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              종료 날짜
              <input
                type="date"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        )}
        <label>
          <input
            type="checkbox"
            checked={include}
            onChange={(e) => setInclude(e.target.checked)}
          />
          내부 검증·자동 점검 포함
        </label>
        <button className="btn btn-primary" disabled={!token || loading}>
          {loading ? "조회 중…" : "통계 조회"}
        </button>
      </form>
      {!token && (
        <p>상단 Regional Data Manager에서 관리자 인증 후 조회하세요.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {report && report.regionId === region.id && (
        <div aria-live="polite">
          <p>
            <strong>
              {report.includeInternal
                ? "내부 검증·자동 점검 포함"
                : "내부 검증·자동 점검 제외"}
            </strong>{" "}
            · Asia/Seoul · {seoul(report.period.start)} ~{" "}
            {seoul(report.period.endExclusive)} (종료 제외)
          </p>
          <dl className="visitor-stats-totals">
            {[
              ["events", "이벤트 수"],
              ["visitSessions", "방문 세션"],
              ["anonymousTrips", "익명 여행"],
            ].map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{number(report.totals[key].value)}</dd>
              </div>
            ))}
          </dl>
          {table("유입 분류", report.classification)}
          {table(
            "내부 검증·자동 점검 기록 (기본 집계 제외)",
            report.exclusionCounts,
          )}
          {table("사용 언어 — 세션 기준, 혼합 별도", report.languages)}
          {table("화면별 이용", report.screens)}
          {table("행동별 이용", report.events)}
          {table("날짜별 이용", report.days)}
          <h3>검색 → 결과 → 상세 → 행동</h3>
          <ol>
            {report.funnel.map((row: any) => (
              <li key={row.label}>
                {row.label}: {number(row.visitSessions)} 방문 세션
              </li>
            ))}
          </ol>
          {table("장소별 행동", report.places)}
          <p>
            {report.onsite.label} · 예약 완료 측정은 이번 범위에 포함되지
            않습니다.
          </p>
          <details>
            <summary>통계 정의·제외 조건·보존 기준</summary>
            {Object.entries(report.definitions).map(([key, value]) => (
              <p key={key}>{String(value)}</p>
            ))}
            <p>
              서로 다른 방문 세션 5개 미만인 셀이 있으면 해당 표 전체를 숨겨
              합계 역산을 방지합니다. 개인별 이동 경로는 제공하지 않습니다. 원시
              이벤트 보존 90일.
            </p>
            <p>
              수집 시작: {report.collectionStartedAt || "아직 수집 없음"} ·
              마지막 갱신: {report.generatedAt}
            </p>
            <p>
              {report.legacy.label}
              {report.legacy.present
                ? " (기존 기록 있음)"
                : " (기존 기록 없음)"}
            </p>
          </details>
        </div>
      )}
      <details>
        <summary>이 탭에서 내부 검증 시작</summary>
        <p>
          관리자 인증·지역 권한으로 1시간 표식을 발급합니다. 쿼리 문자열로는
          지정할 수 없습니다.
        </p>
        <button
          type="button"
          className="btn btn-outline"
          disabled={!token}
          onClick={() => void marker()}
        >
          내부 검증 표식 발급
        </button>
        <p role="status">{markerNotice}</p>
      </details>
    </section>
  );
}
