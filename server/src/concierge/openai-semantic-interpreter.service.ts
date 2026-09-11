import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiUsageLedgerService } from '../admin/ai-usage-ledger.service';
import {
  SemanticInterpretation,
  SemanticInterpretationResult,
} from './semantic-interpreter.types';

const PROMPT = `You interpret a visitor's current utterance for an operational regional concierge.

Understand natural Korean semantically, not by keyword matching.

Your job is only to interpret what the visitor means now.
Do not choose a real facility, canonical entity ID, coordinates, opening hours, route, itinerary, or recommendation.
Do not invent facts.

Important:
- An explicitly named new place normally overrides an older conversational subject.
- Expressions such as "거기", "그곳", "거기서", "아까 그곳" may refer to the previous subject.
- Distinguish a new destination from modification of the previous request.
- "어떻게 가", "가는 길", "가려면" and semantically equivalent expressions indicate navigation.
- If the subject is already known and the visitor asks whether that place has or allows a property or capability, such as vehicle access, parking, accessibility, admission, opening status, or similar place-specific facts, interpret it as INFORMATION rather than NAVIGATION.
- If the visitor asks for another place or facility in relation to the known subject, such as somewhere nearby to eat, drink coffee, stay, shop, or visit, interpret it as PLACE_DISCOVERY even when the utterance is phrased as "is there...?" or another existence question.
- If the visitor rejects or replaces an earlier subject, use relationToPrevious REPLACE.
- subjectText must contain only the place/entity expression actually stated by the visitor, never a canonical database ID.
Return only the supplied schema.`;

const schema:any={
  type:'object',
  additionalProperties:false,
  properties:{
    intent:{type:'string',enum:['VISIT','NAVIGATION','PLACE_DISCOVERY','INFORMATION','REPLAN','IMMEDIATE_NEED','UNKNOWN']},
    subjectText:{type:['string','null']},
    referenceType:{type:'string',enum:['EXPLICIT_ENTITY','PREVIOUS_SUBJECT','CURRENT_LOCATION','NONE']},
    relationToPrevious:{type:'string',enum:['NEW','CONTINUE','REPLACE','MODIFY','NONE']},
    requestedAction:{type:['string','null']},
    categoryHint:{type:['string','null']},
    confidence:{type:'number',minimum:0,maximum:1},
  },
  required:['intent','subjectText','referenceType','relationToPrevious','requestedAction','categoryHint','confidence'],
};

function valid(value:any): value is SemanticInterpretation {
  return Boolean(
    value &&
    ['VISIT','NAVIGATION','PLACE_DISCOVERY','INFORMATION','REPLAN','IMMEDIATE_NEED','UNKNOWN'].includes(value.intent) &&
    ['EXPLICIT_ENTITY','PREVIOUS_SUBJECT','CURRENT_LOCATION','NONE'].includes(value.referenceType) &&
    ['NEW','CONTINUE','REPLACE','MODIFY','NONE'].includes(value.relationToPrevious) &&
    typeof value.confidence==='number'
  );
}

@Injectable()
export class OpenAISemanticInterpreter {
  private readonly callsBySession=new Map<string,number>();

  constructor(private readonly config:ConfigService,@Optional() private readonly aiUsageLedger?:AiUsageLedgerService){}

  async interpret(
    utterance:string,
    previousSubject?:string,
    regionId?:string,
    contextSessionId?:string,
  ):Promise<SemanticInterpretationResult>{
    const started=Date.now();
    const key=this.config.get<string>('OPENAI_API_KEY');
    const model=this.config.get<string>('OPENAI_CONTEXT_MODEL');

    if(!key||!model)
      return {status:'DISABLED',provider:'openai',model,latencyMs:0,errorCode:'NOT_CONFIGURED'};

    const region=regionId||'unknown';
    const session=contextSessionId||'anonymous';
    const regionalSession=`${region}:${session}`;
    const max=Math.max(0,Number(this.config.get('MAX_SEMANTIC_LLM_CALLS_PER_SESSION')??2));
    const count=this.callsBySession.get(regionalSession)||0;

    if(count>=max){
      void this.aiUsageLedger?.record({
        component:'SEMANTIC',
        regionId:region,
        eventType:'BLOCKED',
        reason:'SESSION_LIMIT',
        modelName:model,
      });

      return {
        status:'DISABLED',
        provider:'openai',
        model,
        latencyMs:0,
        errorCode:'SESSION_LIMIT',
      };
    }

    this.callsBySession.set(regionalSession,count+1);

    const controller=new AbortController();
    const timeout=Number(this.config.get('OPENAI_CONTEXT_TIMEOUT_MS')||8000);
    const timer=setTimeout(()=>controller.abort(),timeout);

    try{
      const input=previousSubject
        ? `Previous subject: ${previousSubject}\nCurrent utterance: ${utterance}`
        : `Current utterance: ${utterance}`;

      console.log("[OPENAI_CALL] type=SEMANTIC model=" + model);
      void this.aiUsageLedger?.record({
        component:'SEMANTIC',
        eventType:'CALL',
        modelName:model,
      });
      const response=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',
        headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
        signal:controller.signal,
        body:JSON.stringify({
          model,
          instructions:PROMPT,
          input,
          text:{format:{type:'json_schema',name:'exkovia_semantic_turn',strict:true,schema}},
        }),
      });

      if(!response.ok) {
        void this.aiUsageLedger?.record({
          component:'SEMANTIC',
          eventType:'ERROR',
          modelName:model,
          latencyMs:Date.now()-started,
          errorCode:`HTTP_${response.status}`,
        });
        return {status:'PROVIDER_ERROR',provider:'openai',model,latencyMs:Date.now()-started,errorCode:`HTTP_${response.status}`};
      }

      const body:any=await response.json();
      console.log("[OPENAI_USAGE] type=SEMANTIC model=" + model + " inputTokens=" + (body.usage?.input_tokens ?? 0) + " outputTokens=" + (body.usage?.output_tokens ?? 0));
      void this.aiUsageLedger?.record({
        component:'SEMANTIC',
        eventType:'SUCCESS',
        modelName:model,
        inputTokens:body.usage?.input_tokens ?? 0,
        outputTokens:body.usage?.output_tokens ?? 0,
        latencyMs:Date.now()-started,
      });
      const outputText=body.output_text ||
        body.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==='output_text')?.text;

      const parsed=JSON.parse(outputText);
      return valid(parsed)
        ? {status:'SUCCESS',provider:'openai',model,latencyMs:Date.now()-started,interpretation:parsed}
        : {status:'INVALID',provider:'openai',model,latencyMs:Date.now()-started,errorCode:'SCHEMA_VALIDATION'};
    }catch(error:any){
      void this.aiUsageLedger?.record({
        component:'SEMANTIC',
        eventType:'ERROR',
        modelName:model,
        latencyMs:Date.now()-started,
        errorCode:error?.name||'ERROR',
      });
      return {
        status:error?.name==='AbortError'?'TIMEOUT':'PROVIDER_ERROR',
        provider:'openai',
        model,
        latencyMs:Date.now()-started,
        errorCode:error?.name||'ERROR',
      };
    }finally{
      clearTimeout(timer);
    }
  }
}
