import { Module } from '@nestjs/common';
import { PolicyRuleService } from './policy-rule.service';
import { PolicyController } from './policy.controller';
import { SeedModule } from '../seed/seed.module';
import { ContextModule } from '../context/context.module';

@Module({
  imports: [SeedModule, ContextModule],
  providers: [PolicyRuleService],
  controllers: [PolicyController],
  exports: [PolicyRuleService],
})
export class PolicyModule {}
