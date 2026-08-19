export type RegionalReviewAction=readonly[action:string,label:string];
export function reviewActionsFor(status:string):RegionalReviewAction[]{
  if(status==='CHANGE_DETECTED')return[['APPLY_CHANGE','변경 반영'],['HOLD','추가 확인 필요'],['APPROVE_EDITED','수정 후 승인'],['IGNORE_CHANGE','변경 무시'],['REJECT','거절']];
  if(status==='ACTIVE')return[['REVERIFY','재검증 필요'],['STOP','운영 중지']];
  return[['APPROVE','승인'],['HOLD','보류'],['APPROVE_EDITED','수정 후 승인'],['REJECT','거절']];
}
export function regionalReviewView(record:any){
  return{open:Boolean(record),staged:record?.lifecycleStatus==='NEEDS_VERIFICATION',lifecycleStatus:record?.lifecycleStatus,verificationStatus:record?.verificationStatus,current:record||{},proposed:record?.proposedFacts||{},actions:record?reviewActionsFor(record.lifecycleStatus):[]};
}
