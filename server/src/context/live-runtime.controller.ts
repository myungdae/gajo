import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { LiveRuntimeHydrationService } from './live-runtime-hydration.service';
import { RuntimeContextService } from './runtime-context.service';
import { LocationHydrationService, LocationObservation } from './location-hydration.service';

@Controller('api/runtime-context')
export class LiveRuntimeController {
  constructor(private readonly hydration: LiveRuntimeHydrationService, private readonly contexts: RuntimeContextService, private readonly locationHydration: LocationHydrationService) {}
  @Get('live')
  async live(@Query('contextNo') contextNo?: string) {
    const base = contextNo ? await this.contexts.getContext(contextNo) : {};
    return this.hydration.hydrateLiveRuntimeContext(base || {});
  }
  @Post('hydrate')
  async hydrate(@Body() body: { context?: any; location?: LocationObservation }) {
    const live = await this.hydration.hydrateLiveRuntimeContext(body.context || {});
    return { ...live, context: this.locationHydration.hydrate(live.context, body.location) };
  }
}
