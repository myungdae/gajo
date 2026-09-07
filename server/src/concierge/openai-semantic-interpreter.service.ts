import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  constructor(private readonly config:ConfigService){}

  async interpret(
    utterance:string,
    previousSubject?:string,
  ):Promise<SemanticInterpretationResult>{
    const started=Date.now();
    const key=this.config.get<string>('OPENAI_API_KEY');
    const model=this.config.get<string>('OPENAI_CONTEXT_MODEL');

    if(!key||!model)
      return {status:'DISABLED',provider:'openai',model,latencyMs:0,errorCode:'NOT_CONFIGURED'};

    const controller=new AbortController();
    const timeout=Number(this.config.get('OPENAI_CONTEXT_TIMEOUT_MS')||8000);
    const timer=setTimeout(()=>controller.abort(),timeout);

    try{
      const input=previousSubject
        ? `Previous subject: ${previousSubject}\nCurrent utterance: ${utterance}`
        : `Current utterance: ${utterance}`;

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

      if(!response.ok)
        return {status:'PROVIDER_ERROR',provider:'openai',model,latencyMs:Date.now()-started,errorCode:`HTTP_${response.status}`};

      const body:any=await response.json();
      const outputText=body.output_text ||
        body.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==='output_text')?.text;

      const parsed=JSON.parse(outputText);
      return valid(parsed)
        ? {status:'SUCCESS',provider:'openai',model,latencyMs:Date.now()-started,interpretation:parsed}
        : {status:'INVALID',provider:'openai',model,latencyMs:Date.now()-started,errorCode:'SCHEMA_VALIDATION'};
    }catch(error:any){
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
