import { Injectable } from '@nestjs/common';
import {
  TourismNetworkAggregationService,
  seoulMonthKey,
} from './tourism-network-aggregation.service';
import { TourismNetworkRetentionService } from './tourism-network-retention.service';
import { addDays } from './retention-policy';

export const NETWORK_REGIONS = [
  'gajo',
  'okcheon',
  'muan',
  'gyeryong',
  'hapcheon',
  'daejeon-junggu',
] as const;

@Injectable()
export class TourismNetworkJobService {
  constructor(
    private aggregation: TourismNetworkAggregationService,
    private retention: TourismNetworkRetentionService,
  ) {}

  async runDaily(now = new Date(), minimumCellSize = 5) {
    const previousMonth = seoulMonthKey(addDays(now, -7));
    for (const regionId of NETWORK_REGIONS) {
      await this.aggregation.generate(
        regionId,
        'ROLLING_30D',
        undefined,
        now,
        minimumCellSize,
      );
      if (
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Seoul',
          day: '2-digit',
        }).format(now) <= '07'
      )
        await this.aggregation.generate(
          regionId,
          'MONTHLY',
          previousMonth,
          now,
          minimumCellSize,
        );
    }
    const unlinkResult = await this.retention.removeExpiredLinkage(now);
    return {
      regions: NETWORK_REGIONS.length,
      previousMonthRecomputed: previousMonth,
      unlinkModified: unlinkResult.modifiedCount || 0,
    };
  }
}
