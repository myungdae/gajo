import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PilotEvent, PilotEventSchema } from '../schemas/pilot-event.schema';
import {
  Partner,
  PartnerActivity,
  PartnerActivitySchema,
  PartnerSchema,
} from '../partner/partner.schema';
import { RegionalReportController } from './regional-report.controller';
import { RegionalReportGuard } from './regional-report.guard';
import { RegionalReportService } from './regional-report.service';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PilotEvent.name, schema: PilotEventSchema },
      { name: PartnerActivity.name, schema: PartnerActivitySchema },
      { name: Partner.name, schema: PartnerSchema },
    ]),
  ],
  controllers: [RegionalReportController],
  providers: [RegionalReportGuard, RegionalReportService],
})
export class RegionalReportModule {}
