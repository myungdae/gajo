import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CopilotCandidate, CopilotCandidateSchema } from './copilot-candidate.schema';
import { CopilotAuthGuard, CopilotAuthService } from './copilot-auth';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { CopilotAssignment, CopilotAssignmentSchema } from './copilot-assignment.schema';
@Global()@Module({imports:[MongooseModule.forFeature([{name:CopilotCandidate.name,schema:CopilotCandidateSchema},{name:CopilotAssignment.name,schema:CopilotAssignmentSchema}])],providers:[CopilotService,CopilotAuthService,CopilotAuthGuard],controllers:[CopilotController],exports:[CopilotService]})
export class CopilotModule{}
