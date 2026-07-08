import { Injectable } from '@nestjs/common';
import { RuntimeContextService, CreateContextInput } from '../context/runtime-context.service';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { GraphTraversalService } from '../context/graph-traversal.service';

/**
 * ConciergeService: the top-level Orchestrator Agent entry point that
 * implements the full architecture pipeline from the spec:
 *
 *   User Request -> Orchestrator Agent -> Runtime Operational Ontology ->
 *   Semantic Context Generation -> Graph Traversal -> Task Decomposition ->
 *   Agent Selection -> Tool/API Execution -> Recommendation ->
 *   User-facing Concierge Response
 *
 * `chat()` is what POST /api/concierge/chat calls: it takes a raw user
 * message (+ optional structured hints), builds a RuntimeContext, runs the
 * Agent pipeline for the selected Operation, and returns an explainable,
 * user-facing concierge answer (itinerary + reason + risks + used agents +
 * confidence + next action) exactly as required by the demo scenario.
 */
@Injectable()
export class ConciergeService {
  constructor(
    private readonly contextService: RuntimeContextService,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly traversal: GraphTraversalService,
  ) {}

  async chat(input: CreateContextInput) {
    const { context, evidence, firedRules } = await this.contextService.createContext(input);

    if (!context.operationUri) {
      return {
        context,
        evidence,
        firedRules,
        message: '적용 가능한 컨시어지 운영(Operation)을 찾지 못했습니다. 온톨로지에 gajo:ConciergeOperation을 확인해주세요.',
      };
    }

    const runResult = await this.orchestrator.run(context.contextNo, context.operationUri, context);

    const usedAgents = Array.from(
      new Set(runResult.tasks.map((t) => t.assignedAgentUri).filter(Boolean)),
    ) as string[];

    return {
      context,
      evidence,
      firedRules,
      operation: {
        uri: context.operationUri,
        label: this.traversal.label(context.operationUri),
      },
      tasks: runResult.tasks,
      executionLog: runResult.executionLog,
      recommendation: runResult.recommendation,
      reservationCheck: runResult.reservationCheck,
      usedAgents: usedAgents.map((a) => ({ uri: a, label: this.traversal.label(a) })),
      risks: (context.risks || []).map((r: string) => ({ uri: r, label: this.traversal.label(r) })),
      confidenceScore: runResult.recommendation?.confidenceScore || 0,
      nextAction: runResult.recommendation?.nextAction || null,
    };
  }
}
