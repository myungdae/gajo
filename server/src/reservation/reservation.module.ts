import { Module } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { ContextModule } from '../context/context.module';
import { SeedModule } from '../seed/seed.module';

@Module({
  imports: [ContextModule, SeedModule],
  providers: [ReservationService],
  controllers: [ReservationController],
  exports: [ReservationService],
})
export class ReservationModule {}
