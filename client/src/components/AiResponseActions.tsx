import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ConciergeChatResponse } from "../api/client";
import { buildAiResponseActionModel } from "../aiResponseActions";
import { track } from "../analytics";
import { addEntityToRegionalItinerary } from "../journeyExecution";
import { useRegion } from "../RegionContext";
import { regionalPath } from "../regionRouting";
import { ensureTripSession } from "../tripSession";
import EntityActions from "./EntityActions";
import ItineraryAddContinuation from "./ItineraryAddContinuation";

export default function AiResponseActions({ rawMessage, result }: { rawMessage: string; result: ConciergeChatResponse }) {
  const region = useRegion(), navigate = useNavigate(), session = ensureTripSession(region.id);
  const [excluded, setExcluded] = useState<string[]>([]), [saved, setSaved] = useState<any>(null);
  const model = buildAiResponseActionModel({ rawMessage, result, hasCurrentItinerary: Boolean((session.itinerary as any)?.steps?.length), excludedEntityIds: excluded });
  useEffect(() => { if (model) track("AI_RESPONSE_ACTION_SHOWN", session.id, { actionType: model.actions.map((a) => a.type).join(","), entityId: model.decision.entityId }); }, []);
  if (!model) return null;
  const entity = model.decision.entity;
  const selected = (actionType: string) => track("AI_NEXT_ACTION_SELECTED", session.id, { actionType, entityId: model.decision.entityId });
  return <section className="ai-response-actions" aria-label="이 답변에서 바로 하기">
    {excluded.length > 0 && model.decision.label && <p className="ai-alternative-decision" aria-live="polite">다음 대안은 <strong>{model.decision.label}</strong>입니다.</p>}
    {model.actions.some((a) => a.type === "APPLY_REPLAN") && <button type="button" className="btn btn-primary" onClick={() => { selected("APPLY_REPLAN"); navigate(regionalPath("/itinerary", region.id), { state: { result } }); }}>일정 변경하기</button>}
    {entity && model.actions.some((a) => a.type === "NAVIGATE") && <EntityActions entity={entity} hideDetail navigationLabel={`${model.decision.label}으로 출발하기`} showItineraryAdd={false} onNavigate={() => selected("NAVIGATE")} />}
    {model.actions.some((a) => a.type === "FIND_ALTERNATIVES") && <button type="button" className="btn btn-outline" onClick={() => { selected("FIND_ALTERNATIVES"); if (model.decision.entityId) setExcluded((items) => [...items, model.decision.entityId!]); }}>{result.discovery?.category === "FOOD" ? "다른 식당 보기" : "다른 곳 추천받기"}</button>}
    {entity && model.actions.some((a) => a.type === "ADD_TO_MY_TRIP") && <button type="button" className="btn btn-outline" onClick={() => { selected("ADD_TO_MY_TRIP"); setSaved(addEntityToRegionalItinerary(region.id, entity, localStorage, track)); }}>내 여행에 담기</button>}
    {saved && <ItineraryAddContinuation entity={entity} result={saved} onReset={() => setSaved(null)} />}
  </section>;
}
