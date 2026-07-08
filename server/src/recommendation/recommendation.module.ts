import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { ContextModule } from '../context/context.module';
import { SeedModule } from '../seed/seed.module';
import { OntologyModule } from '../ontology/ontology.module';

@Module({
  imports: [ContextModule, SeedModule, OntologyModule],
  providers: [RecommendationService],
  controllers: [RecommendationController],
  exports: [RecommendationService],
})
export class RecommendationModule {}
