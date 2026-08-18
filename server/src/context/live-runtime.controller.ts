import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { LiveRuntimeHydrationService } from './live-runtime-hydration.service';
import { RuntimeContextService } from './runtime-context.service';
import { LocationHydrationService, LocationObservation } from './location-hydration.service';

@Controller('api/runtime-context')
export class LiveRuntimeController {
  constructor(private readonly hydration: LiveRuntimeHydrationService, private readonly contexts: RuntimeContextService, private readonly locationHydration: LocationHydrationService) {}
  @Get('live')
  async live(@Query('contextNo') contextNo?: string,@Query('regionId') regionId='gajo') {
    const base = contextNo ? await this.contexts.getContext(contextNo) : {regionId};
    if(base?.regionId&&base.regionId!==regionId)return this.hydration.hydrateLiveRuntimeContext({regionId});
    return this.hydration.hydrateLiveRuntimeContext(base || {regionId});
  }
  @Post('hydrate')
  async hydrate(@Body() body: { regionId?:string;context?: any; location?: LocationObservation }) {
    const regionId=body.regionId||body.context?.regionId||'gajo';
    const located=this.locationHydration.hydrate({...body.context,regionId},body.location);
    return this.hydration.hydrateLiveRuntimeContext(located);
  }
}
