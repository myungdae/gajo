export interface PlaceGuidanceView {
  shortDescription?:string;
  situationalMessage?:string;
  actionSuggestion?:string;
  realtime?:boolean;
  observedAt?:string;
  evidenceLabel?:string;
}

function observationLabel(value?:string){
  if(!value)return undefined;
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return undefined;
  return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
}

export default function PlaceGuidanceSummary({guidance}:{guidance?:PlaceGuidanceView}){
  if(!guidance?.shortDescription&&!guidance?.situationalMessage&&!guidance?.actionSuggestion)return null;
  const basis=guidance.realtime?observationLabel(guidance.observedAt):undefined;
  return <div className="place-guidance" aria-label="장소 안내">
    {guidance.shortDescription&&<p className="place-guidance-description">{guidance.shortDescription}</p>}
    {(guidance.situationalMessage||guidance.actionSuggestion)&&<p className="place-guidance-tip"><span>{[guidance.situationalMessage,guidance.actionSuggestion].filter(Boolean).join(' ')}</span>{basis&&<small>{basis} 기준{guidance.evidenceLabel?` · ${guidance.evidenceLabel}`:''}</small>}</p>}
  </div>;
}
