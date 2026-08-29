import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { RegionalReportGuard } from './regional-report.guard';
import { RegionalReportService } from './regional-report.service';
@Controller('api/regional-report')
@UseGuards(RegionalReportGuard)
export class RegionalReportController {
  constructor(private service: RegionalReportService) {}
  @Get() get(@Req() req: any, @Query('period') period?: string) {
    return this.service.report(req.regionalReportAccess.regionId, period);
  }
}
