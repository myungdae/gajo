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
import {saveFullJourney} from "../fullJourney";

export default function AiResponseActions({ rawMessage, result, turnId }: { rawMessage: string; result: ConciergeChatResponse; turnId: string }) {
  const region = useRegion(), navigate = useNavigate(), session = ensureTripSession(region.id);
  const [excluded, setExcluded] = useState<string[]>([]), [saved, setSaved] = useState<any>(null),[journeyNotice,setJourneyNotice]=useState('');
  const model = buildAiResponseActionModel({ rawMessage, result, hasCurrentItinerary: Boolean((session.itinerary as any)?.steps?.length), excludedEntityIds: excluded });
  useEffect(() => { if (model) track("AI_RESPONSE_ACTION_SHOWN", session.id, { turnId, actionType: model.actions.map((a) => a.type).join(","), entityId: model.decision.entityId }); }, []);
  if (!model) return null;
  const entity = model.decision.entity;
  const selected = (actionType: string) => track("AI_NEXT_ACTION_SELECTED", session.id, { turnId, actionType, entityId: model.decision.entityId });
  return <section className="ai-response-actions" aria-label="이 답변에서 바로 하기">
    {excluded.length > 0 && model.decision.label && <p className="ai-alternative-decision" aria-live="polite">다음 대안은 <strong>{model.decision.label}</strong>입니다.</p>}
    {model.actions.some((a) => a.type === "APPLY_REPLAN") && <button type="button" className="btn btn-primary" onClick={() => { selected("APPLY_REPLAN"); navigate(regionalPath("/itinerary", region.id), { state: { result } }); }}>일정 변경하기</button>}
    {model.actions.some((a)=>a.type==='VIEW_ITINERARY')&&<button type="button" className="btn btn-primary" onClick={()=>{selected('VIEW_ITINERARY');navigate(regionalPath('/itinerary',region.id),{state:{result}})}}>일정 보기</button>}
    {entity && model.actions.some((a) => a.type === "NAVIGATE") && <EntityActions entity={entity} hideDetail navigationLabel={model.actions.some(a=>a.type==='VIEW_ITINERARY')?'첫 장소로 출발':`${model.decision.label}으로 출발하기`} showItineraryAdd={false} onNavigate={() => selected("NAVIGATE")} />}
    {model.actions.some((a) => a.type === "FIND_ALTERNATIVES") && <button type="button" className="btn btn-outline" onClick={() => { selected("FIND_ALTERNATIVES"); if (model.decision.entityId) setExcluded((items) => [...items, model.decision.entityId!]); }}>{result.discovery?.category === "FOOD" ? "다른 식당 보기" : "다른 곳 추천받기"}</button>}
    {model.actions.some((a)=>a.type==='REORDER_JOURNEY')&&<button type="button" className="btn btn-outline" onClick={()=>{selected('REORDER_JOURNEY');navigate(regionalPath('/itinerary',region.id),{state:{result,editing:true}})}}>순서 바꾸기</button>}
    {model.actions.some((a)=>a.type==='SAVE_JOURNEY')&&<button type="button" className="btn btn-outline" onClick={()=>{selected('SAVE_JOURNEY');const outcome=saveFullJourney(region.id,result.recommendation?.itinerary,localStorage);setJourneyNotice(outcome.status==='saved'?'내 여행에 담았습니다.':outcome.status==='identical'?'이미 내 여행에 담겨 있습니다.':outcome.status==='different'?'기존 내 여행과 다른 일정입니다. 일정 보기에서 변경할 수 있어요.':'내 여행에 담지 못했습니다.')}}>내 여행에 담기</button>}
    {entity && model.actions.some((a) => a.type === "ADD_TO_MY_TRIP") && <button type="button" className="btn btn-outline" onClick={() => { selected("ADD_TO_MY_TRIP"); setSaved(addEntityToRegionalItinerary(region.id, entity, localStorage, track)); }}>내 여행에 담기</button>}
    {saved && <ItineraryAddContinuation entity={entity} result={saved} onReset={() => setSaved(null)} />}
    {journeyNotice&&<p aria-live="polite">{journeyNotice}</p>}
  </section>;
}
