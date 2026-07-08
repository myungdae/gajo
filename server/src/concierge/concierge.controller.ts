import { Body, Controller, Post } from '@nestjs/common';
import { ConciergeService } from './concierge.service';
import type { CreateContextInput } from '../context/runtime-context.service';

@Controller('api/concierge')
export class ConciergeController {
  constructor(private readonly service: ConciergeService) {}

  @Post('chat')
  chat(@Body() body: CreateContextInput) {
    return this.service.chat(body);
  }
}
