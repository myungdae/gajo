export type PortalEvent =
  | 'portal_region_selected'
  | 'portal_concierge_started'
  | 'portal_faq_opened'
  | 'portal_audience_selected'
  | 'portal_tmap_objection_opened'
  | 'portal_chatgpt_objection_opened';

export function trackPortal(event: PortalEvent, metadata: Record<string, string> = {}) {
  window.dispatchEvent(new CustomEvent('regional-portal-analytics', { detail: { event, ...metadata } }));
}
