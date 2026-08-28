import type { TripSession } from "./tripSession";

const seoulDay = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);

export function continueTripLabel(session: TripSession, now = new Date()) {
  const tripDate = session.plannedContext?.startDate || session.createdAt;
  return seoulDay(tripDate) === seoulDay(now)
    ? "오늘 여행 계속하기"
    : "이 여행 이어가기";
}

export function homeTripSummary(session: TripSession) {
  const tripDate = session.plannedContext?.startDate || session.createdAt;
  const date = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(new Date(tripDate));
  const steps = Array.isArray((session.itinerary as any)?.steps)
    ? (session.itinerary as any).steps
    : [];
  const status = session.execution?.statusByEntityId || {};
  const entityId = (step: any) =>
    step?.entityId || step?.programUri || step?.facilityUri;
  const resolvedStatus = (step: any) => status[entityId(step)] || step.status;
  const visited = steps.filter((step: any) => resolvedStatus(step) === "COMPLETED").length;
  const remaining = steps.filter(
    (step: any) => !["COMPLETED", "SKIPPED"].includes(resolvedStatus(step)),
  ).length;
  return {
    heading: `${date} · 합천 여행`,
    detail:
      steps.length > 0
        ? `방문 ${visited}곳 · 남은 일정 ${remaining}곳`
        : undefined,
  };
}
