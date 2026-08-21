import { canonicalEntityId, recommendationItemLabel } from "./recommendationItem.ts";
import { verifiedNavigation } from "./journeyExecution.ts";

export type AiResponseActionType = "NAVIGATE" | "ADD_TO_MY_TRIP" | "APPLY_REPLAN" | "FIND_ALTERNATIVES" | "VIEW_ITINERARY" | "REORDER_JOURNEY" | "SAVE_JOURNEY";
export interface AiResponseActionModel { decision: { kind: "PLACE" | "REPLAN"; entity?: any; entityId?: string; label?: string }; actions: { type: AiResponseActionType; primary: boolean }[]; alternatives: any[] }

export const isExplanationOnly = (message: string) => /(?:왜|무엇|뭐가).{0,12}(?:유명|중요|특별)|(?:유래|역사|의미).{0,8}(?:알려|설명)/.test(message);

export function buildAiResponseActionModel(input: { rawMessage?: string; result?: any; hasCurrentItinerary?: boolean; excludedEntityIds?: string[] }): AiResponseActionModel | null {
  const { result } = input;
  if (!result || result.error || isExplanationOnly(input.rawMessage || "")) return null;
  const excluded = new Set(input.excludedEntityIds || []);
  const discovered = (result.discovery?.entities || []).filter((entity: any) => !excluded.has(canonicalEntityId(entity) || ""));
  const itinerary = result.recommendation?.itinerary?.steps || result.recommendation?.steps || [];
  const candidates = discovered.length ? discovered : itinerary;
  const entity = candidates.find((item: any) => canonicalEntityId(item));
  const validReplan = result.intentRoute === "REPLAN" && input.hasCurrentItinerary && Boolean(result.recommendation?.itinerary);
  const explicitJourney=result.intentRoute==='JOURNEY_PLAN'&&result.requestedDestinations?.length>1&&itinerary.length>1;
  if (!entity && !validReplan) return null;
  const actions: AiResponseActionModel["actions"] = [];
  if(explicitJourney){actions.push({type:'VIEW_ITINERARY',primary:true});if(entity&&verifiedNavigation(entity))actions.push({type:'NAVIGATE',primary:false});actions.push({type:'REORDER_JOURNEY',primary:false},{type:'SAVE_JOURNEY',primary:false});return{decision:{kind:'PLACE',entity,entityId:entity&&canonicalEntityId(entity),label:entity&&recommendationItemLabel(entity)},actions,alternatives:[]}}
  if (validReplan) actions.push({ type: "APPLY_REPLAN", primary: true });
  if (entity && verifiedNavigation(entity)) actions.push({ type: "NAVIGATE", primary: !validReplan });
  if (candidates.length > 1) actions.push({ type: "FIND_ALTERNATIVES", primary: false });
  if (entity && canonicalEntityId(entity)) actions.push({ type: "ADD_TO_MY_TRIP", primary: false });
  if (!actions.length) return null;
  return { decision: { kind: validReplan ? "REPLAN" : "PLACE", entity, entityId: entity && canonicalEntityId(entity), label: entity && recommendationItemLabel(entity) }, actions: actions.slice(0, 3), alternatives: candidates.filter((item: any) => canonicalEntityId(item) !== canonicalEntityId(entity)) };
}
