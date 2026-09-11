import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'ai_usage_events' })
export class AiUsageEvent {
  @Prop({ required: true, index: true })
  occurredAt: Date;

  @Prop({ required: true, index: true })
  component: 'CONTEXT' | 'SEMANTIC';

  @Prop({ index: true, default: 'unknown' })
  regionId: string;

  @Prop({ required: true, index: true })
  eventType: 'CALL' | 'SUCCESS' | 'ERROR' | 'SKIP' | 'BLOCKED';

  @Prop()
  reason?: string;

  @Prop()
  modelName?: string;

  @Prop({ default: 0 })
  inputTokens: number;

  @Prop({ default: 0 })
  outputTokens: number;

  @Prop()
  latencyMs?: number;

  @Prop()
  errorCode?: string;
}

export type AiUsageEventDocument = AiUsageEvent & Document;
export const AiUsageEventSchema = SchemaFactory.createForClass(AiUsageEvent);