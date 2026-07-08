import { Module } from '@nestjs/common';
import { GraphTraversalService } from './graph-traversal.service';
import { RuntimeContextService } from './runtime-context.service';
import { ContextController } from './context.controller';
import { OntologyModule } from '../ontology/ontology.module';
import { SeedModule } from '../seed/seed.module';

@Module({
  imports: [OntologyModule, SeedModule],
  providers: [GraphTraversalService, RuntimeContextService],
  controllers: [ContextController],
  exports: [GraphTraversalService, RuntimeContextService],
})
export class ContextModule {}
