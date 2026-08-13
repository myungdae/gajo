import type { CreateContextInput } from '../api/client';

export function buildStructuredContext(values:Record<string,string>,age:string,time:string,selectedPreferences:string[]):CreateContextInput{
  const companion=values.companion;
  const companions=companion&&companion!=='alone'?[{relationship:companion==='parents'?'parent':companion==='couple'?'spouse':companion==='children'?'child':'family',age:companion==='parents'&&age?Number(age):undefined,healthConditions:[]}]:undefined;
  const walkingLevel=values.walking==='LIMITED'?'LOW':values.walking as CreateContextInput['walkingLevel'];
  const companionConstraints=[...(values.walking==='LIMITED'?['limitedMobility']:[]),...(values.walking==='LOW'||values.walking==='LIMITED'?['shortWalkingDistance']:[])];
  const preferenceGoals=selectedPreferences.flatMap(value=>value==='FOOD'?['antiAgingWellness']:value==='NATURE'?['stressRelief']:['REST_AND_RECOVERY','HOT_SPRING','CAFE','INDOOR'].includes(value)?['restAndRecovery']:[]);
  const wellnessGoals=[...new Set([...preferenceGoals,...(companion==='parents'?['seniorFriendlyTrip']:companion&&companion!=='alone'?['familyHealingTrip']:[])])];
  return{inputMode:'STRUCTURED',transportMode:values.transport as CreateContextInput['transportMode'],walkingLevel,stayUntil:time||undefined,companions,companionConstraints,wellnessGoals,activityPreferences:selectedPreferences};
}
