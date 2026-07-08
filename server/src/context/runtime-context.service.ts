import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { RuntimeContext, RuntimeContextDocument } from '../schemas/runtime-context.schema';
import { GraphTraversalService } from './graph-traversal.service';
import { OntologyGraphService } from '../ontology/ontology-graph.service';
import { gajo, roo, CLASS } from '../ontology/ontology.constants';

export interface CreateContextInput {
  visitorNo?: string;
  rawMessage?: string;
  visitorAge?: number;
  wellnessGoals?: string[]; // local names or full URIs, e.g. "familyHealingTrip" or full gajo: URI
  companions?: { age?: number; relationship?: string; healthConditions: string[] }[];
  healthConditions?: string[]; // visitor's own health conditions
  weather?: string; // "rainyWeather" | "clearWeather" | full URI
  congestion?: string; // "highCongestion" | "lowCongestion" | full URI
}

/**
 * Keyword-based free-text interpreter: maps a small set of Korean phrases
 * commonly used in the demo scenario to ontology individual local names.
 * This is intentionally simple (MVP scope) — it exists purely so
 * `POST /api/concierge/chat` can accept a natural-language message and
 * still produce a grounded ontology-based RuntimeContext, without
 * requiring a full NLU pipeline. It is NOT where "intelligence" lives;
 * all actual reasoning happens afterward via graph traversal.
 */
function keywordExtract(message: string) {
  const conds: string[] = [];
  let weather: string | undefined;
  let congestion: string | undefined;
  let wellnessGoal: string | undefined;
  const ageMatches = [...message.matchAll(/(\d{1,3})\s*세/g)].map((m) => parseInt(m[1], 10));

  if (/무릎/.test(message)) conds.push('kneePain');
  if (/피로|피곤/.test(message)) conds.push('fatigue');
  if (/고혈압/.test(message)) conds.push('hypertensionConcern');
  if (/거동|보행\s*불편|휠체어/.test(message)) conds.push('limitedMobility');

  if (/비\s*(가|올|올것|올\s*것)|우천|장마/.test(message)) weather = 'rainyWeather';
  else if (/맑|화창/.test(message)) weather = 'clearWeather';

  if (/사람이?\s*많|혼잡|붐빔/.test(message)) congestion = 'highCongestion';
  else if (/한산|여유/.test(message)) congestion = 'lowCongestion';

  if (/어머니|아버지|부모|가족/.test(message)) wellnessGoal = 'familyHealingTrip';
  if (/노인|어르신|고령/.test(message)) wellnessGoal = wellnessGoal || 'seniorFriendlyTrip';
  if (/스트레스/.test(message)) wellnessGoal = wellnessGoal || 'stressRelief';
  if (/휴식|회복/.test(message)) wellnessGoal = wellnessGoal || 'restAndRecovery';

  return { conds, weather, congestion, wellnessGoal, ages: ageMatches };
}

@Injectable()
export class RuntimeContextService {
  constructor(
    @InjectModel(RuntimeContext.name) private contextModel: Model<RuntimeContextDocument>,
    private readonly traversal: GraphTraversalService,
    private readonly graph: OntologyGraphService,
  ) {}

  /** Resolve a bare local name ("kneePain") or a full URI to a full gajo: URI. */
  private toGajoUri(nameOrUri: string): string {
    if (nameOrUri.startsWith('http')) return nameOrUri;
    return gajo(nameOrUri);
  }

  private toRooUri(nameOrUri: string): string {
    if (nameOrUri.startsWith('http')) return nameOrUri;
    return roo(nameOrUri);
  }

  /**
   * Core entry point: build a full RuntimeOperationalOntology semantic
   * context from either structured input (explicit health conditions /
   * weather / congestion selections from the UI) or a free-text Korean
   * message (chat), then:
   *   1. resolve all conditions to ontology individual URIs,
   *   2. semantically expand them (roo:semanticallyExpandsTo),
   *   3. classify SafetyRisk individuals among the expansion,
   *   4. evaluate governing roo:Policy/roo:Rule,
   *   5. select the applicable gajo:ConciergeOperation,
   *   6. persist the context and return it with full evidence.
   */
  async createContext(input: CreateContextInput) {
    let healthConditions = (input.healthConditions || []).map((c) => this.toGajoUri(c));
    let companionConditions: string[] = [];
    let weatherUri = input.weather ? this.toGajoUri(input.weather) : undefined;
    let congestionUri = input.congestion ? this.toGajoUri(input.congestion) : undefined;
    let wellnessGoals = (input.wellnessGoals || []).map((g) => this.toGajoUri(g));
    const actors: string[] = [];

    if (input.companions) {
      for (const c of input.companions) {
        companionConditions.push(...c.healthConditions.map((h) => this.toGajoUri(h)));
      }
    }

    // Free-text fallback / augmentation via lightweight keyword extraction.
    if (input.rawMessage) {
      const extracted = keywordExtract(input.rawMessage);
      for (const c of extracted.conds) {
        const uri = gajo(c);
        if (!healthConditions.includes(uri) && !companionConditions.includes(uri)) {
          companionConditions.push(uri);
        }
      }
      if (extracted.weather && !weatherUri) weatherUri = gajo(extracted.weather);
      if (extracted.congestion && !congestionUri) congestionUri = gajo(extracted.congestion);
      if (extracted.wellnessGoal && wellnessGoals.length === 0) wellnessGoals.push(gajo(extracted.wellnessGoal));
    }

    const allConditionSeeds = [
      ...healthConditions,
      ...companionConditions,
      ...(weatherUri ? [weatherUri] : []),
      ...(congestionUri ? [congestionUri] : []),
    ].filter(Boolean);

    const expansion = this.traversal.expandConditions(allConditionSeeds);

    // Governing policies: any roo:Policy whose rule ifCondition matches an active (seed or expanded) condition.
    const activeConditions = [...allConditionSeeds, ...expansion.expanded];
    const firedRules = this.traversal.evaluateRules(activeConditions);
    const policies = Array.from(new Set(firedRules.map((r) => r.policyUri).filter(Boolean))) as string[];

    // Operation selection: MVP maps "has a senior/limited-mobility companion" -> seniorDayTripPlanningOperation.
    // This is itself grounded in the ontology: gajo:seniorDayTripPlanningOperation is the only
    // gajo:ConciergeOperation individual currently defined, so we select it whenever any Task-relevant
    // condition is present; additional Operations can be added to the .ttl and this selection generalized
    // to a capability-matching search without changing the API contract.
    const operations = this.traversal.individualsOfIncludingSubclasses(CLASS.Operation);
    const operationUri = operations[0]; // MVP: single seeded operation

    const contextNo = `RC-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const doc = await this.contextModel.create({
      contextNo,
      visitorNo: input.visitorNo,
      rawMessage: input.rawMessage,
      actors,
      healthConditions: [...healthConditions, ...companionConditions],
      wellnessGoals,
      environmentConditions: [weatherUri, congestionUri].filter(Boolean) as string[],
      expandedConditions: expansion.expanded,
      risks: expansion.risks,
      operationUri,
      policies,
      raw: { input, firedRules },
    });

    return {
      context: doc.toObject(),
      evidence: expansion.evidence,
      firedRules,
    };
  }

  async getContext(contextNo: string) {
    return this.contextModel.findOne({ contextNo }).lean();
  }

  async listContexts(limit = 50) {
    return this.contextModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
}
