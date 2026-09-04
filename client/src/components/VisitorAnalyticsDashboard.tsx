import { VISIT_EXPLANATION, ACTION_EXPLANATION, LEGACY_NOTICE, countLabel as number, conversionLabel, FUNNEL_LABELS } from "../analyticsPresentation";
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
  ATTRIBUTED_ENTRY: "관광 서비스 이용 — QR・링크 귀속 유입",
  GENERAL_VISIT: "관광 서비스 이용 — 일반 유입",
  INTERNAL_TEST: "내부 검증 — 인증된 개발·테스트 세션",
  AUTOMATED_CHECK: "자동 점검",
  UNKNOWN: "분류 미확인",
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
                <th scope="col">행동・표시 횟수</th>
                <th scope="col">방문 세션</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{labels[row.label] || row.label}</th>
                  <td>{number(row.events, true)}</td>
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
                ? "내부 검증 포함 · 자동 점검 포함"
                : "내부 검증·자동 점검 제외"}
            </strong>{" "}
            · Asia/Seoul · {seoul(report.period.start)} ~{" "}
            {seoul(report.period.endExclusive)} (종료 제외)
          </p>
          <p>새 통계 수집 시작일: {report.collectionStartedAt ? seoul(report.collectionStartedAt) : "아직 수집 없음"} · 마지막 갱신: {seoul(report.generatedAt)}</p>
          <section className="visitor-usage-summary"><h3>얼마나 이용했나요?</h3>
          <dl className="visitor-stats-totals">
            {[
              ["visitSessions", "방문 세션"],
              ["anonymousTrips", "익명 여행"],
            ].map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{number(report.totals[key].value)}</dd>
              </div>
            ))}
          </dl><p>{VISIT_EXPLANATION}</p></section>
          <section className="visitor-action-summary"><h3>무엇을 했나요?</h3><p>{ACTION_EXPLANATION}</p>
            <p>전체 행동·화면 표시 횟수: <strong>{number(report.totals.events.value, true)}</strong></p>
            {table("핵심 행동 횟수", report.events)}
            <p>여행안내 시작·AI 추천 표시·검색 실패의 별도 집계는 신규 계약에서 지원하지 않습니다. 검색 결과 표시는 AI 추천만을 뜻하지 않습니다. 길찾기 선택은 행동별 횟수로 확인하세요.</p>
          </section>
          <section className="visitor-funnel" aria-label="관심에서 실제 이용까지">
            <h3>관심에서 실제 이용까지</h3>
            <p>같은 방문 세션 안에서 같은 검색·결과·장소를 거쳐 다음 단계로 진행한 고유 세션 수입니다. 화면 표시가 실제로 읽었음을 증명하지는 않습니다.</p>
            <p>서비스 진입: 전체 방문 세션 {number(report.totals.visitSessions.value)} · 아래 검색 퍼널의 선행 단계로 연결한 전환율은 미지원입니다.</p>
            <ol>{report.funnel.map((row: any, index: number) => <li key={row.label}>
              <strong>{FUNNEL_LABELS[index] || row.label}</strong>: {number(row.visitSessions)} 방문 세션
              <p>{index === 0 ? "기준: 검색한 고유 방문 세션 · 퍼널 시작 단계" : `기준: 앞 단계에서 진행한 고유 방문 세션 · 이전 단계 대비 ${conversionLabel(row.visitSessions, report.funnel[index - 1]?.visitSessions)}`}</p>
            </li>)}</ol>
            <p>AI 추천 확인은 검색 결과 확인과 별도 구분하지 않아 독립 전환율을 제공하지 않습니다.</p>
            <ul className="visitor-parallel-actions" aria-label="병렬 행동">{["전화", "길찾기", "일정 저장"].map(label=><li key={label}>{label}<small>상세 확인 후 가능한 병렬 행동 · 개별 순차 퍼널 수·비율 분리 미지원</small></li>)}</ul>
            <p>마지막 단계는 전화·길찾기·일정 저장 중 하나 이상을 한 고유 세션입니다. 세 행동을 차례로 완료한 수가 아니며, 행동별 이용 세션을 더해 계산하지 않습니다.</p>
          </section>
          {table("유입 분류", report.classification)}
          <p>관광 서비스 이용은 일반·귀속 유입을 뜻합니다. 일반 접속이나 QR 링크만으로 실제 사람·현장 존재를 증명하지 않습니다. 분류 미확인은 기본 통계에 포함되며, 내부 검증·자동 점검만 기본 제외합니다.</p>
          {table(
            "내부 검증·자동 점검 기록 (기본 집계 제외)",
            report.exclusionCounts,
          )}
          {table("사용 언어 — 세션 기준, 혼합 별도", report.languages)}
          {table("화면별 이용", report.screens)}
          {table("날짜별 이용", report.days)}
          {table("장소별 행동", report.places)}
          <p>
            {report.onsite.label} · 예약 완료 측정은 이번 범위에 포함되지
            않습니다.
          </p>
          <p><strong>{LEGACY_NOTICE}</strong> · {report.legacy.present ? "기존 기록 있음" : "기존 기록 없음"}. 신규 통계와 합산하거나 소급 분류하지 않습니다.</p>
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
