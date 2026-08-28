import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BenefitRedemption,
  BenefitRedemptionSchema,
  BenefitDailyCounter,
  BenefitDailyCounterSchema,
  Partner,
  PartnerActivity,
  PartnerActivitySchema,
  PartnerBenefit,
  PartnerBenefitSchema,
  PartnerSchema,
} from './partner.schema';
import {
  PartnerAdminController,
  PartnerController,
} from './partner.controller';
import { PartnerService } from './partner.service';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Partner.name, schema: PartnerSchema },
      { name: PartnerBenefit.name, schema: PartnerBenefitSchema },
      { name: PartnerActivity.name, schema: PartnerActivitySchema },
      { name: BenefitRedemption.name, schema: BenefitRedemptionSchema },
      { name: BenefitDailyCounter.name, schema: BenefitDailyCounterSchema },
    ]),
  ],
  controllers: [PartnerController, PartnerAdminController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
