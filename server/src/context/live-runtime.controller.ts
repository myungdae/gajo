import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { LiveRuntimeHydrationService } from './live-runtime-hydration.service';
import { RuntimeContextService } from './runtime-context.service';
import { LocationHydrationService, LocationObservation } from './location-hydration.service';

@Controller('api/runtime-context')
export class LiveRuntimeController {
  constructor(private readonly hydration: LiveRuntimeHydrationService, private readonly contexts: RuntimeContextService, private readonly locationHydration: LocationHydrationService) {}
  @Get('live')
  async live(@Query('contextNo') contextNo?: string,@Query('regionId') regionId?:string) {
    if(!regionId)throw new BadRequestException('regionId is required');
    const base = contextNo ? await this.contexts.getContext(contextNo) : {regionId};
    if(base?.regionId&&base.regionId!==regionId)return this.hydration.hydrateLiveRuntimeContext({regionId});
    return this.hydration.hydrateLiveRuntimeContext(base || {regionId});
  }
  @Post('hydrate')
  async hydrate(@Body() body: { regionId?:string;context?: any; location?: LocationObservation }) {
    const regionId=body.regionId||body.context?.regionId;
    if(!regionId)throw new BadRequestException('regionId is required');
    const located=this.locationHydration.hydrate({...body.context,regionId},body.location);
    return this.hydration.hydrateLiveRuntimeContext(located);
  }
}
