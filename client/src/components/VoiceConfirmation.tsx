import type { VoiceSlotName, VoiceUnderstanding } from "../voice/voiceUx";
import { voiceConfirmationPolicy, voiceStateMessage, type VoiceUxState } from "../voice/voiceUx";

const labels:Record<VoiceSlotName,string>={place:"기준 장소",action:"요청",category:"종류",referenceLocation:"검색 기준 지역",constraints:"조건"};
export default function VoiceConfirmation({state,model,onChange,onSpeakSlot,onConfirm,onCancel}:{state:VoiceUxState;model:VoiceUnderstanding;onChange:(slot:VoiceSlotName,value:string)=>void;onSpeakSlot:(slot:VoiceSlotName)=>void;onConfirm:()=>void;onCancel:()=>void}){
  const decision=voiceConfirmationPolicy(model),uncertain=decision.slots,risky=decision.reasons.includes("RISKY_ACTION");
  return <section className="voice-confirmation" aria-labelledby="voice-confirmation-title">
    <p className="voice-state" role="status" aria-live="polite">{voiceStateMessage(state)}</p>
    <h3 id="voice-confirmation-title">{uncertain.length===1?"한 가지만 확인할게요":risky?"실행 전에 확인할게요":"이렇게 이해했어요"}</h3>
    {uncertain.includes("place")&&<p>장소를 정확히 확인해 주세요. 나머지 내용은 그대로 유지합니다.</p>}
    {uncertain.includes("action")&&<p>어떤 도움을 드릴지 선택하거나 글자로 고쳐 주세요.</p>}
    {risky&&uncertain.length===0&&<p><strong>{model.slots.place.value}</strong> · {model.slots.action.value}</p>}
    <div className="voice-slots">
      {uncertain.map(slot=><label key={slot} className="is-uncertain">
        <span>{labels[slot]}{model.slots[slot].confidence==="LOW"&&<small> 확인 필요</small>}</span>
        <span className="voice-slot-controls"><input aria-label={labels[slot]} value={model.slots[slot].value} placeholder={slot==="constraints"?"없음":"직접 입력"} onChange={event=>onChange(slot,event.target.value)}/><button type="button" onClick={()=>onSpeakSlot(slot)} aria-label={`${labels[slot]} 다시 말하기`}>다시 말하기</button></span>
      </label>)}
    </div>
    {uncertain.includes("action")&&<div className="voice-choice-row" aria-label="요청 유형 선택"><button type="button" onClick={()=>onChange("action","주변 장소 찾기")}>주변 장소 찾기</button><button type="button" onClick={()=>onChange("action","장소 정보 보기")}>장소 정보 보기</button></div>}
    <div className="voice-confirm-actions"><button type="button" className="btn btn-outline" onClick={onCancel}>취소하고 글자로 입력</button><button type="button" className="btn btn-primary" onClick={onConfirm} disabled={uncertain.some(slot=>model.slots[slot].confidence!=="HIGH")}>이 내용으로 실행</button></div>
  </section>;
}
