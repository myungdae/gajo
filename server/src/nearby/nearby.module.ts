import { Module } from '@nestjs/common';
import { NearbyService } from './nearby.service';
import { NearbyController } from './nearby.controller';
import { MasterDataModule } from '../master-data/master-data.module';
import { RegionalDataModule } from '../regional-data/regional-data.module';
import { PartnerModule } from '../partner/partner.module';

@Module({
  imports: [MasterDataModule, RegionalDataModule, PartnerModule],
  providers: [NearbyService],
  controllers: [NearbyController],
  exports: [NearbyService],
})
export class NearbyModule {}
