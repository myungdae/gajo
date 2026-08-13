import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReplanningProposal, ReplanningProposalSchema } from '../schemas/replanning-proposal.schema';
import { SeedModule } from '../seed/seed.module';
import { ContextModule } from '../context/context.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { RuntimeChangeDetectorService } from './runtime-change-detector.service';
import { ImpactAssessmentService } from './impact-assessment.service';
import { RuntimeReplanningService } from './runtime-replanning.service';
import { ReplanningController } from './replanning.controller';

@Module({
  imports: [SeedModule, ContextModule, RecommendationModule, MongooseModule.forFeature([{ name: ReplanningProposal.name, schema: ReplanningProposalSchema }])],
  providers: [RuntimeChangeDetectorService, ImpactAssessmentService, RuntimeReplanningService],
  controllers: [ReplanningController],
  exports: [RuntimeReplanningService],
})
export class ReplanningModule {}
