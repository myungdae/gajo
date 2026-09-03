import type { VisitorLocale } from '../visitorLocaleContract.ts';

const visitorApi = /^\/(?:nearby|concierge|recommendations|runtime-replanning|runtime-context|trips|facilities|programs|operational-places|regional-home|reservations|demo)(?:\/|$)/;
export function visitorLocaleRequest<T extends { url?: string; params?: unknown; data?: unknown }>(request: T, locale: VisitorLocale): T {
  if (request.url && !visitorApi.test(request.url)) return request;
  request.params = { ...(request.params as Record<string, unknown> || {}), locale };
  if (request.data && typeof request.data === 'object' && !Array.isArray(request.data) && !(request.data instanceof FormData)) {
    request.data = { ...request.data, locale };
  }
  return request;
}
