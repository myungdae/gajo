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
import {
  InMemoryPublicWriteRateLimitStore,
  PUBLIC_WRITE_RATE_LIMIT_STORE,
  PublicClientIdentityService,
  PublicWriteRateLimitGuard,
} from './public-write-security';
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
  providers: [
    PartnerService,
    PublicClientIdentityService,
    PublicWriteRateLimitGuard,
    InMemoryPublicWriteRateLimitStore,
    {
      provide: PUBLIC_WRITE_RATE_LIMIT_STORE,
      useExisting: InMemoryPublicWriteRateLimitStore,
    },
  ],
  exports: [
    PartnerService,
    PublicClientIdentityService,
    PublicWriteRateLimitGuard,
    InMemoryPublicWriteRateLimitStore,
    PUBLIC_WRITE_RATE_LIMIT_STORE,
  ],
})
export class PartnerModule {}
