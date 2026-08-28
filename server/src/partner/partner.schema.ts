import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PartnerStatus =
  | 'DRAFT'
  | 'APPLICATION_RECEIVED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'AI_REGISTERED'
  | 'QR_ISSUED'
  | 'OPERATING'
  | 'PAUSED'
  | 'ENDED'
  | 'REVERIFY_REQUIRED';
export type ApprovalStatus =
  'PENDING' | 'APPROVED' | 'REJECTED' | 'REVERIFY_REQUIRED';

@Schema({ timestamps: true })
export class Partner {
  @Prop({ required: true, unique: true, index: true }) partnerId: string;
  @Prop({ required: true, index: true }) canonicalEntityId: string;
  @Prop({ required: true, index: true }) regionId: string;
  @Prop({ required: true, unique: true, index: true }) partnerSlug: string;
  @Prop({ required: true }) displayName: string;
  @Prop() category?: string;
  @Prop() address?: string;
  @Prop() phone?: string;
  @Prop({ type: Object }) operatingHours?: unknown;
  @Prop() description?: string;
  @Prop() representativeImageUrl?: string;
  @Prop({ type: Object, default: {} }) reviewOnly?: Record<string, unknown>;
  @Prop({ required: true, index: true, default: 'APPLICATION_RECEIVED' })
  status: PartnerStatus;
  @Prop({ required: true, default: 'INACTIVE' }) qrStatus:
    'INACTIVE' | 'ISSUED' | 'ACTIVE' | 'PAUSED';
  @Prop({ required: true, default: 'UNVERIFIED' }) verificationStatus: string;
  @Prop({ type: Object, required: true }) source: {
    sourceType: string;
    sourceUrl?: string;
    sourceName?: string;
    verifiedAt?: string;
  };
  @Prop() managementKeyHash?: string;
  @Prop() reviewedAt?: string;
  @Prop() approvedAt?: string;
  @Prop() qrIssuedAt?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export type PartnerDocument = Partner & Document;
export const PartnerSchema = SchemaFactory.createForClass(Partner);
PartnerSchema.index({ regionId: 1, canonicalEntityId: 1 }, { unique: true });

@Schema({ timestamps: true })
export class PartnerBenefit {
  @Prop({ required: true, unique: true, index: true }) benefitId: string;
  @Prop({ required: true, index: true }) partnerId: string;
  @Prop({ required: true, index: true }) regionId: string;
  @Prop({ required: true }) title: string;
  @Prop() shortDescription?: string;
  @Prop({ required: true }) benefitType:
    | 'FIXED_DISCOUNT'
    | 'PERCENT_DISCOUNT'
    | 'DRINK'
    | 'DESSERT'
    | 'SIZE_UP'
    | 'EXPERIENCE_DISCOUNT'
    | 'GIFT'
    | 'LATE_CHECKOUT'
    | 'PRIORITY_RESERVATION'
    | 'CUSTOM'
    | 'NONE';
  @Prop() value?: number;
  @Prop() displayValue?: string;
  @Prop() conditions?: string;
  @Prop() startsAt?: Date;
  @Prop() endsAt?: Date;
  @Prop({ type: [Number], default: [] }) daysOfWeek: number[];
  @Prop() dailyStartTime?: string;
  @Prop() dailyEndTime?: string;
  @Prop() totalLimit?: number;
  @Prop() dailyLimit?: number;
  @Prop({ default: 1 }) perTripLimit: number;
  @Prop({ default: false }) repeatable: boolean;
  @Prop({ default: false }) combinable: boolean;
  @Prop({ default: true }) partnerConfirmationRequired: boolean;
  @Prop({ required: true, default: 'DRAFT' }) publicationStatus:
    'DRAFT' | 'PUBLIC' | 'PAUSED' | 'ENDED';
  @Prop({ required: true, default: 'PENDING' }) approvalStatus: ApprovalStatus;
  @Prop({ default: false }) soldOut: boolean;
  @Prop({ default: 0 }) reservedCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}
export type PartnerBenefitDocument = PartnerBenefit & Document;
export const PartnerBenefitSchema =
  SchemaFactory.createForClass(PartnerBenefit);
PartnerBenefitSchema.index({ partnerId: 1, regionId: 1 });

@Schema({ timestamps: true })
export class PartnerActivity {
  @Prop({ required: true, unique: true, index: true }) activityId: string;
  @Prop({ required: true, index: true }) eventType: string;
  @Prop({ required: true, index: true }) partnerId: string;
  @Prop({ required: true, index: true }) regionId: string;
  @Prop({ required: true, index: true }) anonymousTripId: string;
  @Prop({ unique: true, sparse: true, index: true }) dedupeKey?: string;
  @Prop() benefitId?: string;
  @Prop() redemptionId?: string;
  @Prop({ type: Object, default: {} }) metadata: Record<
    string,
    string | number | boolean
  >;
  createdAt?: Date;
}
export type PartnerActivityDocument = PartnerActivity & Document;
export const PartnerActivitySchema =
  SchemaFactory.createForClass(PartnerActivity);
PartnerActivitySchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

@Schema({ timestamps: true })
export class BenefitRedemption {
  @Prop({ required: true, unique: true, index: true }) redemptionId: string;
  @Prop({ required: true, index: true }) benefitId: string;
  @Prop({ required: true, index: true }) partnerId: string;
  @Prop({ required: true, index: true }) regionId: string;
  @Prop({ required: true, index: true }) anonymousTripId: string;
  @Prop({ required: true, unique: true, index: true }) idempotencyKey: string;
  @Prop({ required: true, default: 'REQUESTED' }) status:
    'REQUESTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
  @Prop({ required: true }) requestedAt: Date;
  @Prop({ required: true, index: true }) expiresAt: Date;
  @Prop() confirmedAt?: Date;
  @Prop() decidedAt?: Date;
}
export type BenefitRedemptionDocument = BenefitRedemption & Document;
export const BenefitRedemptionSchema =
  SchemaFactory.createForClass(BenefitRedemption);
BenefitRedemptionSchema.index(
  { benefitId: 1, anonymousTripId: 1 },
  { unique: true },
);

@Schema({ timestamps: true })
export class BenefitDailyCounter {
  @Prop({ required: true, unique: true, index: true }) counterId: string;
  @Prop({ required: true, index: true }) benefitId: string;
  @Prop({ required: true, index: true }) seoulDate: string;
  @Prop({ required: true, default: 0 }) count: number;
}
export type BenefitDailyCounterDocument = BenefitDailyCounter & Document;
export const BenefitDailyCounterSchema =
  SchemaFactory.createForClass(BenefitDailyCounter);
