import { Injectable, Logger } from '@nestjs/common';
import { RuntimeContextService } from '../context/runtime-context.service';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';

/**
 * DemoSeedService: reproduces the exact demo scenario from the spec
 * ("이번 토요일에 어머니를 모시고...") as a one-call POST endpoint, so the
 * required demo can be exercised without manually constructing the
 * request body. NOTE: this is a thin convenience wrapper — all real logic
 * lives in RuntimeContextService / AgentOrchestratorService.
 */
@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private readonly contextService: RuntimeContextService,
    private readonly orchestrator: AgentOrchestratorService,
  ) {}

  async runDemoScenario() {
    const message =
      '이번 토요일에 어머니를 모시고 가조온천에 하루 다녀오려고 합니다. 어머니는 78세이고 무릎이 좋지 않습니다. 비가 올 것 같고 사람이 많을까 걱정됩니다.';
    const { context, evidence, firedRules } = await this.contextService.createContext({
      rawMessage: message,
      visitorAge: 58,
      wellnessGoals: ['familyHealingTrip'],
      companions: [{ age: 78, relationship: 'mother', healthConditions: ['kneePain', 'limitedMobility'] }],
      weather: 'rainyWeather',
      congestion: 'highCongestion',
    });

    if (!context.operationUri) {
      return { context, evidence, firedRules, error: 'no operation resolved' };
    }

    const runResult = await this.orchestrator.run(context.contextNo, context.operationUri, context);
    return { context, evidence, firedRules, runResult };
  }
}
