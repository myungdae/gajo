import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class ItineraryStep {
  @Prop()
  itemId?: string;

  @Prop({ required: true })
  order: number;

  @Prop({ required: true })
  label: string;

  /** URI of the gajo:Facility individual for this step */
  @Prop({ required: true })
  facilityUri: string;

  @Prop()
  facilityLabel?: string;

  /** URI of the gajo:Program individual for this step */
  @Prop()
  programUri?: string;

  @Prop()
  programLabel?: string;

  @Prop()
  durationMinutes?: number;

  @Prop()
  requiresReservation?: boolean;

  @Prop({ default: 'PLANNED' })
  status?: string;

  @Prop()
  scheduledTime?: string;

  @Prop() entityType?: string;
  @Prop() accommodationType?: string;
  @Prop() areaLabel?: string;
  @Prop() eventAvailability?: string;
  @Prop() accessStatus?: string;
  @Prop() accessNotice?: string;
}
export const ItineraryStepSchema = SchemaFactory.createForClass(ItineraryStep);

@Schema({ timestamps: true })
export class Itinerary {
  @Prop({ required: true, unique: true })
  itineraryNo: string;

  @Prop({ required: true })
  runtimeContextId: string;

  @Prop({ required: true, index: true, default: 'gajo' })
  regionId: string;

  @Prop()
  label: string;

  @Prop({ type: [ItineraryStepSchema], default: [] })
  steps: ItineraryStep[];

  @Prop({ type: Number, default: 0 })
  confidenceScore: number;

  /** URIs of gajo:SafetyRisk individuals relevant to this itinerary */
  @Prop({ type: [String], default: [] })
  risks: string[];
}

export type ItineraryDocument = Itinerary & Document;
export const ItinerarySchema = SchemaFactory.createForClass(Itinerary);
