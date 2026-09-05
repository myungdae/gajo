import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ConciergeChatResponse, CreateContextInput } from "../api/client";
import { useRegion } from "../RegionContext";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import { JOURNEY_COPY, JOURNEY_OPTIONS, journeyRequest, runtimeJourneySteps, startRuntimeJourney, type JourneyPreferences } from "../runtimeJourney";
import { recommendationItemLabel } from "../recommendationItem";
import { track } from "../analytics";
import { localizedRegionalPath } from "../visitorRouting";
import { ensureTripSession, type PlannedContext } from "../tripSession";

export default function RuntimeJourneyResultActions({ result, loading, otherOpen, onAdjust, onReplace, onOther, onVoice, onText, onCloseOther }: {
  result: ConciergeChatResponse;
  loading: boolean;
  onAdjust: (text: string, context: CreateContextInput, planned: PlannedContext) => void;
  onReplace: (step: any) => void;
  otherOpen: boolean;
  onOther: () => void;
  onVoice: () => void;
  onText: () => void;
  onCloseOther: () => void;
}) {
  const { language } = useRegionalLanguage(), region = useRegion(), navigate = useNavigate();
  const copy = JOURNEY_COPY[language];
  const [adjusting, setAdjusting] = useState(false), [category,setCategory]=useState<"duration"|"companion"|"transport"|"walking"|"place"|null>(null), [value, setValue] = useState<JourneyPreferences>({}), [notice, setNotice] = useState("");
  const steps=runtimeJourneySteps(result.recommendation), categories=[['duration',copy.durationQuestion],['companion',language==='ko'?'동행자':'Companions'],['transport',language==='ko'?'이동수단':'Transport'],['walking',language==='ko'?'걷기 정도':'Walking'],['place',language==='ko'?'추천 장소':'Recommended Place']] as const;
  const start = () => {
    const session = startRuntimeJourney(region.id, result.recommendation);
    if (!session) { setNotice(language === "ko" ? "시작할 수 있는 검증된 여정 단계가 없습니다." : "No verified journey step is available to start."); return; }
    track("RUNTIME_JOURNEY_STARTED", session.id, { entityId: session.execution?.currentEntityId });
    navigate(localizedRegionalPath("/itinerary", region.id));
  };
  return <section className="runtime-result-actions" aria-labelledby="runtime-start-title">
    <h2 id="runtime-start-title">{copy.startQuestion}</h2>
    <div>
      <button className="btn btn-primary" onClick={start}>{copy.start}</button>
      <button type="button" className="btn btn-outline" aria-expanded={adjusting} onClick={() => { if (!adjusting) track("RUNTIME_JOURNEY_ADJUSTMENT_OPENED", ensureTripSession(region.id).id); onCloseOther();setAdjusting(open => !open);setCategory(null); }}>{copy.adjust}</button>
      <button type="button" className="btn btn-text" aria-expanded={otherOpen} onClick={()=>{setAdjusting(false);setCategory(null);onOther()}}>{copy.other}</button>
    </div>
    {adjusting && <div className="runtime-adjustment">
      <h3>{language==='ko'?'무엇을 바꿀까요?':'What would you like to change?'}</h3><div className="runtime-adjustment-categories">{categories.map(([key,label])=><button type="button" aria-pressed={category===key} onClick={()=>setCategory(key)} key={key}>{label}</button>)}</div>
      {category&&category!=='place'&&<fieldset><legend>{categories.find(([key])=>key===category)?.[1]}</legend><div className="runtime-choice-grid">{JOURNEY_OPTIONS[category].map(row=><button type="button" key={row[0]} aria-pressed={value[category]===row[0]} onClick={()=>setValue(current=>({...current,[category]:row[0] as never}))}>{row[language==='ko'?1:2]}</button>)}</div></fieldset>}
      {category==='place'&&<div className="runtime-place-replacement"><h3>{language==='ko'?'어느 장소를 바꿀까요?':'Which place should change?'}</h3>{steps.map(step=><div key={step.entityId||step.programUri||step.facilityUri}><span>{recommendationItemLabel(step)}</span><button type="button" disabled={loading} onClick={()=>onReplace(step)}>{language==='ko'?'다른 장소 추천':'Recommend Another Place'}</button></div>)}</div>}
      <button className="btn btn-primary" disabled={loading || !Object.keys(value).length} onClick={() => { const request = journeyRequest(value, language); onAdjust(request.text, request.context, request.planned); setAdjusting(false); }}>{language === "ko" ? "선택한 조건으로 다시 구성" : "Re-plan with These Changes"}</button>
      <button type="button" className="btn btn-text" onClick={()=>{setAdjusting(false);setCategory(null);setValue({})}}>{language==='ko'?'취소':'Cancel'}</button>
    </div>}
    {otherOpen&&<div className="runtime-other-request" aria-label={language==='ko'?'다른 요청 방식':'Another request method'}><button type="button" onClick={onVoice}>{copy.speak}</button><button type="button" onClick={onText}>{copy.type}</button><button type="button" className="btn btn-text" onClick={onCloseOther}>{language==='ko'?'닫기':'Close'}</button></div>}
    <p role="status">{notice}</p>
  </section>;
}
