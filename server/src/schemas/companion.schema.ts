import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Companion {
  @Prop({ type: Types.ObjectId, ref: 'Visitor', required: true })
  visitorId: Types.ObjectId;

  @Prop()
  name: string;

  @Prop()
  age: number;

  @Prop()
  relationship?: string;

  /** URIs of gajo:HealthCondition individuals, e.g. gajo:kneePain */
  @Prop({ type: [String], default: [] })
  healthConditions: string[];
}

export type CompanionDocument = Companion & Document;
export const CompanionSchema = SchemaFactory.createForClass(Companion);
