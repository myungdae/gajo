import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({ collection: 'regionalactionchannels', timestamps: true, autoCreate: false, autoIndex: false })
export class ActionChannel {
  @Prop({ type: String }) _id: string;
  @Prop({ required: true }) channelId: string;
  @Prop({ required: true }) regionId: string;
  @Prop({ required: true }) placeKey: string;
  @Prop({ required: true }) kind: string;
  @Prop({ required: true }) labelKo: string;
  @Prop({ required: true }) labelEn: string;
  @Prop({ required: true }) target: string;
  @Prop({ required: true }) sourceUrl: string;
  @Prop({ required: true }) verificationStatus: string;
  @Prop({ default: false }) published: boolean;
  @Prop() reviewedAt?: Date;
  @Prop() reviewedBy?: string;
  @Prop() reviewedFingerprint?: string;
  @Prop({ required: true }) reviewDueAt: Date;
  @Prop({ required: true }) revision: number;
  @Prop({ type: [Object], default: [] }) audit: Record<string, unknown>[];
}
export const ActionChannelSchema = SchemaFactory.createForClass(ActionChannel);
ActionChannelSchema.index({ channelId: 1 }, { unique: true });
ActionChannelSchema.index({ regionId: 1, placeKey: 1, verificationStatus: 1, published: 1 });
ActionChannelSchema.index({ regionId: 1, reviewDueAt: 1 });
