import { Module } from '@nestjs/common';
import { NearbyService } from './nearby.service';
import { NearbyController } from './nearby.controller';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [MasterDataModule],
  providers: [NearbyService],
  controllers: [NearbyController],
  exports: [NearbyService],
})
export class NearbyModule {}
