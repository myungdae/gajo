import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
export type LifecycleStatus =
  | 'NEW_CANDIDATE'
  | 'NEEDS_VERIFICATION'
  | 'APPROVED'
  | 'ACTIVE'
  | 'CHANGE_DETECTED'
  | 'REJECTED'
  | 'ARCHIVED';
export type VerificationStatus =
  'UNVERIFIED' | 'PARTIAL' | 'VERIFIED' | 'REVERIFY_REQUIRED';
@Schema({ timestamps: true })
export class RegionalDataRecord {
  @Prop({ required: true, unique: true }) id: string;
  @Prop({ required: true, index: true }) canonicalEntityId: string;
  @Prop({ required: true, index: true }) regionId: string;
  @Prop({ required: true }) displayName: string;
  @Prop({ type: [String], default: [] }) aliases: string[];
  @Prop() entityType?: string;
  @Prop() category?: string;
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop() areaLabel?: string;
  @Prop() address?: string;
  @Prop() latitude?: number;
  @Prop() longitude?: number;
  @Prop() phone?: string;
  @Prop() websiteUrl?: string;
  @Prop() reservationUrl?: string;
  @Prop({ type: Object }) operatingHours?: unknown;
  @Prop({ type: Object }) closureDays?: unknown;
  @Prop({ type: Object }) parking?: unknown;
  @Prop({ type: Object }) accessibility?: unknown;
  @Prop({ type: Object }) walkingAccess?: unknown;
  @Prop() shortDescription?: string;
  @Prop({ type: Object, required: true }) source: {
    sourceType: string;
    sourceUrl: string;
    sourceName?: string;
    corroboratingSources?: unknown[];
    verifiedAt?: string;
  };
  @Prop() lastVerifiedAt?: string;
  @Prop({ required: true, default: 'UNVERIFIED' })
  verificationStatus: VerificationStatus;
  @Prop({ required: true, index: true, default: 'NEW_CANDIDATE' })
  lifecycleStatus: LifecycleStatus;
  @Prop({ type: [Object], default: [] }) detectedChanges: Array<{
    field: string;
    previousValue?: unknown;
    newValue?: unknown;
    unsafe?: boolean;
  }>;
  @Prop({ type: [Object], default: [] }) auditTrail: Array<{
    action: string;
    at: string;
    source?: object;
    changes?: unknown;
    actorId?: string;
    regionId?: string;
  }>;
  @Prop({ type: Object }) proposedFacts?: Record<string, unknown>;
  @Prop({ type: Object, default: {} }) fieldEvidence?: Record<
    string,
    {
      current?: unknown;
      proposed?: unknown;
      source: { sourceType: string; sourceUrl: string; sourceName?: string };
      observedAt: string;
      confidence?: string;
      evidenceStatus: string;
      whyReviewNeeded: string;
      status: 'PROPOSED' | 'APPROVED' | 'HELD' | 'REJECTED';
      reviewedAt?: string;
      reviewedBy?: string;
    }
  >;
}
export type RegionalDataRecordDocument = RegionalDataRecord & Document;
export const RegionalDataRecordSchema =
  SchemaFactory.createForClass(RegionalDataRecord);
RegionalDataRecordSchema.index(
  { regionId: 1, canonicalEntityId: 1 },
  { unique: true },
);
