import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { ExecutionLog, ExecutionLogSchema } from '../schemas/execution-log.schema';
import { PlannerModule } from '../planner/planner.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { ReservationModule } from '../reservation/reservation.module';
import { ContextModule } from '../context/context.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExecutionLog.name, schema: ExecutionLogSchema }]),
    PlannerModule,
    RecommendationModule,
    ReservationModule,
    ContextModule,
  ],
  providers: [AgentOrchestratorService],
  exports: [AgentOrchestratorService],
})
export class AgentsModule {}
