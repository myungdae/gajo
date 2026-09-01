import type { VoiceSlotName, VoiceUnderstanding } from "../voice/voiceUx";
import { voiceConfirmationPolicy, voiceStateMessage, type VoiceUxState } from "../voice/voiceUx";

export default function VoiceConfirmation({state,model,onChange:_onChange,onSpeakSlot,onConfirm,onCancel}:{state:VoiceUxState;model:VoiceUnderstanding;onChange:(slot:VoiceSlotName,value:string)=>void;onSpeakSlot:(slot:VoiceSlotName)=>void;onConfirm:()=>void;onCancel:()=>void}){
  const decision=voiceConfirmationPolicy(model),slot=decision.slots[0],risky=decision.reasons.includes("RISKY_ACTION"),value=slot?model.slots[slot].value:"";
  const question=slot==="place"?`${value||"말씀하신 장소"}을(를) 말씀하셨나요?`:slot==="action"?"주변 장소를 찾을까요?":slot==="category"?"어떤 종류를 찾을까요?":slot==="referenceLocation"?"현재 위치를 기준으로 찾을까요?":"이 조건을 적용할까요?";
  return <section className="voice-confirmation" aria-labelledby="voice-confirmation-title">
    <p className="voice-state" role="status" aria-live="polite">{voiceStateMessage(state)}</p>
    <h3 id="voice-confirmation-title">{slot?question:"실행할까요?"}</h3>
    {!slot&&risky&&<p><strong>{model.slots.place.value}</strong> · {model.slots.action.value}</p>}
    <div className="voice-confirm-actions">
      {slot?<>{value&&<button type="button" className="btn btn-primary" onClick={onConfirm}>맞아요</button>}<button type="button" className="btn btn-outline" onClick={()=>onSpeakSlot(slot)}>{slot==="place"?"다른 장소":"다시 말하기"}</button></>:<button type="button" className="btn btn-primary" onClick={onConfirm}>확인</button>}
      <button type="button" className="voice-confirm-cancel" onClick={onCancel}>취소</button>
    </div>
  </section>;
}
