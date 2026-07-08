import { Module } from '@nestjs/common';
import { FacilityService } from './facility.service';
import { FacilityController } from './facility.controller';
import { SeedModule } from '../seed/seed.module';

@Module({
  imports: [SeedModule],
  providers: [FacilityService],
  controllers: [FacilityController],
  exports: [FacilityService],
})
export class FacilityModule {}
