import { Module } from '@nestjs/common';
import { SemanticPlannerService } from './semantic-planner.service';
import { ContextModule } from '../context/context.module';
import { OntologyModule } from '../ontology/ontology.module';

@Module({
  imports: [ContextModule, OntologyModule],
  providers: [SemanticPlannerService],
  exports: [SemanticPlannerService],
})
export class PlannerModule {}
