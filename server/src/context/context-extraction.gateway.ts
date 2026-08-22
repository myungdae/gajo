import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONTEXT_EXTRACTOR } from './context-extractor.types';
import type { ContextExtractor, ExtractorResult } from './context-extractor.types';

export type ExtractorInvocationReason='FREE_TEXT_INITIAL'|'FREE_TEXT_FOLLOWUP'|'NOT_REQUIRED';
export interface GatewayRequest {regionId:string;text?:string;sessionId?:string;followup?:boolean}
export interface GatewayResult {result:ExtractorResult;invocationReason:ExtractorInvocationReason;decision:'SKIP_LLM'|'CALL_LLM'|'FALLBACK';duplicate?:boolean;limitReached?:boolean}

@Injectable()
export class ContextExtractionGateway {
  private readonly callsBySession=new Map<string,number>(); private readonly cache=new Map<string,ExtractorResult>();
  private readonly metrics={totalCalls:0,successfulCalls:0,fallbackCalls:0,structuredOnlyRequests:0,duplicateSkips:0,limitSkips:0,inputTokens:0,outputTokens:0};
  constructor(@Inject(CONTEXT_EXTRACTOR) private readonly extractor:ContextExtractor,private readonly config:ConfigService){}
  async extract(request:GatewayRequest):Promise<GatewayResult>{
    const region=request.regionId?.trim();if(!region)throw new Error('regionId is required for context extraction');
    const text=request.text?.trim(); if(!text){this.metrics.structuredOnlyRequests++;return{decision:'SKIP_LLM',invocationReason:'NOT_REQUIRED',result:{status:'DISABLED',provider:'none',latencyMs:0,errorCode:'NOT_REQUIRED'}}}
    const session=request.sessionId||'anonymous', regionalSession=`${region}:${session}`, key=`${regionalSession}:${request.followup?'F':'I'}:${text}`; const cached=this.cache.get(key);
    if(cached){this.metrics.duplicateSkips++;return{decision:'SKIP_LLM',invocationReason:request.followup?'FREE_TEXT_FOLLOWUP':'FREE_TEXT_INITIAL',result:cached,duplicate:true}}
    const max=Math.max(0,Number(this.config.get('MAX_CONTEXT_LLM_CALLS_PER_SESSION')??3)), count=this.callsBySession.get(regionalSession)||0;
    if(count>=max){this.metrics.limitSkips++;this.metrics.fallbackCalls++;return{decision:'FALLBACK',invocationReason:request.followup?'FREE_TEXT_FOLLOWUP':'FREE_TEXT_INITIAL',limitReached:true,result:{status:'DISABLED',provider:'gateway',latencyMs:0,errorCode:'SESSION_LIMIT'}}}
    this.callsBySession.set(regionalSession,count+1);this.metrics.totalCalls++;const result=await this.extractor.extract(text);this.cache.set(key,result);
    if(result.status==='SUCCESS')this.metrics.successfulCalls++;else this.metrics.fallbackCalls++;
    this.metrics.inputTokens+=result.usage?.inputTokens||0;this.metrics.outputTokens+=result.usage?.outputTokens||0;
    return{decision:result.status==='SUCCESS'?'CALL_LLM':'FALLBACK',invocationReason:request.followup?'FREE_TEXT_FOLLOWUP':'FREE_TEXT_INITIAL',result};
  }
  stats(){const inputRaw=this.config.get<string>('OPENAI_CONTEXT_INPUT_USD_PER_MILLION_TOKENS'),outputRaw=this.config.get<string>('OPENAI_CONTEXT_OUTPUT_USD_PER_MILLION_TOKENS');const inputRate=Number(inputRaw),outputRate=Number(outputRaw);const estimatedCostUsd=inputRaw&&outputRaw&&Number.isFinite(inputRate)&&Number.isFinite(outputRate)?(this.metrics.inputTokens*inputRate+this.metrics.outputTokens*outputRate)/1_000_000:undefined;return{...this.metrics,estimatedCostUsd,activeSessions:this.callsBySession.size,maxCallsPerSession:Number(this.config.get('MAX_CONTEXT_LLM_CALLS_PER_SESSION')??3)};}
}
