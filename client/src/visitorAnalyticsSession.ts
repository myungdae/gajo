export const VISIT_IDLE_MS = 30 * 60 * 1000;
export type VisitState = {
  visitSessionId: string;
  lastActiveAt: number;
  entryId?: string;
};
export function nextVisit(
  previous: VisitState | null,
  now: number,
  id: () => string,
): VisitState {
  if (
    !previous ||
    now - previous.lastActiveAt >= VISIT_IDLE_MS ||
    now < previous.lastActiveAt
  )
    return { visitSessionId: id(), lastActiveAt: now };
  return { ...previous, lastActiveAt: now };
}
export function analyticsScreen(path: string, regionId: string) {
  if (path === "/" || path === `/${regionId}`) return "HOME";
  if (/\/(nearby|nearby-discovery|nearby-restaurants)$/.test(path))
    return "NEARBY";
  if (path.endsWith("/concierge")) return "CONCIERGE";
  if (path.endsWith("/itinerary")) return "MY_TRIP";
  if (path.endsWith("/map")) return "MAP";
  if (path.startsWith("/go/") || path.startsWith("/visit/"))
    return "PARTNER_ENTRY";
  return "UNKNOWN";
}
