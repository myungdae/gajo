import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countLabel, conversionLabel, VISIT_EXPLANATION, ACTION_EXPLANATION, LEGACY_NOTICE, FUNNEL_LABELS } from './analyticsPresentation.ts';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const dashboard = read('./components/VisitorAnalyticsDashboard.tsx');
const legacy = read('./pages/RegionalReportPage.tsx');
test('session counts and action counts use distinct units, including zero', () => {
  assert.equal(countLabel(6), '6');
  assert.equal(countLabel(63, true), '63회');
  assert.equal(countLabel(0, true), '0회');
  assert.equal(countLabel(null, true), '소규모 보호');
  assert.equal(countLabel(undefined), '소규모 보호');
});
test('funnel ratios use the preceding cohort and never disclose suppressed cells', () => {
  assert.equal(conversionLabel(5, 10), '50.0%');
  assert.equal(conversionLabel(0, 10), '0.0%');
  assert.equal(conversionLabel(0, 0), '기준 세션 없음 — 비율 없음');
  for (const [current, previous] of [[null, 10], [5, null], [null, null], [undefined, 10]])
    assert.equal(conversionLabel(current, previous), '소규모 보호 — 비율 비공개');
  assert.match(dashboard, /conversionLabel\(row.visitSessions, report.funnel\[index - 1\]\?\.visitSessions\)/);
  assert.equal(FUNNEL_LABELS.at(-1), '전화·길찾기·일정 저장 중 하나');
  assert.match(dashboard, /aria-label="병렬 행동"/);
  assert.match(dashboard, /개별 순차 퍼널 수·비율 분리 미지원/);
});
test('administrative copy separates usage, actions and unclassified legacy data', () => {
  assert.equal(VISIT_EXPLANATION, '같은 사람이 다시 방문하면 여러 세션으로 집계될 수 있으며 실제 사람 수와는 다릅니다.');
  assert.equal(ACTION_EXPLANATION, '한 방문 세션에서 같은 기능을 여러 번 사용할 수 있습니다.');
  assert.equal(LEGACY_NOTICE, '기존 통계 — 유입 분류 미지원');
  for (const page of [dashboard, legacy]) {
    for (const label of ['얼마나 이용했나요?', '무엇을 했나요?', '관심에서 실제 이용까지', 'VISIT_EXPLANATION', 'ACTION_EXPLANATION', 'LEGACY_NOTICE']) assert.ok(page.includes(label));
  }
  for (const label of ['여행안내 시작', 'AI 추천 표시', '길찾기·이동 선택', '검색 실패']) assert.ok(legacy.includes(label));
  assert.doesNotMatch(legacy, /"익명 이용 세션"|"AI 여행안내 시작"|"추천 노출"|"이동 의도"/);
  assert.match(legacy, /Number\(total\).toLocaleString\(\)\}회/);
  assert.match(legacy, /신규 30분 방문 세션과 기준이 다릅니다/);
});
test('classification defaults and collection dates remain based on server response', () => {
  assert.match(dashboard, /\[include, setInclude\] = useState\(false\)/);
  assert.match(dashboard, /report.includeInternal/);
  assert.match(dashboard, /내부 검증 포함 · 자동 점검 포함/);
  for (const label of ['관광 서비스 이용 — 일반 유입', '관광 서비스 이용 — QR・링크 귀속 유입', '분류 미확인', '인증된 개발·테스트 세션', '새 통계 수집 시작일:', 'seoul(report.collectionStartedAt)']) assert.ok(dashboard.includes(label));
  assert.match(dashboard, /예약 완료 측정은 이번 범위에 포함되지/);
  assert.match(dashboard, /서로 다른 방문 세션 5개 미만/);
  assert.doesNotMatch(dashboard, /\/regional-report"|\.reduce\(/);
});
