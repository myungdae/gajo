import { Module } from '@nestjs/common';
import { NearbyService } from './nearby.service';
import { NearbyController } from './nearby.controller';
import { MasterDataModule } from '../master-data/master-data.module';
import { RegionalDataModule } from '../regional-data/regional-data.module';

@Module({
  imports: [MasterDataModule, RegionalDataModule],
  providers: [NearbyService],
  controllers: [NearbyController],
  exports: [NearbyService],
})
export class NearbyModule {}
