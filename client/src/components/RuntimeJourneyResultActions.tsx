import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ConciergeChatResponse, CreateContextInput } from "../api/client";
import { useRegion } from "../RegionContext";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import { JOURNEY_COPY, JOURNEY_OPTIONS, journeyRequest, startRuntimeJourney, type JourneyPreferences } from "../runtimeJourney";
import { track } from "../analytics";
import { localizedRegionalPath } from "../visitorRouting";
import { ensureTripSession, type PlannedContext } from "../tripSession";

export default function RuntimeJourneyResultActions({ result, loading, onAdjust, onOther }: {
  result: ConciergeChatResponse;
  loading: boolean;
  onAdjust: (text: string, context: CreateContextInput, planned: PlannedContext) => void;
  onOther: () => void;
}) {
  const { language } = useRegionalLanguage(), region = useRegion(), navigate = useNavigate();
  const copy = JOURNEY_COPY[language];
  const [adjusting, setAdjusting] = useState(false), [value, setValue] = useState<JourneyPreferences>({}), [notice, setNotice] = useState("");
  const rows = [JOURNEY_OPTIONS.duration, JOURNEY_OPTIONS.companion, JOURNEY_OPTIONS.transport, JOURNEY_OPTIONS.walking] as const;
  const keys = ["duration", "companion", "transport", "walking"] as const;
  const legends = language === "ko" ? ["시간", "동행자", "이동수단", "걷기 정도"] : ["Time", "Companions", "Transport", "Walking"];
  const start = () => {
    const session = startRuntimeJourney(region.id, result.recommendation?.itinerary);
    if (!session) { setNotice(language === "ko" ? "시작할 수 있는 검증된 여정 단계가 없습니다." : "No verified journey step is available to start."); return; }
    track("RUNTIME_JOURNEY_STARTED", session.id, { entityId: session.execution?.currentEntityId });
    navigate(localizedRegionalPath("/itinerary", region.id));
  };
  return <section className="runtime-result-actions" aria-labelledby="runtime-start-title">
    <h2 id="runtime-start-title">{copy.startQuestion}</h2>
    <div>
      <button className="btn btn-primary" onClick={start}>{copy.start}</button>
      <button className="btn btn-outline" aria-expanded={adjusting} onClick={() => { setAdjusting(open => !open); track("RUNTIME_JOURNEY_ADJUSTMENT_OPENED", ensureTripSession(region.id).id); }}>{copy.adjust}</button>
      <button className="btn btn-text" onClick={onOther}>{copy.other}</button>
    </div>
    {adjusting && <div className="runtime-adjustment">
      <p>{language === "ko" ? "바꾸려는 조건만 선택하세요. 기존 여정 맥락은 유지합니다." : "Select only what should change. Your journey context remains."}</p>
      <button type="button" aria-pressed={Boolean(value.replacePlace)} onClick={() => setValue(current => ({ ...current, replacePlace: !current.replacePlace }))}>{language === "ko" ? "장소 하나 바꾸기" : "Replace One Place"}</button>
      {rows.map((options, index) => <fieldset key={keys[index]}><legend>{legends[index]}</legend><div className="runtime-choice-grid">
        {options.map(row => <button type="button" key={row[0]} aria-pressed={value[keys[index]] === row[0]} onClick={() => setValue(current => ({ ...current, [keys[index]]: row[0] as never }))}>{row[language === "ko" ? 1 : 2]}</button>)}
      </div></fieldset>)}
      <button className="btn btn-primary" disabled={loading || !Object.keys(value).length} onClick={() => { const request = journeyRequest(value, language); onAdjust(request.text, request.context, request.planned); setAdjusting(false); }}>{language === "ko" ? "선택한 조건으로 다시 구성" : "Re-plan with These Changes"}</button>
    </div>}
    <p role="status">{notice}</p>
  </section>;
}
