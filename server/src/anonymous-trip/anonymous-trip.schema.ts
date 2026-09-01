import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
@Schema({ timestamps: true })
export class AnonymousTrip {
  @Prop({ required: true, index: true }) anonymousTripId: string;
  @Prop({ required: true, index: true }) regionId: string;
  @Prop({ type: Object, required: true }) state: Record<string, unknown>;
  @Prop({ required: true }) ownerTokenHash: string;
  @Prop({ required: true, index: true }) expiresAt: Date;
}
export type AnonymousTripDocument = AnonymousTrip & Document;
export const AnonymousTripSchema = SchemaFactory.createForClass(AnonymousTrip);
AnonymousTripSchema.index(
  { anonymousTripId: 1, regionId: 1 },
  { unique: true },
);
AnonymousTripSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
