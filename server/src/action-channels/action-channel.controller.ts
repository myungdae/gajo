import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminPrincipal, AdminTokenGuard } from '../regional-data/admin-token.guard';
import { ActionChannelService } from './action-channel.service';
import { ChannelOutboundService } from './channel-outbound.service';
import { PublicWriteLimit, PublicWriteRateLimitGuard } from '../partner/public-write-security';
@Controller('api/action-channels')
export class ActionChannelController {
  constructor(private channels: ActionChannelService, private outbound: ChannelOutboundService) {}
  @Get('public') publicList(@Query('regionId') region: string, @Query('placeKey') place: string) { return this.channels.publicList(region, place); }
  @Get('admin') @UseGuards(AdminTokenGuard)
  list(@Req() req: {adminPrincipal: AdminPrincipal}, @Query('regionId') region: string, @Query('placeKey') place: string) { return this.channels.list(req.adminPrincipal, region, place); }
  @Post('admin') @UseGuards(AdminTokenGuard)
  create(@Req() req: {adminPrincipal: AdminPrincipal}, @Query('regionId') region: string, @Query('placeKey') place: string, @Body() body: unknown) { return this.channels.create(req.adminPrincipal, region, place, body); }
  @Post('admin/:id/:action') @UseGuards(AdminTokenGuard)
  change(@Req() req: {adminPrincipal: AdminPrincipal}, @Query('regionId') region: string, @Query('placeKey') place: string, @Param('id') id: string, @Param('action') action: string, @Body() body: unknown) { return this.channels.change(req.adminPrincipal, region, place, id, action, body); }
  @Post(':id/outbound') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('RECOMMENDATION_TELEMETRY')
  dispatch(@Query('regionId') region: string, @Query('placeKey') place: string, @Param('id') id: string, @Body() body: unknown, @Headers('x-analytics-marker') marker?: string) { return this.outbound.dispatch(region, place, id, body, marker); }
  @Post(':id/click') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('RECOMMENDATION_TELEMETRY')
  click(@Query('regionId') region: string, @Query('placeKey') place: string, @Param('id') id: string, @Body() body: unknown, @Headers('x-analytics-marker') marker?: string) { return this.outbound.dispatch(region, place, id, body, marker, true); }
}
