import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Recommendation, RecommendationDocument } from '../schemas/recommendation.schema';
import { Itinerary, ItineraryDocument } from '../schemas/itinerary.schema';
import { GraphTraversalService } from '../context/graph-traversal.service';
import { TraversalStep } from '../ontology/ontology-graph.service';
import { roo } from '../ontology/ontology.constants';
import { DecisionPipelineService } from './decision-pipeline.service';
import type { EntityRuntimeState } from '../context/runtime-context.types';
import { EntityLocationService } from '../context/entity-location.service';
import { MasterDataService } from '../master-data/master-data.service';
import { isOperationalLocation } from '../context/location-confidence';

/** Ontology candidates are hydrated with runtime observations, then pass Feasibility -> Suitability -> Sequence -> Explanation. */
@Injectable()
export class RecommendationService {
  constructor(
    @InjectModel(Recommendation.name) private recModel: Model<RecommendationDocument>,
    @InjectModel(Itinerary.name) private itineraryModel: Model<ItineraryDocument>,
    private readonly traversal: GraphTraversalService,
    private readonly decisionPipeline: DecisionPipelineService,
    private readonly locations: EntityLocationService,
    private readonly masterData: MasterDataService,
  ) {}

  async buildRecommendation(contextDoc: any) {
    const conditionSeeds: string[] = [...(contextDoc.healthConditions || []), ...(contextDoc.wellnessGoals || [])];
    const expanded: string[] = contextDoc.expandedConditions || [];
    const environment: string[] = contextDoc.environmentConditions || [];
    const risks: string[] = contextDoc.risks || [];
    const suitable = this.traversal.findSuitablePrograms([...conditionSeeds, ...expanded]);
    const envAffected = this.traversal.findEnvironmentAffected(environment);
    const envAffectedUris = new Set(envAffected.map((item) => item.uri));
    const mitigations = this.traversal.findRiskMitigations(risks);
    const mitigationMap = new Map(mitigations.map((item) => [item.uri, item.matchedOn]));
    const runtimeStateMap = new Map<string, EntityRuntimeState>(
      (contextDoc.runtimeStates || []).map((state: EntityRuntimeState) => [state.entityUri, state]),
    );

    const candidates = suitable.map((item) => {
      const props = this.traversal.objectProps(item.programUri);
      const literals = this.traversal.literalProps(item.programUri);
      const facilityUri = (props.heldAtFacility || [])[0];
      const facilityLiterals = facilityUri ? this.traversal.literalProps(facilityUri) : {};
      const mitigatesRisk = mitigationMap.get(item.programUri) || mitigationMap.get(facilityUri) || [];
      const coordinates = this.locations.coordinatesFor(item.programUri, facilityUri);
      const origin = isOperationalLocation(contextDoc) ? { latitude: contextDoc.latitude, longitude: contextDoc.longitude } : undefined;
      const distance = this.locations.distance(origin, coordinates);
      return {
        programUri: item.programUri,
        programLabel: this.traversal.label(item.programUri),
        facilityUri,
        facilityLabel: facilityUri ? this.traversal.label(facilityUri) : undefined,
        matchedOn: item.matchedOn,
        matchedLabels: item.matchedOn.map((uri) => this.traversal.label(uri)),
        mitigatesRisk,
        mitigationLabels: mitigatesRisk.map((uri) => this.traversal.label(uri)),
        requiredMobility: props.requiresMobilityCondition || [],
        affectedByEnvironment: envAffectedUris.has(item.programUri) ? environment : [],
        durationMinutes: literals.durationMinutes ? Number.parseInt(literals.durationMinutes, 10) : undefined,
        requiresReservation: literals.requiresReservation === 'true' || facilityLiterals.requiresReservation === 'true',
        isIndoor: facilityLiterals.isIndoor === undefined ? undefined : facilityLiterals.isIndoor === 'true',
        isAccessible: facilityLiterals.isAccessible === undefined ? undefined : facilityLiterals.isAccessible === 'true',
        isMeal: /FoodProgram|Meal|Food/i.test(item.programUri),
        runtime: runtimeStateMap.get(item.programUri) || (facilityUri ? runtimeStateMap.get(facilityUri) : undefined) || (facilityUri ? { entityUri: facilityUri, ...this.masterData.deriveOperatingState(facilityUri, contextDoc.dayOfWeek, contextDoc.currentTime, contextDoc.currentDate) } : undefined),
        coordinates, ...distance, estimatedTravelMinutes: this.locations.estimateTravelMinutes(distance.distanceMeters, contextDoc.transportMode),
      };
    });

    const decision = this.decisionPipeline.run(candidates, {
      currentTime: contextDoc.currentTime,
      stayUntil: contextDoc.stayUntil,
      environmentConditions: environment,
      expandedConditions: expanded,
      walkingLevel: contextDoc.walkingLevel,
      latitude: isOperationalLocation(contextDoc)?contextDoc.latitude:undefined, longitude: isOperationalLocation(contextDoc)?contextDoc.longitude:undefined, transportMode: contextDoc.transportMode,
      maxWalkingDistanceMeters: contextDoc.maxWalkingDistanceMeters,
    });
    const top = decision.sequenced.slice(0, 4);

    const evidence: TraversalStep[] = [];
    for (const item of top) {
      for (const matchedUri of item.matchedOn) evidence.push({
        subject: item.programUri, subjectLabel: item.programLabel, predicate: 'suitableFor',
        predicateLabel: '적합하다', object: matchedUri, objectLabel: this.traversal.label(matchedUri),
      });
      for (const riskUri of item.mitigatesRisk) evidence.push({
        subject: item.programUri, subjectLabel: item.programLabel, predicate: roo('mitigatesRisk'),
        predicateLabel: '위험을 완화한다', object: riskUri, objectLabel: this.traversal.label(riskUri),
      });
    }
    for (const affected of envAffected) evidence.push({
      subject: affected.uri, subjectLabel: this.traversal.label(affected.uri), predicate: 'affectedByEnvironment',
      predicateLabel: '환경의 영향을 받는다', object: affected.matchedOn[0], objectLabel: this.traversal.label(affected.matchedOn[0]),
    });

    const itineraryNo = `IT-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const confidenceScore = Math.min(0.5 + top.length * 0.1 + (mitigations.length ? 0.1 : 0), 0.98);
    const itinerary = await this.itineraryModel.create({
      itineraryNo, runtimeContextId: contextDoc.contextNo, label: `${contextDoc.contextNo} 기반 추천 일정`,
      steps: top.map((item, index) => ({ itemId: `STEP-${randomUUID().slice(0, 8)}`, order: index + 1, label: `${index + 1}단계: ${item.programLabel}`,
        facilityUri: item.facilityUri || 'unknown', facilityLabel: item.facilityLabel, programUri: item.programUri,
        programLabel: item.programLabel, durationMinutes: item.durationMinutes,
        requiresReservation: item.requiresReservation, status: 'PLANNED', distanceMeters: item.distanceMeters, estimatedTravelMinutes: item.estimatedTravelMinutes })),
      confidenceScore, risks,
    });

    const recommendationNo = `REC-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const decisionStages = {
      feasibility: { feasible: decision.feasible.map((c) => c.programUri), rejected: decision.rejected.map((r) => ({ programUri: r.candidate.programUri, reasons: r.reasons, reasonCodes: r.reasonCodes })) },
      suitability: decision.ranked.map((c) => ({ programUri: c.programUri, score: c.score })),
      sequence: top.map((c, index) => ({ programUri: c.programUri, order: index + 1 })),
      explanation: decision.reasonSummary,
    };
    const rec = await this.recModel.create({
      recommendationNo, runtimeContextId: contextDoc.contextNo, itineraryNo,
      recommendedPrograms: top.map((item) => item.programUri),
      recommendedFacilities: top.map((item) => item.facilityUri).filter((uri): uri is string => Boolean(uri)),
      reasonSummary: decision.reasonSummary, evidence, risks, decisionMadeBy: [roo('semanticPlannerAgent')],
      confidenceScore, nextAction: 'reservation', decisionStages,
    });
    return { ...rec.toObject(), itinerary: itinerary.toObject() };
  }

  getRecommendation(recommendationNo: string) { return this.recModel.findOne({ recommendationNo }).lean(); }
  getItinerary(itineraryNo: string) { return this.itineraryModel.findOne({ itineraryNo }).lean(); }
  listRecommendations(limit = 50) { return this.recModel.find().sort({ createdAt: -1 }).limit(limit).lean(); }
}
