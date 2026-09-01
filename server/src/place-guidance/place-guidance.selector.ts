import type {OperationalTip,OperationalTipTrigger,SelectedPlaceGuidance} from './place-guidance.types';

const minutes=(value?:string)=>{if(!value||!/^\d{2}:\d{2}/.test(value))return undefined;const[h,m]=value.split(':').map(Number);return h*60+m};
const ageMinutes=(observedAt:string,now:Date)=>Math.max(0,(now.getTime()-new Date(observedAt).getTime())/60000);
const tags=(context:any)=>new Set<string>([
  ...((context.companions||[]).flatMap((item:any)=>[
    Number(item.age)>=65?'ELDERLY':undefined,
    Number(item.age)<=12?'CHILD':undefined,
    /가족|family/i.test(item.relationship||'')?'FAMILY':undefined,
  ])),
  ...((context.companionConstraints||[]).map((item:string)=>/노약|어르신|고령/.test(item)?'ELDERLY':/어린|아이|유아/.test(item)?'CHILD':/가족/.test(item)?'FAMILY':undefined)),
].filter(Boolean));
const specificity=(trigger:OperationalTipTrigger)=>Object.values(trigger).filter(value=>Array.isArray(value)?value.length:value!==undefined).length;
const runtimeFor=(entityId:string,context:any)=>context.runtimeStates?.find((item:any)=>item.entityUri===entityId);
const liveWeather=(context:any,tip:OperationalTip,now:Date)=>{
  const observation=context.weatherObservation;
  if(!observation||observation.source!=='OPEN_METEO'||observation.stale===true||observation.status==='STALE'||observation.status==='UNAVAILABLE'||!observation.observedAt)return false;
  return ageMinutes(observation.observedAt,now)<=(tip.maxAgeMinutes??60);
};
function matches(entityId:string,tip:OperationalTip,context:any,now:Date){
  const t=tip.trigger,runtime=runtimeFor(entityId,context),weatherNeeded=Boolean(t.weather||t.temperatureAtMost!==undefined||t.temperatureAtLeast!==undefined||t.windSpeedAtLeast!==undefined);
  if(tip.validFrom&&now<new Date(tip.validFrom)||tip.validUntil&&now>new Date(tip.validUntil))return false;
  if((tip.realtimeRequired||weatherNeeded)&&!liveWeather(context,tip,now)&&weatherNeeded)return false;
  if(t.weather&&!t.weather.includes(context.weatherState||context.weather))return false;
  if(t.temperatureAtMost!==undefined&&!(Number.isFinite(context.temperature)&&context.temperature<=t.temperatureAtMost))return false;
  if(t.temperatureAtLeast!==undefined&&!(Number.isFinite(context.temperature)&&context.temperature>=t.temperatureAtLeast))return false;
  if(t.windSpeedAtLeast!==undefined&&!(Number.isFinite(context.windSpeed)&&context.windSpeed>=t.windSpeedAtLeast))return false;
  if(t.companionTags&&!t.companionTags.some(tag=>tags(context).has(tag)))return false;
  if(t.walkingLevels&&!t.walkingLevels.includes(context.walkingLevel))return false;
  if(t.operatingStates||t.minutesToCloseAtMost!==undefined){
    if(!runtime?.observedAt||ageMinutes(runtime.observedAt,now)>(tip.maxAgeMinutes??30))return false;
    if(t.operatingStates&&!t.operatingStates.includes(runtime.operatingState))return false;
    if(t.minutesToCloseAtMost!==undefined){const current=minutes(context.currentTime),close=minutes(runtime.closingTime);if(current===undefined||close===undefined||close-current<0||close-current>t.minutesToCloseAtMost)return false;}
  }
  return true;
}
export function selectPlaceGuidance(record:any,context:any={},now=new Date()):SelectedPlaceGuidance{
  const applicable=(record.operationalTips||[] as OperationalTip[]).filter((tip:OperationalTip)=>matches(record.entityUri,tip,context,now)).sort((a:OperationalTip,b:OperationalTip)=>b.priority-a.priority||specificity(b.trigger)-specificity(a.trigger)||a.id.localeCompare(b.id));
  const tip=applicable[0],weatherLive=tip&&Boolean(tip.trigger.weather||tip.trigger.temperatureAtMost!==undefined||tip.trigger.temperatureAtLeast!==undefined||tip.trigger.windSpeedAtLeast!==undefined),runtime=tip&&runtimeFor(record.entityUri,context),observedAt=weatherLive?context.weatherObservation?.observedAt:runtime?.observedAt;
  return{shortDescription:record.description,situationalMessage:tip?.message,actionSuggestion:tip?.actionSuggestion,tipId:tip?.id,realtime:Boolean(tip?.realtimeRequired&&observedAt),observedAt,evidenceLabel:weatherLive?context.weatherObservation?.source:runtime?.source};
}
