import { VisitorAnalyticsEvent,VisitorAnalyticsEventSchema } from '../analytics/visitor-event.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnonymousTrip, AnonymousTripSchema } from './anonymous-trip.schema';
import { AnonymousTripController } from './anonymous-trip.controller';
import { AnonymousTripService } from './anonymous-trip.service';
import { PilotEvent, PilotEventSchema } from '../schemas/pilot-event.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnonymousTrip.name, schema: AnonymousTripSchema },
      { name: PilotEvent.name, schema: PilotEventSchema },
      { name: VisitorAnalyticsEvent.name, schema: VisitorAnalyticsEventSchema },
    ]),
  ],
  controllers: [AnonymousTripController],
  providers: [AnonymousTripService],
})
export class AnonymousTripModule {}
