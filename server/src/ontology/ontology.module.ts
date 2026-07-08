import { Module } from '@nestjs/common';
import { OntologyGraphService } from './ontology-graph.service';
import { OntologyController } from './ontology.controller';

@Module({
  controllers: [OntologyController],
  providers: [OntologyGraphService],
  exports: [OntologyGraphService],
})
export class OntologyModule {}
