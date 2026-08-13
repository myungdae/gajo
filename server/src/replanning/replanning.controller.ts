import { Body, Controller, Param, Post } from '@nestjs/common';
import { RuntimeReplanningService } from './runtime-replanning.service';

@Controller('api/runtime-replanning')
export class ReplanningController {
  constructor(private readonly service: RuntimeReplanningService) {}
  @Post('observe') observe(@Body() body: any) {
    if (body.previousContext && body.currentContext && body.itinerary) return this.service.observeRuntime(body.previousContext, body.currentContext, body.itinerary);
    return this.service.observeById(body);
  }
  @Post(':proposalNo/approve') approve(@Param('proposalNo') proposalNo: string) { return this.service.approve(proposalNo); }
  @Post(':proposalNo/reject') reject(@Param('proposalNo') proposalNo: string) { return this.service.reject(proposalNo); }
}
