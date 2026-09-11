import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiUsageEvent, AiUsageEventDocument } from '../schemas/ai-usage-event.schema';

export type AiUsageComponent = 'CONTEXT' | 'SEMANTIC';
export type AiUsageEventType = 'CALL' | 'SUCCESS' | 'ERROR' | 'SKIP' | 'BLOCKED';

@Injectable()
export class AiUsageLedgerService {
  constructor(
    @InjectModel(AiUsageEvent.name)
    private readonly model: Model<AiUsageEventDocument>,
  ) {}

  async record(input:{
    component:AiUsageComponent;
    regionId?:string;
    eventType:AiUsageEventType;
    reason?:string;
    modelName?:string;
    inputTokens?:number;
    outputTokens?:number;
    latencyMs?:number;
    errorCode?:string;
  }) {
    try {
      await this.model.create({
        occurredAt:new Date(),
        component:input.component,
        regionId:input.regionId||'unknown',
        eventType:input.eventType,
        reason:input.reason,
        modelName:input.modelName,
        inputTokens:input.inputTokens||0,
        outputTokens:input.outputTokens||0,
        latencyMs:input.latencyMs,
        errorCode:input.errorCode,
      });
    } catch {
      // Usage accounting must never break the concierge request path.
    }
  }

  async summary() {
    const now=new Date();
    const today=new Date(now);
    today.setHours(0,0,0,0);

    const sevenDays=new Date(today);
    sevenDays.setDate(sevenDays.getDate()-6);

    const month=new Date(now.getFullYear(),now.getMonth(),1);

    const summarize=async(start:Date)=>{
      const rows=await this.model.aggregate([
        {$match:{occurredAt:{$gte:start}}},
        {$group:{
          _id:null,
          calls:{$sum:{$cond:[{$eq:['$eventType','CALL']},1,0]}},
          successes:{$sum:{$cond:[{$eq:['$eventType','SUCCESS']},1,0]}},
          errors:{$sum:{$cond:[{$eq:['$eventType','ERROR']},1,0]}},
          skips:{$sum:{$cond:[{$eq:['$eventType','SKIP']},1,0]}},
          blocked:{$sum:{$cond:[{$eq:['$eventType','BLOCKED']},1,0]}},
          inputTokens:{$sum:'$inputTokens'},
          outputTokens:{$sum:'$outputTokens'},
        }}
      ]);

      return rows[0]||{
        calls:0,successes:0,errors:0,skips:0,blocked:0,
        inputTokens:0,outputTokens:0
      };
    };

    const [todaySummary,sevenDaySummary,monthSummary,byRegion]=await Promise.all([
      summarize(today),
      summarize(sevenDays),
      summarize(month),
      this.model.aggregate([
        {$match:{occurredAt:{$gte:month}}},
        {$group:{
          _id:'$regionId',
          calls:{$sum:{$cond:[{$eq:['$eventType','CALL']},1,0]}},
          successes:{$sum:{$cond:[{$eq:['$eventType','SUCCESS']},1,0]}},
          errors:{$sum:{$cond:[{$eq:['$eventType','ERROR']},1,0]}},
          skips:{$sum:{$cond:[{$eq:['$eventType','SKIP']},1,0]}},
          blocked:{$sum:{$cond:[{$eq:['$eventType','BLOCKED']},1,0]}},
          inputTokens:{$sum:'$inputTokens'},
          outputTokens:{$sum:'$outputTokens'},
        }},
        {$sort:{calls:-1,_id:1}}
      ]),
    ]);

    return {
      generatedAt:now.toISOString(),
      today:todaySummary,
      last7Days:sevenDaySummary,
      month:monthSummary,
      byRegion:byRegion.map((row:any)=>({
        regionId:row._id||'unknown',
        calls:row.calls||0,
        successes:row.successes||0,
        errors:row.errors||0,
        skips:row.skips||0,
        blocked:row.blocked||0,
        inputTokens:row.inputTokens||0,
        outputTokens:row.outputTokens||0,
      })),
    };
  }
}