import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RuntimeContextService } from './runtime-context.service';
import type { CreateContextInput } from './runtime-context.service';

@Controller('api/context')
export class ContextController {
  constructor(private readonly service: RuntimeContextService) {}

  @Post('create')
  create(@Body() body: CreateContextInput) {
    return this.service.createContext(body);
  }

  @Get(':contextNo')
  get(@Param('contextNo') contextNo: string) {
    return this.service.getContext(contextNo);
  }

  @Get()
  list() {
    return this.service.listContexts();
  }
}
