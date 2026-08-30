import {
  Controller,
  Get,
  Optional,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RegionalReportGuard } from './regional-report.guard';
import { RegionalReportRateLimitGuard } from './regional-report-rate-limit.guard';
import { RegionalReportService } from './regional-report.service';
import { TourismNetworkAggregationService } from './tourism-network-aggregation.service';
type RegionalReportRequest = {
  regionalReportAccess: { regionId: string };
};
@Controller('api/regional-report')
@UseGuards(RegionalReportGuard, RegionalReportRateLimitGuard)
export class RegionalReportController {
  constructor(
    private service: RegionalReportService,
    @Optional() private network?: TourismNetworkAggregationService,
  ) {}
  @Get() get(
    @Req() req: RegionalReportRequest,
    @Query('period') period?: string,
  ) {
    return this.service.report(req.regionalReportAccess.regionId, period);
  }
  @Get('network')
  async networkReport(@Req() req: RegionalReportRequest) {
    const snapshot = await this.network?.latestPublicRolling(
      req.regionalReportAccess.regionId,
    );
    if (!snapshot)
      return {
        schemaVersion: 1,
        region: { id: req.regionalReportAccess.regionId },
        period: { key: '30d', timeZone: 'Asia/Seoul' },
        privacy: {
          minimumCellSize: 5,
          individualPathsReturned: false,
          suppressionApplied: true,
        },
        network: {
          status: 'PREPARING',
          notice: '연결 데이터 준비 중',
          nodes: [],
          edges: [],
          stageTotals: [],
          categoryConnections: [],
        },
      };
    return {
      schemaVersion: 1,
      region: { id: snapshot.regionId },
      period: {
        key: '30d',
        timeZone: 'Asia/Seoul',
        start: snapshot.windowStart,
        endExclusive: snapshot.windowEndExclusive,
      },
      generatedAt: snapshot.snapshotAt,
      privacy: {
        minimumCellSize: snapshot.minimumCellSize,
        individualPathsReturned: false,
        suppressionApplied: true,
      },
      network: snapshot.released,
    };
  }
}
