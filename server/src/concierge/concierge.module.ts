import { Module } from '@nestjs/common';
import { ConciergeService } from './concierge.service';
import { ConciergeController } from './concierge.controller';
import { ContextModule } from '../context/context.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [ContextModule, AgentsModule],
  providers: [ConciergeService],
  controllers: [ConciergeController],
})
export class ConciergeModule {}
