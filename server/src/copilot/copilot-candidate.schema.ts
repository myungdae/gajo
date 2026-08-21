import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CopilotCandidateStatus = 'DISCOVERED'|'CANDIDATE'|'REVIEW'|'NEEDS_MORE_EVIDENCE'|'VERIFIED'|'ACTIVE'|'REJECTED';
@Schema({ timestamps: true })
export class CopilotCandidate {
  @Prop({ required: true, unique: true }) id: string;
  @Prop({ required: true, index: true }) regionId: string;
  @Prop({ required: true, index: true }) fingerprint: string;
  @Prop({ required: true }) displayName: string;
  @Prop({ required: true }) category: string;
  @Prop() entityType?: string;
  @Prop() address?: string;
  @Prop() phone?: string;
  @Prop() latitude?: number;
  @Prop() longitude?: number;
  @Prop({ type: Object, required: true }) provenance: Record<string, unknown>;
  @Prop({ type: Object, required: true }) evidence: Record<string, unknown>;
  @Prop({ required: true, default: 'DISCOVERED', index: true }) status: CopilotCandidateStatus;
  @Prop({ type: [Object], default: [] }) auditTrail: Array<Record<string, unknown>>;
  @Prop() activatedEntityId?: string;
}
export type CopilotCandidateDocument = CopilotCandidate & Document;
export const CopilotCandidateSchema = SchemaFactory.createForClass(CopilotCandidate);
CopilotCandidateSchema.index({ regionId: 1, fingerprint: 1 }, { unique: true });
