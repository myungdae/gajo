import { Controller, Post } from '@nestjs/common';
import { DemoSeedService } from './demo-seed.service';

/**
 * Convenience endpoint to exercise the exact demo scenario described in
 * the spec end-to-end (senior mother + knee pain + rainy + congested ->
 * indoor low-intensity itinerary) without needing to hand-construct the
 * request body from the frontend during manual testing.
 */
@Controller('api/demo')
export class DemoSeedController {
  constructor(private readonly service: DemoSeedService) {}

  @Post('scenario')
  run() {
    return this.service.runDemoScenario();
  }
}
