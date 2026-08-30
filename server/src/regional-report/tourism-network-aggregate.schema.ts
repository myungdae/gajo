import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TourismNetworkAggregateKind = 'ROLLING_30D' | 'MONTHLY';

@Schema({ timestamps: true, autoCreate: false, autoIndex: false })
export class TourismNetworkAggregate {
  @Prop({ required: true, unique: true, index: true }) aggregateKey: string;
  @Prop({ required: true, index: true }) regionId: string;
  @Prop({ required: true, index: true }) kind: TourismNetworkAggregateKind;
  @Prop({ required: true, index: true }) periodKey: string;
  @Prop({ required: true }) windowStart: Date;
  @Prop({ required: true }) windowEndExclusive: Date;
  @Prop({ required: true }) snapshotAt: Date;
  @Prop({ required: true }) minimumCellSize: number;
  @Prop({ required: true, default: 'COMPLETE' }) status: 'COMPLETE';
  @Prop({ required: true }) sourceRevision: string;
  @Prop({ type: Object, required: true }) released: Record<string, unknown>;
  @Prop({ required: true }) expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TourismNetworkAggregateDocument = TourismNetworkAggregate &
  Document;
export const TourismNetworkAggregateSchema = SchemaFactory.createForClass(
  TourismNetworkAggregate,
);
TourismNetworkAggregateSchema.index(
  { regionId: 1, kind: 1, periodKey: 1 },
  { unique: true },
);
TourismNetworkAggregateSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);
