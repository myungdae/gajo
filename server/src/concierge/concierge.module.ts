import { Module } from '@nestjs/common';
import { ConciergeService } from './concierge.service';
import { ConciergeController } from './concierge.controller';
import { ContextModule } from '../context/context.module';
import { AgentsModule } from '../agents/agents.module';
import{PlaceDiscoveryService}from'./place-discovery.service';
import{ExkoSemanticModule}from'../exko-semantic/exko-semantic.module';
import{NearbyModule}from'../nearby/nearby.module';

@Module({
  imports: [ContextModule, AgentsModule,ExkoSemanticModule,NearbyModule],
  providers: [ConciergeService,PlaceDiscoveryService],
  controllers: [ConciergeController],
})
export class ConciergeModule {}
