import type { ReactNode } from "react";

export type RegionalHomeActionType = "FOOD" | "CAFE" | "NEXT_PLACE" | "EVENT_TODAY" | "COMPANION_FRIENDLY";

const paths: Record<RegionalHomeActionType, ReactNode> = {
  FOOD: <><path d="M6 3v7M9 3v7M12 3v7M6 7h6M9 10v11"/><path d="M17 3v18M17 3c2.2 2.1 2.2 6.6 0 8"/></>,
  CAFE: <><path d="M5 8h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8Z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M7 4h8"/></>,
  NEXT_PLACE: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z"/></>,
  EVENT_TODAY: <><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M8 3v5M16 3v5M3.5 10h17M8 14h3M8 17h6"/></>,
  COMPANION_FRIENDLY: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13a5.5 5.5 0 0 1 5.5 5.5V20M14 15.2a4.5 4.5 0 0 1 6.5 4V20"/></>,
};

export function RegionalActionIcon({type}:{type:RegionalHomeActionType}) {
  return <svg className="regional-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[type]}</svg>;
}
