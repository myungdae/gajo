import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * One row per Agent execution step during AgentOrchestratorService's run of
 * a gajo:ConciergeOperation. Powers the "used agents" trace shown in the
 * chat UI's explanation panel and the Admin Dashboard's execution log view.
 */
@Schema({ timestamps: true })
export class ExecutionLog {
  @Prop({ required: true })
  runtimeContextId: string;

  @Prop({ required: true })
  operationUri: string;

  @Prop({ required: true })
  taskUri: string;

  @Prop()
  taskLabel?: string;

  @Prop({ required: true })
  agentUri: string;

  @Prop()
  agentLabel?: string;

  @Prop({ type: [String], default: [] })
  toolsUsed: string[];

  @Prop({ default: 'completed', enum: ['completed', 'failed', 'skipped'] })
  status: string;

  @Prop({ type: Object, default: {} })
  output: Record<string, any>;

  @Prop()
  durationMs?: number;
}

export type ExecutionLogDocument = ExecutionLog & Document;
export const ExecutionLogSchema = SchemaFactory.createForClass(ExecutionLog);
