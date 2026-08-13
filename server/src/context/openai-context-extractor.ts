import { ConfigService } from '@nestjs/config';
import { ContextExtractor, ExtractorResult } from './context-extractor.types';
import { validateContextExtraction } from './context-extraction.validator';

export const CONTEXT_EXTRACTION_PROMPT_VERSION = 'gajo-context-v1';
const SYSTEM_PROMPT = `You are a structured context extraction component for a Korean visitor concierge.
Extract only facts explicitly stated or strongly semantically entailed by the utterance. Never choose facilities, recommend programs, order an itinerary, make runtime decisions, or invent missing facts. UNKNOWN/null must remain unknown. Never convert vague periods such as "저녁쯤" into an exact time. Set needsClarification only when a missing value materially prevents a useful or safe operational decision; do not ask merely because a field is unknown. Evidence sourceText must be a short exact span from the utterance. Return only the supplied schema.`;

const fact = (value:any) => ({ type:'object', properties:{ value, confidence:{type:'number',minimum:0,maximum:1}, sourceText:{type:'string'} }, required:['value','confidence','sourceText'], additionalProperties:false });
const nullable = (schema:any) => ({ anyOf:[schema,{type:'null'}] });
const schema:any = { type:'object', additionalProperties:false, properties:{
  companions:{type:'array',items:{type:'object',additionalProperties:false,properties:{relationship:nullable(fact({type:'string',enum:['mother','father','parent','spouse','other']})),age:nullable(fact({type:'integer',minimum:0,maximum:120})),count:nullable(fact({type:'integer',minimum:1,maximum:20}))},required:['relationship','age','count']}},
  healthConditions:nullable(fact({type:'array',items:{type:'string',enum:['kneePain','limitedMobility','fatigue','hypertensionConcern']}})),
  walkingLevel:nullable(fact({type:'string',enum:['LOW','MODERATE','HIGH']})), mobilityConstraints:nullable(fact({type:'array',items:{type:'string',enum:['shortWalkingDistance','limitedMobility']}})),
  transportMode:nullable(fact({type:'string',enum:['CAR','WALK','PUBLIC_TRANSPORT','UNKNOWN']})), stayUntilExact:nullable(fact({type:'string',pattern:'^([01]\\d|2[0-3]):[0-5]\\d$'})), stayUntilPeriod:nullable(fact({type:'string',enum:['MORNING','AFTERNOON','EVENING','NIGHT']})),
  preferences:nullable(fact({type:'array',items:{type:'string',enum:['REST_AND_RECOVERY','LOW_WALKING','FOOD','CAFE','NATURE','HOT_SPRING','INDOOR','OUTDOOR']}})), intent:nullable(fact({type:'string',enum:['ITINERARY_REQUEST','NEARBY_DISCOVERY','FOLLOW_UP_MODIFICATION','INFORMATION_REQUEST','UNKNOWN']})),
  needsClarification:{type:'boolean'},clarificationReason:{type:['string','null']},suggestedQuestion:{type:['string','null']},
},required:['companions','healthConditions','walkingLevel','mobilityConstraints','transportMode','stayUntilExact','stayUntilPeriod','preferences','intent','needsClarification','clarificationReason','suggestedQuestion']};

export class OpenAIContextExtractor implements ContextExtractor {
  constructor(private readonly config: ConfigService) {}
  async extract(text: string): Promise<ExtractorResult> {
    const started=Date.now(), key=this.config.get<string>('OPENAI_API_KEY'), model=this.config.get<string>('OPENAI_CONTEXT_MODEL');
    if (!key || !model) return {status:'DISABLED',provider:'openai',model,latencyMs:0,errorCode:'NOT_CONFIGURED'};
    const controller=new AbortController(); const timeout=Number(this.config.get('OPENAI_CONTEXT_TIMEOUT_MS')||8000); const timer=setTimeout(()=>controller.abort(),timeout);
    try {
      const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model,instructions:SYSTEM_PROMPT,input:text,text:{format:{type:'json_schema',name:'gajo_context_extraction',strict:true,schema}}})});
      if(!response.ok)return {status:'PROVIDER_ERROR',provider:'openai',model,latencyMs:Date.now()-started,errorCode:`HTTP_${response.status}`};
      const body:any=await response.json(); const outputText=body.output_text || body.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==='output_text')?.text;
      const validated=validateContextExtraction(JSON.parse(outputText));
      return validated?{status:'SUCCESS',provider:'openai',model,latencyMs:Date.now()-started,extraction:validated,usage:{inputTokens:body.usage?.input_tokens,outputTokens:body.usage?.output_tokens}}:{status:'INVALID',provider:'openai',model,latencyMs:Date.now()-started,errorCode:'SCHEMA_VALIDATION'};
    } catch(error:any) { return {status:error?.name==='AbortError'?'TIMEOUT':'PROVIDER_ERROR',provider:'openai',model,latencyMs:Date.now()-started,errorCode:error?.name||'ERROR'}; }
    finally { clearTimeout(timer); }
  }
}
