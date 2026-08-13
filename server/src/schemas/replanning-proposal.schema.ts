import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReplanningProposalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

@Schema({ timestamps: true })
export class ReplanningProposal {
  @Prop({ required: true, unique: true }) proposalNo: string;
  @Prop({ required: true }) itineraryNo: string;
  @Prop({ required: true }) previousContextNo: string;
  @Prop({ required: true }) currentContextNo: string;
  @Prop({ required: true, default: 'PENDING_APPROVAL' }) status: ReplanningProposalStatus;
  @Prop({ type: Object, required: true }) triggerEvent: Record<string, any>;
  @Prop({ type: [Object], default: [] }) impacts: Record<string, any>[];
  @Prop({ type: [Object], default: [] }) preservedHistory: Record<string, any>[];
  @Prop({ type: [Object], default: [] }) proposedFutureSteps: Record<string, any>[];
  @Prop({ type: [Object], default: [] }) removedItems: Record<string, any>[];
  @Prop({ type: [Object], default: [] }) proposedNewItems: Record<string, any>[];
  @Prop({ type: [Object], default: [] }) candidateDiagnostics: Record<string, any>[];
  @Prop() explanation: string;
  @Prop({ type: [Object], default: [] }) evidence: Record<string, any>[];
  @Prop({ required: true }) generatedAt: string;
  @Prop({ required: true }) suppressionKey: string;
}

export type ReplanningProposalDocument = ReplanningProposal & Document;
export const ReplanningProposalSchema = SchemaFactory.createForClass(ReplanningProposal);
