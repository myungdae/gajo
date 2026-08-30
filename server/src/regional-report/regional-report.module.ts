import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PilotEvent, PilotEventSchema } from '../schemas/pilot-event.schema';
import {
  Partner,
  PartnerActivity,
  PartnerActivitySchema,
  PartnerSchema,
  BenefitRedemption,
  BenefitRedemptionSchema,
} from '../partner/partner.schema';
import { RegionalReportController } from './regional-report.controller';
import { RegionalReportGuard } from './regional-report.guard';
import { RegionalReportRateLimitGuard } from './regional-report-rate-limit.guard';
import { RegionalReportService } from './regional-report.service';
import {
  TourismNetworkAggregate,
  TourismNetworkAggregateSchema,
} from './tourism-network-aggregate.schema';
import { TourismNetworkAggregationService } from './tourism-network-aggregation.service';
import { TourismNetworkRetentionService } from './tourism-network-retention.service';
import { TourismNetworkJobService } from './tourism-network-job.service';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PilotEvent.name, schema: PilotEventSchema },
      { name: PartnerActivity.name, schema: PartnerActivitySchema },
      { name: Partner.name, schema: PartnerSchema },
      { name: BenefitRedemption.name, schema: BenefitRedemptionSchema },
      {
        name: TourismNetworkAggregate.name,
        schema: TourismNetworkAggregateSchema,
      },
    ]),
  ],
  controllers: [RegionalReportController],
  providers: [
    RegionalReportGuard,
    RegionalReportRateLimitGuard,
    RegionalReportService,
    TourismNetworkAggregationService,
    TourismNetworkRetentionService,
    TourismNetworkJobService,
  ],
  exports: [TourismNetworkAggregationService, TourismNetworkJobService],
})
export class RegionalReportModule {}
