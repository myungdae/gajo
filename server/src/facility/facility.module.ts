import { Module } from '@nestjs/common';
import { FacilityService } from './facility.service';
import { FacilityController } from './facility.controller';
import { SeedModule } from '../seed/seed.module';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [SeedModule, MasterDataModule],
  providers: [FacilityService],
  controllers: [FacilityController],
  exports: [FacilityService],
})
export class FacilityModule {}
