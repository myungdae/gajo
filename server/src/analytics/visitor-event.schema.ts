import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({
  collection: 'visitoranalyticevents',
  autoCreate: false,
  autoIndex: false,
})
export class VisitorAnalyticsEvent {
  @Prop({ type: String }) _id: string;
  @Prop({ required: true }) eventId: string;
  @Prop({ required: true }) schemaVersion: number;
  @Prop({ required: true }) eventType: string;
  @Prop({ required: true }) regionId: string;
  @Prop({ required: true }) anonymousTripId: string;
  @Prop({ required: true }) visitSessionId: string;
  @Prop({ required: true }) pageViewId: string;
  @Prop({ required: true }) screen: string;
  @Prop({ required: true }) uiLocale: string;
  @Prop({ required: true }) occurredAt: Date;
  @Prop({ required: true }) receivedAt: Date;
  @Prop({ required: true }) expiresAt: Date;
  @Prop({ required: true }) trafficClass: string;
  @Prop({ required: true }) evidenceType: string;
  @Prop({ required: true }) payloadHash: string;
  @Prop() searchId?: string;
  @Prop() resultSetId?: string;
  @Prop() actionId?: string;
  @Prop() placeKey?: string;
  @Prop() resultCount?: number;
  @Prop() entryId?: string;
  @Prop() provider?: string;
}
export const VisitorAnalyticsEventSchema = SchemaFactory.createForClass(
  VisitorAnalyticsEvent,
);
VisitorAnalyticsEventSchema.index({ eventId: 1 }, { unique: true });
VisitorAnalyticsEventSchema.index({ regionId: 1, receivedAt: 1 });
VisitorAnalyticsEventSchema.index({ regionId: 1, eventType: 1, receivedAt: 1 });
VisitorAnalyticsEventSchema.index({
  regionId: 1,
  visitSessionId: 1,
  receivedAt: 1,
});
VisitorAnalyticsEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Non-identifying collection start survives event retention. One document per region.
@Schema({
  collection: 'visitoranalyticsstate',
  autoCreate: false,
  autoIndex: false,
})
export class VisitorAnalyticsState {
  @Prop({ type: String }) _id: string;
  @Prop({ required: true }) firstReceivedAt: Date;
}
export const VisitorAnalyticsStateSchema = SchemaFactory.createForClass(
  VisitorAnalyticsState,
);

@Schema({
  collection: 'visitoranalyticsmarkers',
  autoCreate: false,
  autoIndex: false,
})
export class VisitorAnalyticsMarker {
  @Prop({ type: String }) _id: string;
  @Prop({ required: true }) kind: string;
  @Prop({ required: true }) expiresAt: Date;
  @Prop({ required: true }) retainUntil: Date;
}
export const VisitorAnalyticsMarkerSchema = SchemaFactory.createForClass(
  VisitorAnalyticsMarker,
);
VisitorAnalyticsMarkerSchema.index(
  { retainUntil: 1 },
  { expireAfterSeconds: 0 },
);
