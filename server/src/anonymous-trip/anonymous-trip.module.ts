import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnonymousTrip, AnonymousTripSchema } from './anonymous-trip.schema';
import { AnonymousTripController } from './anonymous-trip.controller';
import { AnonymousTripService } from './anonymous-trip.service';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnonymousTrip.name, schema: AnonymousTripSchema },
    ]),
  ],
  controllers: [AnonymousTripController],
  providers: [AnonymousTripService],
})
export class AnonymousTripModule {}
