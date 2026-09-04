import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { VisitorAnalyticsService } from './visitor-analytics.service';
import {
  AdminTokenGuard,
  AdminPrincipal,
} from '../regional-data/admin-token.guard';
import {
  PublicWriteLimit,
  PublicWriteRateLimitGuard,
} from '../partner/public-write-security';
@Controller('api/analytics/v2')
export class VisitorAnalyticsController {
  constructor(private service: VisitorAnalyticsService) {}
  @Post('events')
  @UseGuards(PublicWriteRateLimitGuard)
  @PublicWriteLimit('RECOMMENDATION_TELEMETRY')
  record(
    @Body() body: unknown,
    @Headers('x-analytics-marker') marker?: string,
  ) {
    return this.service.record(body, marker);
  }
  @Post('markers')
  @UseGuards(AdminTokenGuard)
  marker(
    @Req() req: { adminPrincipal: AdminPrincipal },
    @Body() body: unknown,
  ) {
    return this.service.marker(req.adminPrincipal, body);
  }
  @Get('report')
  @UseGuards(AdminTokenGuard)
  report(
    @Req() req: { adminPrincipal: AdminPrincipal },
    @Query() query: Record<string, unknown>,
  ) {
    return this.service.report(req.adminPrincipal, query);
  }
}
