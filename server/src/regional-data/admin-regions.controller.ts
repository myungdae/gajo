import { withAdditionalRegions } from '../region/additional-regions';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard';
import { REGION_CONFIGS } from '../region/region-config.service';
@Controller('api/admin/regions')
@UseGuards(AdminTokenGuard)
export class AdminRegionsController {
  @Get() list(@Req() request: any) {
    return Object.values(withAdditionalRegions(REGION_CONFIGS))
      .filter(region => request.adminPrincipal.allowedRegionIds.includes(region.id))
      .map(({id, regionName, serviceName}) => ({id, regionName, serviceName}));
  }
}
