import { ParsedNaturalLanguageContext } from './natural-language-context.parser';
import { ContextExtraction, ExtractorResult } from './context-extractor.types';

export interface ExtractionResolution { field:string; finalValue:unknown; deterministicValue?:unknown; llmValue?:unknown; confidence?:number; evidenceText?:string; resolution:'USER_SELECTION_WINS'|'DETERMINISTIC'|'LLM'|'AGREED'|'DETERMINISTIC_WINS'|'UNRESOLVED' }
export interface MergedExtraction {
  companions: {age?:number;relationship?:string;healthConditions:string[]}[]; conditions:string[]; transportMode?:string; stayUntil?:string; walkingLevel?:string;
  companionConstraints:string[]; wellnessGoals:string[]; stayUntilPeriod?:string; intent?:string; needsClarification:boolean; clarificationReason?:string; suggestedQuestion?:string;
  activityPreferences:string[];
  diagnostics: ExtractionResolution[]; extractor: Omit<ExtractorResult,'extraction'>;
}
// Only promote an extractor preference into wellnessGoals when an exact
// gajo:WellnessGoal individual exists. Other controlled preferences remain
// activityPreferences until a canonical ontology mapping is defined.
const preferenceGoal:Record<string,string>={REST_AND_RECOVERY:'restAndRecovery'};

function resolve<T>(field:string, deterministic:T|undefined, llmFact:any, diagnostics:ExtractionResolution[]):T|undefined {
  const llm=llmFact?.value as T|undefined;
  if(deterministic!==undefined){const agreed=JSON.stringify(deterministic)===JSON.stringify(llm);diagnostics.push({field,finalValue:deterministic,deterministicValue:deterministic,llmValue:llm,confidence:llmFact?.confidence,evidenceText:llmFact?.sourceText,resolution:llm===undefined?'DETERMINISTIC':agreed?'AGREED':'DETERMINISTIC_WINS'});return deterministic;}
  if(llm!==undefined){diagnostics.push({field,finalValue:llm,llmValue:llm,confidence:llmFact.confidence,evidenceText:llmFact.sourceText,resolution:'LLM'});return llm;}
  return undefined;
}

export function mergeContextExtractions(d:ParsedNaturalLanguageContext,result:ExtractorResult):MergedExtraction {
  const llm:ContextExtraction=result.status==='SUCCESS'&&result.extraction?result.extraction:{}; const diagnostics:ExtractionResolution[]=[];
  const llmCompanions=(llm.companions||[]).map(c=>({age:c.age?.value,relationship:c.relationship?.value,healthConditions:[]}));
  const companionConfidences=(llm.companions||[]).flatMap(c=>[c.age?.confidence,c.relationship?.confidence,c.count?.confidence].filter((v):v is number=>v!==undefined));
  const companions=resolve('companions',d.companions.length?d.companions:undefined,llmCompanions.length?{value:llmCompanions,confidence:companionConfidences.length?Math.min(...companionConfidences):0,sourceText:(llm.companions||[]).map(c=>c.age?.sourceText||c.relationship?.sourceText||c.count?.sourceText).filter(Boolean).join(' / ')}:undefined,diagnostics)||[];
  const conditions=[...new Set([...(d.conditions||[]),...(llm.healthConditions?.value||[])])];
  const mobility=[...new Set([...(d.companionConstraints||[]),...(llm.mobilityConstraints?.value||[]),...(llm.preferences?.value.includes('LOW_WALKING')?['shortWalkingDistance']:[])])];
  const llmPreferences=llm.preferences?.value||[];const activityPreferences=[...new Set([...(d.activityPreferences||[]),...llmPreferences.filter(p=>['HOT_SPRING','FOOD','CAFE','NATURE','INDOOR','OUTDOOR'].includes(p))])];
  const goals=[...(d.wellnessGoal?[d.wellnessGoal]:[]),...llmPreferences.map(p=>preferenceGoal[p]).filter(Boolean)];
  return {companions,conditions,transportMode:resolve('transportMode',d.transportMode,llm.transportMode,diagnostics),stayUntil:resolve('stayUntil',d.stayUntil,llm.stayUntilExact,diagnostics),walkingLevel:resolve('walkingLevel',d.walkingLevel,llm.walkingLevel,diagnostics),companionConstraints:[...new Set(mobility)],wellnessGoals:[...new Set(goals)],activityPreferences,stayUntilPeriod:llm.stayUntilPeriod?.value,intent:llm.intent?.value,needsClarification:Boolean(llm.needsClarification),clarificationReason:llm.clarificationReason,suggestedQuestion:llm.suggestedQuestion,diagnostics,extractor:{status:result.status,provider:result.provider,model:result.model,latencyMs:result.latencyMs,errorCode:result.errorCode}};
}
