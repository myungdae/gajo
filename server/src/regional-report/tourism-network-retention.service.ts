import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BenefitRedemption,
  BenefitRedemptionDocument,
} from '../partner/partner.schema';

@Injectable()
export class TourismNetworkRetentionService {
  constructor(
    @InjectModel(BenefitRedemption.name)
    private redemptions: Model<BenefitRedemptionDocument>,
  ) {}

  async removeExpiredLinkage(now = new Date()) {
    return this.redemptions.updateMany(
      {
        linkExpiresAt: { $lte: now },
        $or: [
          { anonymousTripId: { $type: 'string' } },
          { idempotencyKey: { $type: 'string' } },
        ],
      },
      { $unset: { anonymousTripId: 1, idempotencyKey: 1 } },
    );
  }
}
