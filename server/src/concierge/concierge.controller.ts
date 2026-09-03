import { Body, Controller, Post } from '@nestjs/common';
import { ConciergeService } from './concierge.service';
import type { CreateContextInput } from '../context/runtime-context.service';
import { localizeVisitorPayload, normalizeVisitorLocale } from '../i18n/visitor-locale';

@Controller('api/concierge')
export class ConciergeController {
  constructor(private readonly service: ConciergeService) {}

  @Post('chat')
  async chat(@Body() body: CreateContextInput) {
    const locale = normalizeVisitorLocale(body.locale);
    const result = await this.service.chat({ ...body, locale });
    return localizeVisitorPayload(result, locale);
  }
}
