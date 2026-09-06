import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard';
import { assertCopilotAccess, CopilotAuthGuard } from '../copilot/copilot-auth';
import { LocationReviewService } from './location-review.service';
import type { LocationActor } from './location-review.policy';

function admin(req: any): LocationActor {
  return { ...req.adminPrincipal, canWrite: true };
}
function copilot(req: any, region: string, write = false): LocationActor {
  assertCopilotAccess(req.copilotUser, region, write);
  return {
    actorId: `COPILOT:${req.copilotUser.sub}`,
    allowedRegionIds: [region],
    canWrite: ['REGIONAL_MANAGER', 'PLATFORM_ADMIN'].includes(
      req.copilotUser.role,
    ),
  };
}
@Controller('api/admin/locations')
@UseGuards(AdminTokenGuard)
export class AdminLocationReviewController {
  constructor(private service: LocationReviewService) {}
  @Get() list(
    @Req() req: any,
    @Query('regionId') region: string,
    @Query('missingOnly') missing: string,
  ) {
    return this.service.list(admin(req), region, missing === 'true');
  }
  @Get(':id') detail(
    @Req() req: any,
    @Query('regionId') region: string,
    @Param('id') id: string,
  ) {
    return this.service.detail(admin(req), region, id);
  }
  @Post(':id/candidates') candidates(
    @Req() req: any,
    @Query('regionId') region: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.candidates(admin(req), region, id, body?.address);
  }
  @Post(':id/preview') preview(
    @Req() req: any,
    @Query('regionId') region: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.preview(admin(req), region, id, body);
  }
  @Post(':id/actions/:action') action(
    @Req() req: any,
    @Query('regionId') region: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: any,
  ) {
    return this.service.action(admin(req), region, id, action, body);
  }
}
@Controller('api/copilot/locations')
@UseGuards(CopilotAuthGuard)
export class CopilotLocationReviewController {
  constructor(private service: LocationReviewService) {}
  @Get() list(
    @Req() req: any,
    @Query('regionId') region: string,
    @Query('missingOnly') missing: string,
  ) {
    return this.service.list(copilot(req, region), region, missing === 'true');
  }
  @Get(':id') detail(
    @Req() req: any,
    @Query('regionId') region: string,
    @Param('id') id: string,
  ) {
    return this.service.detail(copilot(req, region), region, id);
  }
  @Post(':id/candidates') candidates(
    @Req() req: any,
    @Query('regionId') region: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.candidates(
      copilot(req, region, true),
      region,
      id,
      body?.address,
    );
  }
  @Post(':id/preview') preview(
    @Req() req: any,
    @Query('regionId') region: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.preview(copilot(req, region, true), region, id, body);
  }
  @Post(':id/actions/:action') action(
    @Req() req: any,
    @Query('regionId') region: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: any,
  ) {
    return this.service.action(
      copilot(req, region, true),
      region,
      id,
      action,
      body,
    );
  }
}
