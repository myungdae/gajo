import { Module } from '@nestjs/common';
import { ConciergeService } from './concierge.service';
import { ConciergeController } from './concierge.controller';
import { ContextModule } from '../context/context.module';
import { AgentsModule } from '../agents/agents.module';
import{PlaceDiscoveryService}from'./place-discovery.service';

@Module({
  imports: [ContextModule, AgentsModule],
  providers: [ConciergeService,PlaceDiscoveryService],
  controllers: [ConciergeController],
})
export class ConciergeModule {}
