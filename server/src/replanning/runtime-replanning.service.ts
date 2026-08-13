import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import { Itinerary, ItineraryDocument } from '../schemas/itinerary.schema';
import { ReplanningProposal, ReplanningProposalDocument } from '../schemas/replanning-proposal.schema';
import { RuntimeChangeDetectorService } from './runtime-change-detector.service';
import { ImpactAssessmentService, AssessedImpact } from './impact-assessment.service';
import { DecisionPipelineService, DecisionCandidate } from '../recommendation/decision-pipeline.service';
import { GraphTraversalService } from '../context/graph-traversal.service';
import { RuntimeContextService } from '../context/runtime-context.service';
import type { EntityRuntimeState, RuntimeChangeEvent } from '../context/runtime-context.types';
import { CLASS } from '../ontology/ontology.constants';
import type { CandidateRejectionCode } from '../recommendation/decision-pipeline.service';

@Injectable()
export class RuntimeReplanningService {
  constructor(
    @InjectModel(Itinerary.name) private readonly itineraryModel: Model<ItineraryDocument>,
    @InjectModel(ReplanningProposal.name) private readonly proposalModel: Model<ReplanningProposalDocument>,
    private readonly detector: RuntimeChangeDetectorService,
    private readonly impactService: ImpactAssessmentService,
    private readonly pipeline: DecisionPipelineService,
    private readonly traversal: GraphTraversalService,
    private readonly contextService: RuntimeContextService,
  ) {}

  async observeRuntime(previousContext: any, currentContext: any, itinerary: any) {
    const events = this.detector.detect(previousContext, currentContext);
    const impacts = events.map((event) => this.impactService.assess(event, itinerary, currentContext));
    const actionable = impacts.filter((impact) => ['HIGH', 'CRITICAL'].includes(impact.level));
    if (!actionable.length) return { events, impacts, replanningRecommended: false, proposedRevision: null };
    const suppressionKey = this.fingerprint(events, actionable, currentContext);
    const suppressed = await this.proposalModel.findOne({ suppressionKey, status: 'REJECTED' }).lean();
    if (suppressed) return { events, impacts, replanningRecommended: false, proposedRevision: null, suppressed: true };
    const proposedRevision = await this.propose(previousContext, currentContext, itinerary, events, actionable, suppressionKey);
    return { events, impacts, replanningRecommended: true, proposedRevision };
  }

  async observeById(input: { previousContextNo: string; currentContextNo: string; itineraryNo: string }) {
    const [previousContext, currentContext, itinerary] = await Promise.all([
      this.contextService.getContext(input.previousContextNo), this.contextService.getContext(input.currentContextNo),
      this.itineraryModel.findOne({ itineraryNo: input.itineraryNo }).lean(),
    ]);
    if (!previousContext || !currentContext || !itinerary) throw new NotFoundException('런타임 컨텍스트 또는 일정을 찾을 수 없습니다.');
    return this.observeRuntime(previousContext, currentContext, itinerary);
  }

  private async propose(previousContext: any, currentContext: any, itinerary: any, events: RuntimeChangeEvent[], impacts: AssessedImpact[], suppressionKey: string) {
    const history = (itinerary.steps || []).filter((step: any) => step.status === 'COMPLETED' || step.status === 'SKIPPED');
    const impactedIds = new Set(impacts.flatMap((impact) => impact.affectedItems.map((step) => step.itemId || String(step.order))));
    const inProgress = (itinerary.steps || []).filter((step: any) => step.status === 'IN_PROGRESS' && !impactedIds.has(step.itemId || String(step.order)));
    const removedItems = (itinerary.steps || []).filter((step: any) => step.status !== 'COMPLETED' && step.status !== 'SKIPPED' && impactedIds.has(step.itemId || String(step.order)));
    const unaffectedFuture = (itinerary.steps || []).filter((step: any) => step.status === 'PLANNED' && !impactedIds.has(step.itemId || String(step.order)));
    const excludedPrograms = new Set([...history, ...removedItems].map((step: any) => step.programUri).filter(Boolean));
    const excludedFacilities = new Set(history.map((step: any) => step.facilityUri).filter(Boolean));
    const requiresIndoor = events.some((event) => event.eventType === 'HEAVY_RAIN');
    const candidateDiagnostics: any[] = [];
    const candidates = this.buildCandidates(currentContext).filter((candidate) => {
      const codes: CandidateRejectionCode[] = [];
      const facilityOnlyCandidate = candidate.programUri === candidate.facilityUri;
      if (excludedPrograms.has(candidate.programUri) || (facilityOnlyCandidate && candidate.facilityUri && excludedFacilities.has(candidate.facilityUri))) codes.push('DUPLICATE');
      if (requiresIndoor && candidate.isIndoor !== true) codes.push('WEATHER_INCOMPATIBLE');
      if (codes.length) {
        candidateDiagnostics.push({ candidateUri: candidate.programUri, label: candidate.programLabel, accepted: false, reasonCodes: codes });
        return false;
      }
      return true;
    });
    const decision = this.pipeline.run(candidates, {
      currentTime: currentContext.currentTime, stayUntil: currentContext.stayUntil,
      environmentConditions: currentContext.environmentConditions || [], expandedConditions: currentContext.expandedConditions || [],
      walkingLevel: currentContext.walkingLevel,
    });
    candidateDiagnostics.push(...decision.rejected.map((rejection) => ({ candidateUri: rejection.candidate.programUri, label: rejection.candidate.programLabel, accepted: false, reasonCodes: rejection.reasonCodes, reasons: rejection.reasons })));
    const existingFuturePrograms = new Set(unaffectedFuture.map((step: any) => step.programUri));
    const alternatives = decision.sequenced.filter((candidate) => !existingFuturePrograms.has(candidate.programUri)).slice(0, Math.max(1, removedItems.length));
    candidateDiagnostics.push(...alternatives.map((candidate) => ({ candidateUri: candidate.programUri, label: candidate.programLabel, accepted: true, reasonCodes: [] })));
    const proposedNewItems = alternatives.map((candidate, index) => this.toStep(candidate, index + 1));
    const proposedFutureSteps = [...inProgress, ...unaffectedFuture, ...proposedNewItems].map((step: any, index) => ({ ...step, order: history.length + index + 1 }));
    const triggerEvent = impacts.sort((a, b) => this.impactRank(b.level) - this.impactRank(a.level))[0].event;
    const explanation = this.explain(triggerEvent, impacts, removedItems, proposedNewItems, currentContext, decision.reasonSummary);
    return this.proposalModel.create({
      proposalNo: `RPL-${Date.now()}-${randomUUID().slice(0, 6)}`, itineraryNo: itinerary.itineraryNo,
      previousContextNo: previousContext.contextNo, currentContextNo: currentContext.contextNo,
      status: 'PENDING_APPROVAL', triggerEvent, impacts, preservedHistory: history, proposedFutureSteps,
      removedItems, proposedNewItems, candidateDiagnostics, explanation, evidence: [
        ...impacts.flatMap((impact) => impact.evidence),
        ...alternatives.flatMap((candidate) => candidate.matchedOn.map((matched, index) => ({ subject: candidate.programUri, subjectLabel: candidate.programLabel, predicate: 'suitableFor', object: matched, objectLabel: candidate.matchedLabels[index] }))),
      ],
      generatedAt: new Date().toISOString(), suppressionKey,
    });
  }

  async approve(proposalNo: string) {
    const proposal = await this.proposalModel.findOne({ proposalNo });
    if (!proposal) throw new NotFoundException('재계획 제안을 찾을 수 없습니다.');
    if (proposal.status !== 'PENDING_APPROVAL') return proposal.toObject();
    const itinerary = await this.itineraryModel.findOne({ itineraryNo: proposal.itineraryNo });
    if (!itinerary) throw new NotFoundException('일정을 찾을 수 없습니다.');
    const immutable = itinerary.steps.filter((step: any) => step.status === 'COMPLETED' || step.status === 'SKIPPED');
    const immutableIds = new Set(immutable.map((step: any) => step.itemId).filter(Boolean));
    const stillFuture = proposal.proposedFutureSteps.filter((step: any) => !step.itemId || !immutableIds.has(step.itemId));
    itinerary.steps = [...immutable.map((step: any) => step.toObject ? step.toObject() : step), ...stillFuture]
      .map((step: any, index) => ({ ...step, order: index + 1 })) as any;
    await itinerary.save();
    proposal.status = 'APPROVED';
    await proposal.save();
    return { proposal: proposal.toObject(), itinerary: itinerary.toObject() };
  }

  async reject(proposalNo: string) {
    const proposal = await this.proposalModel.findOne({ proposalNo });
    if (!proposal) throw new NotFoundException('재계획 제안을 찾을 수 없습니다.');
    if (proposal.status === 'PENDING_APPROVAL') { proposal.status = 'REJECTED'; await proposal.save(); }
    return proposal.toObject();
  }

  private buildCandidates(context: any): DecisionCandidate[] {
    const suitable = this.traversal.findSuitablePrograms([...(context.healthConditions || []), ...(context.wellnessGoals || []), ...(context.expandedConditions || [])]);
    const runtime = new Map<string, EntityRuntimeState>((context.runtimeStates || []).map((state: EntityRuntimeState) => [state.entityUri, state]));
    const programCandidates = suitable.map((item) => {
      const props = this.traversal.objectProps(item.programUri); const literals = this.traversal.literalProps(item.programUri);
      const facilityUri = (props.heldAtFacility || [])[0]; const facility = facilityUri ? this.traversal.literalProps(facilityUri) : {};
      return { programUri: item.programUri, programLabel: this.traversal.label(item.programUri), facilityUri,
        facilityLabel: facilityUri ? this.traversal.label(facilityUri) : undefined, matchedOn: item.matchedOn,
        matchedLabels: item.matchedOn.map((uri) => this.traversal.label(uri)), mitigatesRisk: [], mitigationLabels: [],
        requiredMobility: props.requiresMobilityCondition || [], affectedByEnvironment: props.affectedByEnvironment || [],
        durationMinutes: literals.durationMinutes ? Number(literals.durationMinutes) : undefined, requiresReservation: literals.requiresReservation === 'true' || facility.requiresReservation === 'true',
        isIndoor: literals.isIndoor === 'true' || facility.isIndoor === 'true', isAccessible: literals.isAccessible === 'true' || facility.isAccessible === 'true', isMeal: /Food|Meal/i.test(item.programUri),
        runtime: runtime.get(item.programUri) || runtime.get(facilityUri) };
    });
    const facilityUris = new Set(this.traversal.individualsOfIncludingSubclasses?.(CLASS.Facility) || []);
    const facilityCandidates: DecisionCandidate[] = (this.traversal.findRiskMitigations?.(context.risks || []) || [])
      .filter((item: any) => facilityUris.has(item.uri))
      .map((item: any) => {
        const literals = this.traversal.literalProps(item.uri);
        return { programUri: item.uri, programLabel: this.traversal.label(item.uri), facilityUri: item.uri,
          facilityLabel: this.traversal.label(item.uri), matchedOn: item.matchedOn, matchedLabels: item.matchedOn.map((uri: string) => this.traversal.label(uri)),
          mitigatesRisk: item.matchedOn, mitigationLabels: item.matchedOn.map((uri: string) => this.traversal.label(uri)), requiredMobility: [],
          affectedByEnvironment: [], durationMinutes: undefined, requiresReservation: literals.requiresReservation === 'true',
          isIndoor: literals.isIndoor === 'true', isAccessible: literals.isAccessible === 'true', runtime: runtime.get(item.uri) };
      });
    return [...programCandidates, ...facilityCandidates];
  }

  private toStep(candidate: DecisionCandidate, order: number) { return { itemId: `STEP-${randomUUID().slice(0, 8)}`, order, label: `${order}단계: ${candidate.programLabel}`, facilityUri: candidate.facilityUri || 'unknown', facilityLabel: candidate.facilityLabel, programUri: candidate.programUri, programLabel: candidate.programLabel, durationMinutes: candidate.durationMinutes, requiresReservation: candidate.requiresReservation, status: 'PLANNED' }; }
  private impactRank(level: string) { return ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(level); }
  private fingerprint(events: RuntimeChangeEvent[], impacts: AssessedImpact[], context: any) { const value = { events: events.map((e) => [e.eventType, e.entityUri, e.currentValue]), items: impacts.flatMap((i) => i.affectedItems.map((s) => s.itemId || s.order)).sort(), precipitation: context.precipitation, states: context.runtimeStates }; return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
  private explain(event: RuntimeChangeEvent, impacts: AssessedImpact[], removed: any[], added: any[], context: any, decisionReason: string) {
    const affectedLabel = removed[0]?.programLabel || removed[0]?.facilityLabel || removed[0]?.label || '예정된 활동';
    const change = event.eventType === 'HEAVY_RAIN' ? `강수량 ${event.currentValue}mm의 강한 비가 관측되었습니다` : event.eventType === 'WEATHER_CHANGED' ? '현재 날씨가 야외 활동에 적합하지 않은 상태로 바뀌었습니다' : event.eventType === 'FACILITY_UNAVAILABLE' ? `${affectedLabel}을(를) 현재 이용할 수 없습니다` : event.eventType === 'RESERVATION_UNAVAILABLE' ? '필수 예약이 마감되었습니다' : '현재 상황이 변경되었습니다';
    const visitor = (context.expandedConditions || []).some((u: string) => /shortWalkingDistance|limitedMobility/.test(u)) ? '동반자의 무릎 부담과 짧은 보행 필요를 고려하면' : '현재 방문객 조건을 고려하면';
    const affected = removed.map((step) => step.programLabel || step.label).join(', ') || impacts.flatMap((i) => i.affectedItems.map((s) => s.programLabel || s.label)).join(', ');
    const alternative = added.map((step) => step.programLabel || step.label).join(', ') || '이용 가능한 실내 일정';
    return `${change}. ${visitor} ${affected} 일정은 현재 적합하지 않습니다. 대신 ${alternative}을(를) 제안합니다. ${decisionReason} 변경하시겠어요?`;
  }
}
