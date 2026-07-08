import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class VisitorGroup {
  @Prop({ type: Types.ObjectId, ref: 'Visitor', required: true })
  leaderVisitorId: Types.ObjectId;

  @Prop()
  groupName?: string;

  @Prop({ type: Number, default: 1 })
  size: number;
}

export type VisitorGroupDocument = VisitorGroup & Document;
export const VisitorGroupSchema = SchemaFactory.createForClass(VisitorGroup);
