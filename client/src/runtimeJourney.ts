import type { CreateContextInput } from './api/client.ts';
import { canonicalEntityId } from './recommendationItem.ts';
import { loadTripSession, saveTripSession, type PlannedContext } from './tripSession.ts';
export const RUNTIME_JOURNEY_NAME={ko:'지금 나에게 맞는 여행',en:'Runtime-Adaptive Regional Journey'} as const;
export type JourneyGoal='FOOD'|'CAFE'|'ACCOMMODATION'|'NEXT_PLACE'|'EVENT_TODAY';
export type JourneyPreferences={goal?:JourneyGoal;companion?:'ALONE'|'COUPLE'|'CHILDREN'|'PARENTS'|'FRIENDS';duration?:'ONE_HOUR'|'TWO_THREE_HOURS'|'HALF_DAY'|'DAY';transport?:'CAR'|'WALK'|'PUBLIC_TRANSPORT';walking?:'ANY'|'LOW'|'EASY'};
export const JOURNEY_COPY={ko:{question:'지금 무엇을 하고 싶으세요?',auto:'현재 위치와 날씨는 확인된 경우에만 자동으로 반영합니다.',conditions:'내 여행에 맞게 더 알려주세요',durationQuestion:'오늘 여행할 시간이 얼마나 있으신가요?',create:'내 여정 만들기',direct:'원하는 것을 말하거나 글로 알려주세요',startQuestion:'이 여정으로 출발할까요?',start:'이대로 시작',adjust:'조금 바꾸기',other:'다른 요청하기',speak:'말하기',type:'글로 입력하기',unknown:'확인하지 못한 정보는 판단에서 제외합니다.'},en:{question:'What would you like to do?',auto:'Your location and weather are used automatically only when verified.',conditions:'Add travel preferences',durationQuestion:'How much time do you have for today\'s trip?',create:'Create My Journey',direct:'Speak or type a request',startQuestion:'Shall we start this journey?',start:'Start This Journey',adjust:'Make a Small Change',other:'Make Another Request',speak:'Speak',type:'Type',unknown:'Information we could not verify is left out.'}} as const;
export const JOURNEY_OPTIONS={goal:[['FOOD','맛있는 곳 찾기','Find Food'],['CAFE','카페에서 쉬기','Rest at a Café'],['ACCOMMODATION','숙소 찾기','Find Lodging'],['NEXT_PLACE','다음에 갈 곳 찾기','Find the Next Place'],['EVENT_TODAY','오늘 행사·축제 찾기','Find Today\'s Events']],companion:[['ALONE','혼자','Solo'],['COUPLE','연인','Partner'],['CHILDREN','아이와','With Children'],['PARENTS','부모님과','With Parents'],['FRIENDS','친구와','With Friends']],duration:[['ONE_HOUR','1시간','1 Hour'],['TWO_THREE_HOURS','2~3시간','2–3 Hours'],['HALF_DAY','반나절','Half Day'],['DAY','하루','Full Day']],transport:[['CAR','자동차','Car'],['WALK','도보','Walking'],['PUBLIC_TRANSPORT','대중교통','Public Transit']],walking:[['ANY','걷는 것은 괜찮아요','No Walking Difficulty'],['LOW','많이 걷기는 어려워요','Minimal Walking'],['EASY','천천히 쉬면서 걸을게요','Easy Pace']]} as const;
export function runtimeJourneySteps(recommendation:any):any[]{const steps=recommendation?.itinerary?.steps??recommendation?.steps;return Array.isArray(steps)?steps.filter(step=>Boolean(canonicalEntityId(step))):[]}
export function journeyRequest(p:JourneyPreferences,language:'ko'|'en'):{text:string;context:CreateContextInput;planned:PlannedContext}{
  const label=(key:keyof typeof JOURNEY_OPTIONS,value?:string)=>JOURNEY_OPTIONS[key].find(row=>row[0]===value)?.[language==='ko'?1:2];
  const companion=p.companion&&p.companion!=='ALONE'?[{relationship:({COUPLE:'partner',CHILDREN:'child',PARENTS:'parent',FRIENDS:'friend'} as any)[p.companion],healthConditions:[]}]:undefined;
  const walkingLevel=p.walking==='LOW'||p.walking==='EASY'?'LOW':undefined, constraints=p.walking==='LOW'?['shortWalkingDistance']:p.walking==='EASY'?['easyPace']:undefined;
  const context:CreateContextInput={inputMode:'STRUCTURED',activityPreferences:p.goal?[p.goal]:undefined,companions:companion,companionConstraints:constraints,walkingLevel,transportMode:p.transport};
  const values=[label('goal',p.goal),label('companion',p.companion),label('duration',p.duration),label('transport',p.transport),label('walking',p.walking)].filter(Boolean);
  return {text:language==='ko'?`${values.join(', ')||'현재 상황'}에 맞는 순서 있는 지역여정을 만들어 주세요.`:`Create an ordered regional journey for ${values.join(', ')||'my current context'}.`,context,planned:{duration:p.duration==='DAY'?'DAY':undefined,companions:companion,mobilityConstraints:constraints,walkingLevel,transportMode:p.transport,interests:p.goal?[p.goal]:undefined}};
}
export function startRuntimeJourney(regionId:string,recommendation:any,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){
  const current=loadTripSession(storage,regionId),steps=runtimeJourneySteps(recommendation),itinerary=recommendation?.itinerary||recommendation;
  if(!current||!steps.length)return undefined;
  const normalized=steps.map((step:any,index:number)=>({...step,entityId:canonicalEntityId(step),regionId:step.regionId||regionId,order:step.order||index+1,status:index===0?'EN_ROUTE':'PLANNED'}));
  if(normalized.some((step:any)=>!step.entityId||step.regionId!==regionId))return undefined;
  const first=normalized[0].entityId,statusByEntityId=Object.fromEntries(normalized.map((step:any,index:number)=>[step.entityId,index===0?'EN_ROUTE':'PLANNED']));
  return saveTripSession({...current,itinerary:{...itinerary,regionId,steps:normalized,savedAsFullJourney:true,journeyId:itinerary.journeyId||itinerary.itineraryNo||crypto.randomUUID()},execution:{...current.execution,currentEntityId:first,statusByEntityId}},storage);
}
export const runtimeIntroKey='exkovia:runtime-adaptive-regional-journey:intro:v1';
export function runtimeIntroSeen(storage:Pick<Storage,'getItem'>=localStorage){try{return storage.getItem(runtimeIntroKey)==='seen'}catch{return false}}
export function rememberRuntimeIntro(storage:Pick<Storage,'setItem'>=localStorage){try{storage.setItem(runtimeIntroKey,'seen')}catch{/* Optional storage. */}}
