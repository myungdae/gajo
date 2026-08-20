import { Module } from '@nestjs/common';
import { ConciergeService } from './concierge.service';
import { ConciergeController } from './concierge.controller';
import { ContextModule } from '../context/context.module';
import { AgentsModule } from '../agents/agents.module';
import{PlaceDiscoveryService}from'./place-discovery.service';
import{ExkoSemanticModule}from'../exko-semantic/exko-semantic.module';

@Module({
  imports: [ContextModule, AgentsModule,ExkoSemanticModule],
  providers: [ConciergeService,PlaceDiscoveryService],
  controllers: [ConciergeController],
})
export class ConciergeModule {}
