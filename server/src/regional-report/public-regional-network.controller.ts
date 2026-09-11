import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { RegionalReportService } from './regional-report.service';
import { TourismNetworkAggregationService } from './tourism-network-aggregation.service';

@Controller('api/public/regional-network')
export class PublicRegionalNetworkController {
  constructor(
    private readonly service: RegionalReportService,
    private readonly network: TourismNetworkAggregationService,
  ) {}

  @Get(':regionId')
  ecosystem(@Param('regionId') regionId: string) {
    if (regionId !== 'hapcheon') throw new NotFoundException();
    return this.service.ecosystem(regionId);
  }

  @Get(':regionId/live')
  live(@Param('regionId') regionId: string) {
    if (regionId !== 'hapcheon') throw new NotFoundException();
    return this.network.latestPublicRolling(regionId);
  }

  @Get(':regionId/change')
  change(@Param('regionId') regionId: string) {
    if (regionId !== 'hapcheon') throw new NotFoundException();
    return this.network.latestPublicChange(regionId);
  }
}