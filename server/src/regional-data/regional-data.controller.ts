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
import { AdminTokenGuard, type AdminPrincipal } from './admin-token.guard';
import { RegionalDataService } from './regional-data.service';

@Controller('api/admin/regional-data')
export class RegionalDataController {
  constructor(private service: RegionalDataService) {}
  @Get() async list(@Query() query: any) {
    return {
      records: await this.service.list(query),
      quality: await this.service.quality(),
    };
  }
  @Get('operational-readiness') operationalReadiness(
    @Query('regionId') regionId: string,
  ) {
    return this.service.operationalReadiness(regionId);
  }
  @Get('export') @UseGuards(AdminTokenGuard) exportData(
    @Query('regionId') regionId: string,
    @Query('includeChanges') includeChanges?: string,
    @Query('backup') backup?: string,
  ) {
    return this.service.exportPackage(regionId, {
      includeChanges: includeChanges === 'true',
      backup: backup === 'true',
    });
  }
  @Post('import/preview') @UseGuards(AdminTokenGuard) previewImport(
    @Body() body: any,
  ) {
    return this.service.previewImport(body?.package, {
      trustedVerified: body?.trustedVerified === true,
    });
  }
  @Post('import') @UseGuards(AdminTokenGuard) importData(@Body() body: any) {
    return this.service.importPackage(body?.package, {
      trustedVerified: body?.trustedVerified === true,
    });
  }
  @Post('candidates') @UseGuards(AdminTokenGuard) create(@Body() body: any) {
    return this.service.create(body);
  }
  @Post(':id/actions/:action') @UseGuards(AdminTokenGuard) action(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: any,
    @Req() request: { adminPrincipal?: AdminPrincipal },
  ) {
    return this.service.action(id, action, body?.editedFacts, {
      actorId: request.adminPrincipal?.actorId,
    });
  }
}
