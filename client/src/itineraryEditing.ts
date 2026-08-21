import { canonicalEntityId } from "./recommendationItem.ts";
import { itinerarySteps } from "./journeyExecution.ts";
import { loadTripSession, saveTripSession, type TripSession } from "./tripSession.ts";

export type ItineraryEdit =
  | { type: "REPLACE"; replacement: any }
  | { type: "DELETE" }
  | { type: "MOVE"; direction: "UP" | "DOWN" }
  | { type: "TIME"; scheduledTime: string };
export type ItineraryEditResult={status:"updated"|"blocked"|"not-found"|"invalid";session?:TripSession;reason?:string};

const reorder=(steps:any[])=>steps.map((step,index)=>({...step,order:index+1}));
export function editItineraryItem(regionId:string,entityId:string,edit:ItineraryEdit,storage:Pick<Storage,"getItem"|"setItem">=localStorage):ItineraryEditResult{
  const session=loadTripSession(storage,regionId);
  if(!session||session.regionId!==regionId)return{status:"not-found"};
  const steps=itinerarySteps(session.itinerary),index=steps.findIndex(step=>canonicalEntityId(step)===entityId);
  if(index<0)return{status:"not-found"};
  const selected=steps[index];
  if(selected.status==="COMPLETED")return{status:"blocked",reason:"완료한 일정은 방문 기록을 보호하기 위해 수정할 수 없습니다."};
  let nextSteps=[...steps],replacementId:string|undefined;
  if(edit.type==="REPLACE"){
    replacementId=canonicalEntityId(edit.replacement);
    if(!replacementId||edit.replacement.regionId!==regionId||edit.replacement.operationalEvidence?.tripEligible===false)return{status:"invalid"};
    if(steps.some((step,i)=>i!==index&&canonicalEntityId(step)===replacementId))return{status:"invalid"};
    nextSteps[index]={...edit.replacement,entityId:replacementId,regionId,status:selected.status||"PLANNED",order:selected.order,dayIndex:selected.dayIndex,scheduledTime:selected.scheduledTime};
  }else if(edit.type==="DELETE")nextSteps.splice(index,1);
  else if(edit.type==="MOVE"){
    const target=edit.direction==="UP"?index-1:index+1;
    if(target<0||target>=steps.length||steps[target].status==="COMPLETED")return{status:"blocked",reason:"완료한 일정의 순서는 변경할 수 없습니다."};
    [nextSteps[index],nextSteps[target]]=[nextSteps[target],nextSteps[index]];
  }else nextSteps[index]={...selected,scheduledTime:edit.scheduledTime||undefined};
  nextSteps=reorder(nextSteps);
  const statuses={...(session.execution?.statusByEntityId||{})};
  const oldStatus=statuses[entityId];delete statuses[entityId];
  if(replacementId&&oldStatus)statuses[replacementId]=oldStatus;
  let current=session.execution?.currentEntityId;
  if(current===entityId){
    if(replacementId)current=replacementId;
    else current=canonicalEntityId(nextSteps[Math.min(index,nextSteps.length-1)])||undefined;
  }
  const updated=saveTripSession({...session,itinerary:{...((session.itinerary as object)||{}),steps:nextSteps},execution:{...session.execution,currentEntityId:current,statusByEntityId:statuses}},storage);
  return{status:"updated",session:updated};
}

export function replacementCandidate(facility:any,regionId:string){
  const entityId=facility.uri||facility.entityId,verification=facility.masterData?.verificationStatus;
  if(!entityId||!facility.label||!['VERIFIED','PARTIAL'].includes(verification))return undefined;
  const actions=facility.literalProps?.actions||{};
  return{entityId,entityUri:entityId,programUri:entityId,facilityUri:entityId,programLabel:facility.label,facilityLabel:facility.label,label:facility.label,regionId,entityType:facility.literalProps?.category,category:facility.literalProps?.category,description:facility.comment,address:facility.literalProps?.address,telephone:facility.literalProps?.telephone,website:facility.literalProps?.website,latitude:facility.literalProps?.latitude,longitude:facility.literalProps?.longitude,actions,operationalEvidence:{source:'RDM',verificationStatus:verification,tripEligible:true,navigationAvailable:Boolean(actions.navigate)}};
}
