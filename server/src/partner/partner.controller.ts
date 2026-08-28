import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AdminTokenGuard } from '../regional-data/admin-token.guard';
import { PartnerService } from './partner.service';
import type { Response } from 'express';
import {
  PublicWriteLimit,
  PublicWriteRateLimitGuard,
} from './public-write-security';
@Controller('api/partners')
@UseGuards(PublicWriteRateLimitGuard)
export class PartnerController {
  constructor(private service: PartnerService) {}
  @Post('applications') @PublicWriteLimit('PARTNER_APPLICATION') apply(
    @Body() body: any,
  ) {
    return this.service.apply(body);
  }
  @Get('public/:slug') entry(@Param('slug') slug: string) {
    return this.service.publicEntry(slug);
  }
  @Post('public/:slug/entries') @PublicWriteLimit('QR_ENTRY') record(
    @Param('slug') slug: string,
    @Body() body: any,
  ) {
    return this.service.recordEntry(slug, body);
  }
  @Post('public/:slug/visits') @PublicWriteLimit('QR_VISIT') visit(
    @Param('slug') slug: string,
    @Body() body: any,
  ) {
    return this.service.visit(slug, body);
  }
  @Post('benefits/:id/redemptions')
  @PublicWriteLimit('BENEFIT_REDEMPTION')
  redeem(@Param('id') id: string, @Body() body: any) {
    return this.service.requestRedemption(id, body);
  }
  @Post(':slug/benefits') @PublicWriteLimit('OWNER_MANAGEMENT') benefit(
    @Param('slug') slug: string,
    @Headers('x-partner-key') key: string,
    @Body() body: any,
  ) {
    return this.service.createBenefit(slug, key, body);
  }
  @Patch(':slug/redemptions/:id') @PublicWriteLimit('OWNER_MANAGEMENT') confirm(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Headers('x-partner-key') key: string,
    @Body() body: any,
  ) {
    return this.service.confirm(slug, id, key, body?.decision);
  }
  @Get(':slug/metrics') @PublicWriteLimit('OWNER_MANAGEMENT') metrics(
    @Param('slug') slug: string,
    @Headers('x-partner-key') key: string,
  ) {
    return this.service.metrics(slug, key);
  }
  @Get(':slug/qr') @PublicWriteLimit('OWNER_MANAGEMENT') async qr(
    @Param('slug') slug: string,
    @Headers('x-partner-key') key: string,
    @Query('kind') kind: string,
    @Query('format') format: string,
    @Query('test') test: string,
    @Res() response: Response,
  ) {
    const asset = await this.service.qrAsset(slug, key, {
      kind,
      format,
      test: test === 'true',
    });
    response.setHeader('Content-Type', asset.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${asset.filename}"`,
    );
    response.setHeader('X-QR-Mode', asset.test ? 'TEST' : 'PRINT');
    response.setHeader('X-QR-Target', asset.target);
    response.send(asset.data);
  }
  @Post('recommendations') @PublicWriteLimit('RECOMMENDATION_TELEMETRY') shown(
    @Body() b: any,
  ) {
    if (Array.isArray(b.entityIds))
      return this.service.recommendationsShownForEntities(
        b.regionId,
        b.anonymousTripId,
        b.entityIds,
      );
    return this.service.recommendationShown(
      b.partnerId,
      b.regionId,
      b.anonymousTripId,
    );
  }
}
@Controller('api/admin/partners')
@UseGuards(AdminTokenGuard)
export class PartnerAdminController {
  constructor(private service: PartnerService) {}
  @Get() list(@Query('regionId') r: string) {
    return this.service.adminList(r);
  }
  @Patch(':id/status') status(@Param('id') id: string, @Body() b: any) {
    return this.service.adminPartner(id, b.status);
  }
  @Patch('benefits/:id/approval') benefit(
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.service.adminBenefit(id, b.approvalStatus, b.publicationStatus);
  }
  @Post(':id/management-key') managementKey(@Param('id') id: string) {
    return this.service.adminIssueManagementKey(id);
  }
  @Post(':id/management-key/revoke') revokeManagementKey(
    @Param('id') id: string,
  ) {
    return this.service.adminRevokeManagementKey(id);
  }
}
