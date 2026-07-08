import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Recommendation, RecommendationDocument } from '../schemas/recommendation.schema';
import { Itinerary, ItineraryDocument } from '../schemas/itinerary.schema';
import { GraphTraversalService } from '../context/graph-traversal.service';
import { OntologyGraphService, TraversalStep } from '../ontology/ontology-graph.service';
import { roo } from '../ontology/ontology.constants';

/**
 * RecommendationService: the "Recommendation" step of the architecture.
 * Given a persisted RuntimeContext document (health conditions, wellness
 * goals, environment conditions, their semantic expansion, and identified
 * risks), this service:
 *
 *   1. Finds every gajo:Program suitable for the active health
 *      conditions / wellness goals (suitableForHealthCondition /
 *      suitableForWellnessGoal object properties),
 *   2. Deprioritizes / annotates programs & facilities affected by the
 *      active environment conditions (affectedByEnvironment),
 *   3. Surfaces which candidate programs/facilities mitigate the
 *      identified risks (mitigatesRisk),
 *   4. Ranks and builds an ordered Itinerary from the top matches,
 *   5. Persists both the Recommendation and its Itinerary with a full
 *      evidence trail (every RDF edge used to justify the pick), and
 *   6. Computes a confidence score from evidence density.
 *
 * CRITICAL PRINCIPLE (per spec): no hardcoded "if kneePain then X"
 * business rule lives here — every program in `recommendedPrograms` is
 * present because a real `suitableForHealthCondition` /
 * `suitableForWellnessGoal` RDF edge in the .ttl graph connects it to one
 * of the (possibly semantically-expanded) active conditions.
 */
@Injectable()
export class RecommendationService {
  constructor(
    @InjectModel(Recommendation.name) private recModel: Model<RecommendationDocument>,
    @InjectModel(Itinerary.name) private itineraryModel: Model<ItineraryDocument>,
    private readonly traversal: GraphTraversalService,
    private readonly graph: OntologyGraphService,
  ) {}

  async buildRecommendation(contextDoc: any) {
    const conditionSeeds: string[] = [
      ...(contextDoc.healthConditions || []),
      ...(contextDoc.wellnessGoals || []),
    ];
    const expanded: string[] = contextDoc.expandedConditions || [];
    const environment: string[] = contextDoc.environmentConditions || [];
    const risks: string[] = contextDoc.risks || [];

    // 1. Direct suitability match (seeds + expanded conditions, since e.g.
    //    a Program might be suitableForHealthCondition kneePain directly,
    //    while another matches only on the expanded shortWalkingDistance).
    const matchPool = [...conditionSeeds, ...expanded];
    const suitable = this.traversal.findSuitablePrograms(matchPool);

    // 2. Environment-affected programs/facilities (used to filter OUT
    //    outdoor/rain-affected candidates and to explain why they were
    //    excluded).
    const envAffected = this.traversal.findEnvironmentAffected(environment);
    const envAffectedUris = new Set(envAffected.map((e) => e.uri));

    // 3. Risk mitigation bonus: programs/facilities with roo:mitigatesRisk
    //    covering an identified risk are boosted.
    const mitigations = this.traversal.findRiskMitigations(risks);
    const mitigationMap = new Map<string, string[]>();
    for (const m of mitigations) mitigationMap.set(m.uri, m.matchedOn);

    // Rank: suitable (not env-affected) first, ordered by
    // (mitigatesRisk bonus, then number of matched conditions) descending.
    const ranked = suitable
      .filter((s) => !envAffectedUris.has(s.programUri))
      .map((s) => ({
        ...s,
        mitigatesRisk: mitigationMap.get(s.programUri) || [],
        score: s.matchedOn.length * 10 + (mitigationMap.get(s.programUri)?.length || 0) * 5,
      }))
      .sort((a, b) => b.score - a.score);

    const top = ranked.slice(0, 4);

    // Build evidence: semantic expansion steps (already on the context) +
    // suitability edges + environment-exclusion edges + risk-mitigation edges.
    const evidence: TraversalStep[] = [];
    for (const t of top) {
      for (const matchedUri of t.matchedOn) {
        evidence.push({
          subject: t.programUri,
          subjectLabel: this.traversal.label(t.programUri),
          predicate: 'suitableFor',
          predicateLabel: '적합하다',
          object: matchedUri,
          objectLabel: this.traversal.label(matchedUri),
        });
      }
      for (const riskUri of t.mitigatesRisk) {
        evidence.push({
          subject: t.programUri,
          subjectLabel: this.traversal.label(t.programUri),
          predicate: roo('mitigatesRisk'),
          predicateLabel: '위험을 완화한다',
          object: riskUri,
          objectLabel: this.traversal.label(riskUri),
        });
      }
    }
    for (const env of envAffected) {
      evidence.push({
        subject: env.uri,
        subjectLabel: this.traversal.label(env.uri),
        predicate: 'affectedByEnvironment(excluded)',
        predicateLabel: '환경 영향으로 제외됨',
        object: env.matchedOn[0],
        objectLabel: this.traversal.label(env.matchedOn[0]),
      });
    }

    // Resolve facility for each recommended program (heldAtFacility).
    const stepInputs = top.map((t) => {
      const props = this.traversal.objectProps(t.programUri);
      const facilityUri = (props['heldAtFacility'] || [])[0];
      const literals = this.traversal.literalProps(t.programUri);
      return {
        programUri: t.programUri,
        programLabel: this.traversal.label(t.programUri),
        facilityUri,
        facilityLabel: facilityUri ? this.traversal.label(facilityUri) : undefined,
        durationMinutes: literals.durationMinutes ? parseInt(literals.durationMinutes, 10) : undefined,
        requiresReservation: literals.requiresReservation === 'true',
      };
    });

    const itineraryNo = `IT-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const confidenceScore = Math.min(0.5 + top.length * 0.1 + (mitigations.length ? 0.1 : 0), 0.98);

    const itinerary = await this.itineraryModel.create({
      itineraryNo,
      runtimeContextId: contextDoc.contextNo,
      label: `${contextDoc.contextNo} 기반 추천 일정`,
      steps: stepInputs.map((s, idx) => ({
        order: idx + 1,
        label: `${idx + 1}단계: ${s.programLabel}`,
        facilityUri: s.facilityUri || 'unknown',
        facilityLabel: s.facilityLabel,
        programUri: s.programUri,
        programLabel: s.programLabel,
        durationMinutes: s.durationMinutes,
        requiresReservation: s.requiresReservation,
      })),
      confidenceScore,
      risks,
    });

    const reasonParts: string[] = [];
    for (const seed of conditionSeeds) {
      reasonParts.push(`${this.traversal.label(seed)}`);
    }
    const reasonSummary = `${reasonParts.join(', ')} 조건을 바탕으로, 온톨로지 그래프 탐색을 통해 ${top
      .map((t) => this.traversal.label(t.programUri))
      .join(', ')}을(를) 추천합니다.`;

    const recommendationNo = `REC-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const rec = await this.recModel.create({
      recommendationNo,
      runtimeContextId: contextDoc.contextNo,
      itineraryNo,
      recommendedPrograms: top.map((t) => t.programUri),
      recommendedFacilities: stepInputs.map((s) => s.facilityUri).filter(Boolean),
      reasonSummary,
      evidence,
      risks,
      decisionMadeBy: [roo('semanticPlannerAgent')],
      confidenceScore,
      nextAction: 'reservation',
    });

    return {
      ...rec.toObject(),
      itinerary: itinerary.toObject(),
    };
  }

  async getRecommendation(recommendationNo: string) {
    return this.recModel.findOne({ recommendationNo }).lean();
  }

  async getItinerary(itineraryNo: string) {
    return this.itineraryModel.findOne({ itineraryNo }).lean();
  }

  async listRecommendations(limit = 50) {
    return this.recModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
}
