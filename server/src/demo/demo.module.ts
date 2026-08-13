import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { AgentsModule } from '../agents/agents.module';
import { DemoSeedService } from '../seed/demo-seed.service';
import { DemoSeedController } from '../seed/demo-seed.controller';
import { SeedModule } from '../seed/seed.module';

/**
 * Separate top-level module for the demo-scenario convenience endpoint.
 * Kept out of SeedModule to avoid a circular dependency
 * (SeedModule <- ContextModule/AgentsModule <- DemoSeedService).
 */
@Module({
  imports: [ContextModule, AgentsModule, SeedModule],
  providers: [DemoSeedService],
  controllers: [DemoSeedController],
})
export class DemoModule {}
