import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { ContextModule } from '../context/context.module';
import { SeedModule } from '../seed/seed.module';
import { OntologyModule } from '../ontology/ontology.module';
import { DecisionPipelineService } from './decision-pipeline.service';
import { MasterDataModule } from '../master-data/master-data.module';
import { RegionalDataModule } from '../regional-data/regional-data.module';

@Module({
  imports: [ContextModule, SeedModule, OntologyModule, MasterDataModule,RegionalDataModule],
  providers: [RecommendationService, DecisionPipelineService],
  controllers: [RecommendationController],
  exports: [RecommendationService, DecisionPipelineService],
})
export class RecommendationModule {}
