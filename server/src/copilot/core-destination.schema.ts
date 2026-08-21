import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
@Schema({ timestamps: true })
export class CoreDestination {
  @Prop({ required: true, unique: true }) id: string;
  @Prop({ required: true, index: true }) regionId: string;
  @Prop() canonicalEntityId?: string;
  @Prop({ required: true }) displayName: string;
  @Prop({ required: true }) expectedCategory: string;
  @Prop({ type: [String], default: [] }) aliases: string[];
  @Prop({ default: true, index: true }) active: boolean;
  @Prop({ type: [Object], default: [] }) auditTrail: Array<
    Record<string, unknown>
  >;
}
export type CoreDestinationDocument = CoreDestination & Document;
export const CoreDestinationSchema =
  SchemaFactory.createForClass(CoreDestination);
CoreDestinationSchema.index({ regionId: 1, displayName: 1 }, { unique: true });
