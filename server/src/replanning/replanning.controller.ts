import { Body, Controller, Param, Post, Query } from '@nestjs/common';
import { RuntimeReplanningService } from './runtime-replanning.service';
import { localizeVisitorPayload, normalizeVisitorLocale } from '../i18n/visitor-locale';

@Controller('api/runtime-replanning')
export class ReplanningController {
  constructor(private readonly service: RuntimeReplanningService) {}
  @Post('observe') async observe(@Body() body: any) {
    const result = body.previousContext && body.currentContext && body.itinerary
      ? await this.service.observeRuntime(body.previousContext, body.currentContext, body.itinerary)
      : await this.service.observeById(body);
    return localizeVisitorPayload(result, normalizeVisitorLocale(body.locale));
  }
  @Post(':proposalNo/approve') async approve(@Param('proposalNo') proposalNo: string, @Query('locale') locale?: string) { return localizeVisitorPayload(await this.service.approve(proposalNo), normalizeVisitorLocale(locale)); }
  @Post(':proposalNo/reject') async reject(@Param('proposalNo') proposalNo: string, @Query('locale') locale?: string) { return localizeVisitorPayload(await this.service.reject(proposalNo), normalizeVisitorLocale(locale)); }
}
