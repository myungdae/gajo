import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Visitor {
  @Prop({ required: true, unique: true })
  visitorNo: string;

  @Prop()
  name: string;

  @Prop()
  phone: string;

  @Prop()
  age: number;

  /** URIs of gajo:WellnessGoal individuals, e.g. gajo:familyHealingTrip */
  @Prop({ type: [String], default: [] })
  wellnessGoals: string[];

  /** URIs of gajo:HealthCondition individuals */
  @Prop({ type: [String], default: [] })
  healthConditions: string[];

  @Prop({ default: 'password-not-set' })
  passwordHash?: string;
}

export type VisitorDocument = Visitor & Document;
export const VisitorSchema = SchemaFactory.createForClass(Visitor);
