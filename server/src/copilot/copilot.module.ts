import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CopilotCandidate,
  CopilotCandidateSchema,
} from './copilot-candidate.schema';
import { CopilotAuthGuard, CopilotAuthService } from './copilot-auth';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import {
  CopilotAssignment,
  CopilotAssignmentSchema,
} from './copilot-assignment.schema';
import {
  CoreDestination,
  CoreDestinationSchema,
} from './core-destination.schema';
import { ExkoSemanticModule } from '../exko-semantic/exko-semantic.module';
@Global()
@Module({
  imports: [
    ExkoSemanticModule,
    MongooseModule.forFeature([
      { name: CopilotCandidate.name, schema: CopilotCandidateSchema },
      { name: CopilotAssignment.name, schema: CopilotAssignmentSchema },
      { name: CoreDestination.name, schema: CoreDestinationSchema },
    ]),
  ],
  providers: [CopilotService, CopilotAuthService, CopilotAuthGuard],
  controllers: [CopilotController],
  exports: [CopilotService],
})
export class CopilotModule {}
