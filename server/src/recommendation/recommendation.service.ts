import { Injectable,Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  Recommendation,
  RecommendationDocument,
} from '../schemas/recommendation.schema';
import { Itinerary, ItineraryDocument } from '../schemas/itinerary.schema';
import { GraphTraversalService } from '../context/graph-traversal.service';
import { TraversalStep } from '../ontology/ontology-graph.service';
import { roo } from '../ontology/ontology.constants';
import { DecisionPipelineService } from './decision-pipeline.service';
import type { EntityRuntimeState } from '../context/runtime-context.types';
import { EntityLocationService } from '../context/entity-location.service';
import { MasterDataService } from '../master-data/master-data.service';
import { isOperationalLocation } from '../context/location-confidence';
import { regionalCandidateDataset } from '../regions/regional-candidate.registry';
import type { DecisionCandidate } from './decision-pipeline.service';
import { composeItinerary } from './itinerary-composition';
import { RegionalDataService } from '../regional-data/regional-data.service';

/** Ontology candidates are hydrated with runtime observations, then pass Feasibility -> Suitability -> Sequence -> Explanation. */
@Injectable()
export class RecommendationService {
  constructor(
    @InjectModel(Recommendation.name)
    private recModel: Model<RecommendationDocument>,
    @InjectModel(Itinerary.name)
    private itineraryModel: Model<ItineraryDocument>,
    private readonly traversal: GraphTraversalService,
    private readonly decisionPipeline: DecisionPipelineService,
    private readonly locations: EntityLocationService,
    private readonly masterData: MasterDataService,
    @Optional() private readonly regionalData?:RegionalDataService,
  ) {}

  async buildRecommendation(contextDoc: any) {
    const regionId = contextDoc.regionId || 'gajo';
    const conditionSeeds: string[] = [
      ...(contextDoc.healthConditions || []),
      ...(contextDoc.wellnessGoals || []),
    ];
    const expanded: string[] = contextDoc.expandedConditions || [];
    const environment: string[] = contextDoc.environmentConditions || [];
    const risks: string[] = contextDoc.risks || [];
    const suitable =
      regionId === 'gajo'
        ? this.traversal.findSuitablePrograms([...conditionSeeds, ...expanded])
        : [];
    const envAffected = this.traversal.findEnvironmentAffected(environment);
    const envAffectedUris = new Set(envAffected.map((item) => item.uri));
    const mitigations = this.traversal.findRiskMitigations(risks);
    const mitigationMap = new Map(
      mitigations.map((item) => [item.uri, item.matchedOn]),
    );
    const runtimeStateMap = new Map<string, EntityRuntimeState>(
      (contextDoc.runtimeStates || []).map((state: EntityRuntimeState) => [
        state.entityUri,
        state,
      ]),
    );

    const regionalDataset = this.regionalData?await this.regionalData.effectiveDataset(regionId):regionalCandidateDataset(regionId);
    const candidates: DecisionCandidate[] = regionalDataset
      ? this.buildRegionalCandidates(contextDoc, regionalDataset)
      : suitable.map((item) => {
          const props = this.traversal.objectProps(item.programUri);
          const literals = this.traversal.literalProps(item.programUri);
          const facilityUri = (props.heldAtFacility || [])[0];
          const facilityLiterals = facilityUri
            ? this.traversal.literalProps(facilityUri)
            : {};
          const mitigatesRisk =
            mitigationMap.get(item.programUri) ||
            mitigationMap.get(facilityUri) ||
            [];
          const coordinates = this.locations.coordinatesFor(
            item.programUri,
            facilityUri,
          );
          const origin = isOperationalLocation(contextDoc)
            ? { latitude: contextDoc.latitude, longitude: contextDoc.longitude }
            : undefined;
          const distance = this.locations.distance(origin, coordinates);
          return {
            programUri: item.programUri,
            programLabel: this.traversal.label(item.programUri),
            facilityUri,
            facilityLabel: facilityUri
              ? this.traversal.label(facilityUri)
              : undefined,
            matchedOn: item.matchedOn,
            matchedLabels: item.matchedOn.map((uri) =>
              this.traversal.label(uri),
            ),
            mitigatesRisk,
            mitigationLabels: mitigatesRisk.map((uri) =>
              this.traversal.label(uri),
            ),
            requiredMobility: props.requiresMobilityCondition || [],
            affectedByEnvironment: envAffectedUris.has(item.programUri)
              ? environment
              : [],
            durationMinutes: literals.durationMinutes
              ? Number.parseInt(literals.durationMinutes, 10)
              : undefined,
            requiresReservation:
              literals.requiresReservation === 'true' ||
              facilityLiterals.requiresReservation === 'true',
            isIndoor:
              facilityLiterals.isIndoor === undefined
                ? undefined
                : facilityLiterals.isIndoor === 'true',
            isAccessible:
              facilityLiterals.isAccessible === undefined
                ? undefined
                : facilityLiterals.isAccessible === 'true',
            isMeal: /FoodProgram|Meal|Food/i.test(item.programUri),
            runtime:
              runtimeStateMap.get(item.programUri) ||
              (facilityUri ? runtimeStateMap.get(facilityUri) : undefined) ||
              (facilityUri
                ? {
                    entityUri: facilityUri,
                    ...this.masterData.deriveOperatingState(
                      facilityUri,
                      contextDoc.dayOfWeek,
                      contextDoc.currentTime,
                      contextDoc.currentDate,
                    ),
                  }
                : undefined),
            coordinates,
            ...distance,
            estimatedTravelMinutes: this.locations.estimateTravelMinutes(
              distance.distanceMeters,
              contextDoc.transportMode,
            ),
          };
        });

    const foreignCandidates = candidates.filter(
      (candidate) => (candidate.regionId || 'gajo') !== regionId,
    );
    if (foreignCandidates.length)
      throw new Error(
        `Cross-region candidate leakage: request=${regionId}, candidates=${foreignCandidates.map((item) => item.programUri).join(',')}`,
      );

    const decision = this.decisionPipeline.run(candidates, {
      currentTime: contextDoc.currentTime,
      stayUntil: contextDoc.stayUntil,
      environmentConditions: environment,
      expandedConditions: expanded,
      walkingLevel: contextDoc.walkingLevel,
      latitude: isOperationalLocation(contextDoc)
        ? contextDoc.latitude
        : undefined,
      longitude: isOperationalLocation(contextDoc)
        ? contextDoc.longitude
        : undefined,
      transportMode: contextDoc.transportMode,
      maxWalkingDistanceMeters: contextDoc.maxWalkingDistanceMeters,
    });
    const normalizedInterests = regionalDataset
      ? (contextDoc.activityPreferences || []).map(
          (value: string) => regionalDataset.interestAliases[value] || value,
        )
      : [];
    const composition = composeItinerary(decision.ranked, {
      currentTime: contextDoc.currentTime,
      stayUntil: contextDoc.stayUntil,
      environmentConditions: environment,
      expandedConditions: expanded,
      walkingLevel: contextDoc.walkingLevel,
      latitude: contextDoc.latitude,
      longitude: contextDoc.longitude,
      transportMode: contextDoc.transportMode,
      maxWalkingDistanceMeters: contextDoc.maxWalkingDistanceMeters,
      duration: contextDoc.duration,
      rawMessage: contextDoc.rawMessage,
      selectedInterests: normalizedInterests,
      explicitRequestedJourney: (contextDoc.mustVisitPlaces||[]).filter((place:any)=>place.requested).length>1,
    });
    const top = regionalDataset
      ? composition.items
      : decision.sequenced.slice(0, 4);

    const evidence: TraversalStep[] = [];
    for (const item of top) {
      for (const matchedUri of item.matchedOn)
        evidence.push({
          subject: item.programUri,
          subjectLabel: item.programLabel,
          predicate: 'suitableFor',
          predicateLabel: '적합하다',
          object: matchedUri,
          objectLabel: this.traversal.label(matchedUri),
        });
      for (const riskUri of item.mitigatesRisk)
        evidence.push({
          subject: item.programUri,
          subjectLabel: item.programLabel,
          predicate: roo('mitigatesRisk'),
          predicateLabel: '위험을 완화한다',
          object: riskUri,
          objectLabel: this.traversal.label(riskUri),
        });
    }
    for (const affected of envAffected)
      evidence.push({
        subject: affected.uri,
        subjectLabel: this.traversal.label(affected.uri),
        predicate: 'affectedByEnvironment',
        predicateLabel: '환경의 영향을 받는다',
        object: affected.matchedOn[0],
        objectLabel: this.traversal.label(affected.matchedOn[0]),
      });

    const itineraryNo = `IT-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const confidenceScore = regionalDataset
      ? Math.min(0.35 + top.length * 0.08, 0.67)
      : Math.min(0.5 + top.length * 0.1 + (mitigations.length ? 0.1 : 0), 0.98);
    const itinerary = await this.itineraryModel.create({
      itineraryNo,
      runtimeContextId: contextDoc.contextNo,
      regionId,
      label: `${contextDoc.contextNo} 기반 추천 일정`,
      steps: top.map((item, index) => ({
        itemId: `STEP-${randomUUID().slice(0, 8)}`,
        entityId: item.programUri,
        regionId: item.regionId || regionId,
        order: index + 1,
        label: `${index + 1}단계: ${item.programLabel}`,
        facilityUri: item.facilityUri || 'unknown',
        facilityLabel: item.facilityLabel,
        programUri: item.programUri,
        programLabel: item.programLabel,
        canonicalLabel: item.canonicalLabel,
        requestedLabel: item.requestedLabel,
        durationMinutes: item.durationMinutes,
        requiresReservation: item.requiresReservation,
        status: 'PLANNED',
        dayIndex: 1,
        itineraryRole: item.itineraryRole,
        distanceMeters: item.distanceMeters,
        estimatedTravelMinutes: item.estimatedTravelMinutes,
        entityType: item.entityType,
        accommodationType: item.accommodationType,
        areaLabel: item.areaLabel,
        description: item.description,
        eventAvailability: item.eventAvailability,
        accessStatus: item.accessStatus,
        accessNotice: item.accessNotice,
        address: item.address,
        telephone: item.telephone,
        website: item.website,
        reservationUrl: item.reservationUrl,
        publicInformationUrl: item.publicInformationUrl,
        actions: item.actions,
        source: item.source,
        lastVerifiedAt: item.lastVerifiedAt,
        latitude: item.coordinates?.latitude,
        longitude: item.coordinates?.longitude,
      })),
      confidenceScore,
      risks,
    });

    const recommendationNo = `REC-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const decisionStages = {
      feasibility: {
        feasible: decision.feasible.map((c) => c.programUri),
        rejected: decision.rejected.map((r) => ({
          programUri: r.candidate.programUri,
          reasons: r.reasons,
          reasonCodes: r.reasonCodes,
        })),
      },
      suitability: decision.ranked.map((c) => ({
        programUri: c.programUri,
        score: c.score,
      })),
      sequence: top.map((c, index) => ({
        programUri: c.programUri,
        order: index + 1,
      })),
      explanation: decision.reasonSummary,
      interestCoverage: composition.coverage,
    };
    const reasonSummary =
      regionalDataset && top.length
        ? `${this.compositionReason(top)} ${regionalDataset.reasonSummary}`
        : decision.reasonSummary;
    const rec = await this.recModel.create({
      recommendationNo,
      runtimeContextId: contextDoc.contextNo,
      regionId,
      candidateRegionIds: Array.from(
        new Set(top.map((item) => item.regionId || 'gajo')),
      ),
      itineraryNo,
      recommendedPrograms: top.map((item) => item.programUri),
      recommendedFacilities: top
        .map((item) => item.facilityUri)
        .filter((uri): uri is string => Boolean(uri)),
      reasonSummary,
      evidence,
      risks,
      decisionMadeBy: [roo('semanticPlannerAgent')],
      confidenceScore,
      nextAction: 'reservation',
      decisionStages,
      interestCoverage: composition.coverage,
    });
    return { ...rec.toObject(), itinerary: itinerary.toObject() };
  }

  private buildRegionalCandidates(
    contextDoc: any,
    dataset: ReturnType<typeof regionalCandidateDataset>,
  ): DecisionCandidate[] {
    if (!dataset) return [];
    const preferences = new Set<string>(
      (contextDoc.activityPreferences || []).map(
        (value: string) => dataset.interestAliases[value] || value,
      ),
    );
    const anchors = [
      ...(contextDoc.mustVisitPlaces || []),
      ...(contextDoc.accommodationIntents || []),
    ].filter((place: any) => place.entityId && (place.resolved||place.requested));
    const anchorIds = new Set(anchors.map((place: any) => place.entityId));
    const mustVisitIds = new Set(
      (contextDoc.mustVisitPlaces || [])
        .filter((place: any) => place.entityId && (place.resolved||place.requested))
        .map((place: any) => place.entityId),
    );
    const requestedById=new Map<string,any>((contextDoc.mustVisitPlaces||[]).filter((place:any)=>place.entityId).map((place:any,index:number)=>[place.entityId,{...place,requestedOrder:index}]));
    const selected = dataset.records.filter(
      (entity) =>
        anchorIds.has(entity.entityUri) ||
        entity.tags.some((tag) => preferences.has(tag)),
    );
    const canonical=selected.map((entity) => {
      const matched = entity.tags.filter((tag) => preferences.has(tag));
      return {
        regionId: dataset.regionId,
        programUri: entity.entityUri,
        programLabel: entity.canonicalLabelKo,
        canonicalLabel:entity.canonicalLabelKo,
        requestedLabel:requestedById.get(entity.entityUri)?.requestedLabel,
        requestedOrder:requestedById.get(entity.entityUri)?.requestedOrder,
        facilityUri: entity.entityUri,
        facilityLabel: entity.canonicalLabelKo,
        matchedOn: matched.map((tag) => `${dataset.namespace}interest-${tag}`),
        matchedLabels: matched.map((tag) => dataset.interestLabels[tag] || tag),
        mitigatesRisk: [],
        mitigationLabels: [],
        requiredMobility: [],
        affectedByEnvironment: [],
        requiresReservation: Boolean(entity.reservationUrl),
        allowUnknownDuration: true,
        category: entity.category,
        tags: [...entity.tags],
        entityType: entity.entityType,
        accommodationType: entity.accommodationType,
        areaLabel: entity.areaLabel,
        description: entity.description,
        eventAvailability: entity.eventAvailability,
        accessStatus: entity.accessStatus,
        accessNotice: entity.accessNotice,
        address: entity.address,
        telephone: entity.telephone,
        website: entity.website,
        reservationUrl: entity.reservationUrl,
        publicInformationUrl: entity.publicInformationUrl,
        actions: entity.actions,
        source: entity.source,
        lastVerifiedAt: entity.lastVerifiedAt,
        coordinates:
          Number.isFinite(entity.latitude) && Number.isFinite(entity.longitude)
            ? {
                latitude: entity.latitude!,
                longitude: entity.longitude!,
                sourceUri: entity.entityUri,
              }
            : undefined,
        isMustVisit: mustVisitIds.has(entity.entityUri),
        runtime: { entityUri: entity.entityUri, operatingState: 'UNKNOWN' },
        distanceStatus: 'UNKNOWN',
        estimatedTravelMinutes: undefined,
      };
    });
    const unresolved=(contextDoc.mustVisitPlaces||[]).filter((place:any)=>place.requested&&place.entityId&&!dataset.records.some(entity=>entity.entityUri===place.entityId)).map((place:any,index:number)=>({regionId:dataset.regionId,programUri:place.entityId,programLabel:place.label,canonicalLabel:place.label,requestedLabel:place.requestedLabel,requestedOrder:index,facilityUri:place.entityId,facilityLabel:place.label,matchedOn:[],matchedLabels:[],mitigatesRisk:[],mitigationLabels:[],requiredMobility:[],affectedByEnvironment:[],requiresReservation:false,allowUnknownDuration:true,category:place.category||'TOURISM_NATURE',tags:[],entityType:place.entityType||'ATTRACTION',accessStatus:'NEEDS_VERIFICATION',accessNotice:place.entityType==='PLACE_CONCEPT'?'지역을 가리키는 표현입니다. 길찾기 전에 특정 시설을 선택해 주세요.':'지역 운영 데이터에서 검증되지 않은 요청 장소입니다. 방문 전 운영 정보를 확인해 주세요.',actions:{},source:place.source==='SEARCH'?place.evidence:{sourceType:'SEMANTIC_REFERENCE',relations:place.semanticRelations},coordinates:Number.isFinite(place.latitude)&&Number.isFinite(place.longitude)?{latitude:place.latitude,longitude:place.longitude,sourceUri:place.entityId}:undefined,isMustVisit:true,runtime:{entityUri:place.entityId,operatingState:'UNKNOWN'},distanceStatus:'UNKNOWN' as const,estimatedTravelMinutes:undefined}));
    return[...canonical,...unresolved];
  }

  private compositionReason(items: DecisionCandidate[]) {
    const roles = new Set(items.map((item) => item.itineraryRole));
    const parts: string[] = [];
    if (roles.has('ANCHOR')) parts.push('꼭 방문할 장소를 중심으로');
    if (roles.has('ATTRACTION') || roles.has('ACTIVITY'))
      parts.push('관광과 체험을 둘러본 뒤');
    if (roles.has('MEAL')) parts.push('식사하고');
    if (roles.has('CAFE_BREAK') || roles.has('REST'))
      parts.push('카페나 휴식 공간에서 쉬고');
    if (roles.has('ACCOMMODATION')) parts.push('선택하신 숙소로 이동하는');
    return `${parts.join(' ')} 흐름으로 일정을 구성했습니다.`;
  }

  getRecommendation(recommendationNo: string) {
    return this.recModel.findOne({ recommendationNo }).lean();
  }
  getItinerary(itineraryNo: string) {
    return this.itineraryModel.findOne({ itineraryNo }).lean();
  }
  listRecommendations(limit = 50) {
    return this.recModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
}
