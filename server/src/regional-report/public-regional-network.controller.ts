import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { RegionalReportService } from './regional-report.service';

@Controller('api/public/regional-network')
export class PublicRegionalNetworkController {
  constructor(private readonly service: RegionalReportService) {}

  @Get(':regionId')
  ecosystem(@Param('regionId') regionId: string) {
    if (regionId !== 'hapcheon') throw new NotFoundException();
    return this.service.ecosystem(regionId);
  }
}
