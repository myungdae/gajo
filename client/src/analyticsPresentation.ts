export const VISIT_EXPLANATION = '같은 사람이 다시 방문하면 여러 세션으로 집계될 수 있으며 실제 사람 수와는 다릅니다.';
export const ACTION_EXPLANATION = '한 방문 세션에서 같은 기능을 여러 번 사용할 수 있습니다.';
export const LEGACY_NOTICE = '기존 통계 — 유입 분류 미지원';
export const countLabel = (value: number | null | undefined, action = false) =>
  value == null ? '소규모 보호' : `${value.toLocaleString('ko-KR')}${action ? '회' : ''}`;
export const conversionLabel = (current: number | null | undefined, previous: number | null | undefined) => {
  if (current == null || previous == null) return '소규모 보호 — 비율 비공개';
  if (previous <= 0) return '기준 세션 없음 — 비율 없음';
  return `${(current / previous * 100).toFixed(1)}%`;
};
export const FUNNEL_LABELS = ['장소 검색', '검색 결과 확인', '장소 상세 확인', '전화·길찾기·일정 저장 중 하나'];
