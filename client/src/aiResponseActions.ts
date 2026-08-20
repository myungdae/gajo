import { canonicalEntityId, recommendationItemLabel } from "./recommendationItem.ts";
import { verifiedNavigation } from "./journeyExecution.ts";

export type AiResponseActionType = "NAVIGATE" | "ADD_TO_MY_TRIP" | "APPLY_REPLAN" | "FIND_ALTERNATIVES";
export interface AiResponseActionModel { decision: { kind: "PLACE" | "REPLAN"; entity?: any; entityId?: string; label?: string }; actions: { type: AiResponseActionType; primary: boolean }[]; alternatives: any[] }

const explanationOnly = (message: string) => /(?:왜|무엇|뭐가).{0,12}(?:유명|중요|특별)|(?:유래|역사|의미).{0,8}(?:알려|설명)/.test(message);

export function buildAiResponseActionModel(input: { rawMessage?: string; result?: any; hasCurrentItinerary?: boolean; excludedEntityIds?: string[] }): AiResponseActionModel | null {
  const { result } = input;
  if (!result || result.error || explanationOnly(input.rawMessage || "")) return null;
  const excluded = new Set(input.excludedEntityIds || []);
  const discovered = (result.discovery?.entities || []).filter((entity: any) => !excluded.has(canonicalEntityId(entity) || ""));
  const itinerary = result.recommendation?.itinerary?.steps || result.recommendation?.steps || [];
  const candidates = discovered.length ? discovered : itinerary;
  const entity = candidates.find((item: any) => canonicalEntityId(item));
  const validReplan = result.intentRoute === "REPLAN" && input.hasCurrentItinerary && Boolean(result.recommendation?.itinerary);
  if (!entity && !validReplan) return null;
  const actions: AiResponseActionModel["actions"] = [];
  if (validReplan) actions.push({ type: "APPLY_REPLAN", primary: true });
  if (entity && verifiedNavigation(entity)) actions.push({ type: "NAVIGATE", primary: !validReplan });
  if (candidates.length > 1) actions.push({ type: "FIND_ALTERNATIVES", primary: false });
  if (entity && canonicalEntityId(entity)) actions.push({ type: "ADD_TO_MY_TRIP", primary: false });
  if (!actions.length) return null;
  return { decision: { kind: validReplan ? "REPLAN" : "PLACE", entity, entityId: entity && canonicalEntityId(entity), label: entity && recommendationItemLabel(entity) }, actions: actions.slice(0, 3), alternatives: candidates.filter((item: any) => canonicalEntityId(item) !== canonicalEntityId(entity)) };
}
