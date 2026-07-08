import { Body, Controller, Get, Post } from '@nestjs/common';
import { PolicyRuleService } from './policy-rule.service';

@Controller('api')
export class PolicyController {
  constructor(private readonly service: PolicyRuleService) {}

  @Get('policies')
  listPolicies() {
    return this.service.listPolicies();
  }

  @Get('rules')
  listRules() {
    return this.service.listRules();
  }

  @Post('rules/evaluate')
  evaluate(@Body() body: { conditionUris: string[] }) {
    return this.service.evaluate(body.conditionUris || []);
  }
}
