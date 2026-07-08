import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExecutionLog, ExecutionLogDocument } from '../schemas/execution-log.schema';
import { SemanticPlannerService, PlannedTask } from '../planner/semantic-planner.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { ReservationService } from '../reservation/reservation.service';
import { GraphTraversalService } from '../context/graph-traversal.service';

export interface OrchestratorRunResult {
  operationUri: string;
  tasks: PlannedTask[];
  executionLog: {
    taskUri: string;
    taskLabel: string;
    agentUri?: string;
    agentLabel?: string;
    status: 'completed' | 'failed' | 'skipped';
    output: Record<string, any>;
  }[];
  recommendation?: any;
  reservationCheck?: any;
}

/**
 * AgentOrchestratorService: executes the roo:Task pipeline planned by
 * SemanticPlannerService for a given RuntimeContext + gajo:ConciergeOperation,
 * in declared order, maintaining an operation-level execution log for each
 * Agent invocation (roo:ExecutionResult equivalent). This is the
 * "Agent Selection -> Tool/API Execution" step of the architecture.
 *
 * Each Task is mapped to a concrete backend action by local-name
 * convention against the seeded gajo:*Task individuals:
 *   - createWellnessContextTask  -> already done by RuntimeContextService (context is the input)
 *   - checkWeatherImpactTask     -> GraphTraversalService.findEnvironmentAffected
 *   - evaluateSafetyRiskTask     -> risks already resolved on the context; logged here
 *   - recommendItineraryTask     -> RecommendationService.buildRecommendation
 *   - checkReservationAvailabilityTask -> ReservationService.checkAvailability for the recommended facilities
 *
 * New Tasks added to the ontology are executed with a generic "log only"
 * fallback so the pipeline never hard-fails on an unmapped Task.
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  constructor(
    @InjectModel(ExecutionLog.name) private logModel: Model<ExecutionLogDocument>,
    private readonly planner: SemanticPlannerService,
    private readonly recommendationService: RecommendationService,
    private readonly reservationService: ReservationService,
    private readonly traversal: GraphTraversalService,
  ) {}

  async run(runtimeContextId: string, operationUri: string, contextDoc: any): Promise<OrchestratorRunResult> {
    const tasks = this.planner.planTasksForOperation(operationUri);
    const executionLog: OrchestratorRunResult['executionLog'] = [];
    let recommendation: any;
    let reservationCheck: any;

    for (const task of tasks) {
      const localName = task.taskUri.split('#').pop() || '';
      const start = Date.now();
      let status: 'completed' | 'failed' | 'skipped' = 'completed';
      let output: Record<string, any> = {};

      try {
        if (localName === 'createWellnessContextTask') {
          output = {
            note: '런타임 맥락은 RuntimeContextService에서 이미 생성됨',
            healthConditions: contextDoc.healthConditions,
            expandedConditions: contextDoc.expandedConditions,
          };
        } else if (localName === 'checkWeatherImpactTask') {
          const affected = this.traversal.findEnvironmentAffected(contextDoc.environmentConditions || []);
          output = { affected: affected.map((a) => ({ uri: a.uri, label: this.traversal.label(a.uri) })) };
        } else if (localName === 'evaluateSafetyRiskTask') {
          output = {
            risks: (contextDoc.risks || []).map((r: string) => ({ uri: r, label: this.traversal.label(r) })),
          };
        } else if (localName === 'recommendItineraryTask') {
          recommendation = await this.recommendationService.buildRecommendation(contextDoc);
          output = { recommendationNo: recommendation.recommendationNo };
        } else if (localName === 'checkReservationAvailabilityTask') {
          const facilities = recommendation?.recommendedFacilities || [];
          reservationCheck = await Promise.all(
            facilities.map((f: string) => this.reservationService.checkAvailability(f)),
          );
          output = { reservationCheck };
        } else {
          status = 'skipped';
          output = { note: `Task ${localName}에 대한 실행 매핑이 정의되지 않아 건너뜀` };
        }
      } catch (e: any) {
        status = 'failed';
        output = { error: e?.message || String(e) };
        this.logger.error(`Task ${localName} failed: ${e?.message}`, e?.stack);
      }

      const durationMs = Date.now() - start;
      await this.logModel.create({
        runtimeContextId,
        operationUri,
        taskUri: task.taskUri,
        taskLabel: task.taskLabel,
        agentUri: task.assignedAgentUri || 'unassigned',
        agentLabel: task.assignedAgentLabel,
        toolsUsed: [],
        status,
        output,
        durationMs,
      });

      executionLog.push({
        taskUri: task.taskUri,
        taskLabel: task.taskLabel,
        agentUri: task.assignedAgentUri,
        agentLabel: task.assignedAgentLabel,
        status,
        output,
      });
    }

    return { operationUri, tasks, executionLog, recommendation, reservationCheck };
  }

  async getLogsForContext(runtimeContextId: string) {
    return this.logModel.find({ runtimeContextId }).sort({ createdAt: 1 }).lean();
  }

  async getAllLogs(limit = 100) {
    return this.logModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
}
