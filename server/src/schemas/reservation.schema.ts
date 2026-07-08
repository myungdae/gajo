import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Reservation {
  @Prop({ required: true, unique: true })
  reservationNo: string;

  @Prop({ required: true })
  visitorNo: string;

  /** URI of the gajo:Facility individual */
  @Prop({ required: true })
  facilityUri: string;

  /** URI of the gajo:Program individual, if reserving a specific program */
  @Prop()
  programUri?: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop()
  timeSlot?: string;

  @Prop({ type: Number, default: 1 })
  partySize: number;

  @Prop({ default: 'confirmed', enum: ['confirmed', 'pending', 'cancelled'] })
  status: string;

  @Prop()
  note?: string;
}

export type ReservationDocument = Reservation & Document;
export const ReservationSchema = SchemaFactory.createForClass(Reservation);
