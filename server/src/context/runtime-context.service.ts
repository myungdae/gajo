import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { RuntimeContext, RuntimeContextDocument } from '../schemas/runtime-context.schema';
import { GraphTraversalService } from './graph-traversal.service';
import { OntologyGraphService } from '../ontology/ontology-graph.service';
import { gajo, roo, CLASS } from '../ontology/ontology.constants';
import type {
  CongestionState,
  EntityRuntimeState,
  TransportMode,
  WalkingLevel,
} from './runtime-context.types';
import { parseNaturalLanguageContext } from './natural-language-context.parser';
import type { ExtractorResult } from './context-extractor.types';
import { REGIONAL_CANDIDATE_DATASETS } from '../regions/regional-candidate.registry';
import { mergeContextExtractions } from './context-extraction.merger';
import { ContextExtractionGateway } from './context-extraction.gateway';

export interface CreateContextInput {
  turnId?: string;
  conversationalAnchor?: { entityId: string; regionId: string; label?: string; entityType?: string; category?: string; latitude?: number; longitude?: number; source?: 'RDM'|'SEARCH'; sourceTurnId: string; role: 'RESULT'|'SUBJECT'|'SELECTED' };
  discoveryContext?: { regionId: string; anchor: { entityId: string; label?: string; latitude?: number; longitude?: number; source?: 'RDM'|'SEARCH' }; targetCategory: 'FOOD'|'CAFE'|'LODGING'|'HOT_SPRING_WELLNESS'|'ACTIVITY'|'TOURISM_NATURE'|'CONVENIENCE'|'ESSENTIAL_SHOPPING'|'CONVENIENCE_STORE'|'MART_SUPERMARKET'; relation: 'NEARBY'|'REGIONAL'; currentResult?: { entityId: string; label?: string; latitude?: number; longitude?: number; source?: 'RDM'|'SEARCH' }; shownEntityIds: string[]; sourceTurnId: string };
  regionId?: string;
  duration?: string;
  mustVisitPlaces?: { entityId?: string; label: string; requestedLabel?:string;resolved: boolean; requested?:boolean;source?:'RDM'|'SEARCH'|'SEMANTIC';category?:string;entityType?:string;latitude?:number;longitude?:number;verificationStatus?:string;evidence?:Record<string,unknown> }[];
  accommodationIntents?: { entityId?: string; label: string; resolved: boolean }[];
  visitorNo?: string;
  rawMessage?: string;
  visitorAge?: number;
  wellnessGoals?: string[]; // local names or full URIs, e.g. "familyHealingTrip" or full gajo: URI
  companions?: { age?: number; relationship?: string; healthConditions: string[] }[];
  healthConditions?: string[]; // visitor's own health conditions
  weather?: string; // "rainyWeather" | "clearWeather" | full URI
  weatherState?: string;
  congestion?: string; // "highCongestion" | "lowCongestion" | full URI
  currentTime?: string;
  currentDate?: string;
  dayOfWeek?: string;
  temperature?: number;
  precipitation?: number;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  locationObservedAt?: string;
  locationStatus?: 'AVAILABLE' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';
  transportMode?: TransportMode;
  stayUntil?: string;
  walkingLevel?: WalkingLevel;
  companionConstraints?: string[];
  congestionState?: CongestionState;
  runtimeStates?: EntityRuntimeState[];
  contextSessionId?: string;
  inputMode?: 'STRUCTURED' | 'FREE_TEXT';
  isFollowup?: boolean;
  discoveryCategoryHint?: 'FOOD'|'CAFE'|'LODGING'|'HOT_SPRING_WELLNESS'|'ACTIVITY'|'TOURISM_NATURE'|'CONVENIENCE'|'ESSENTIAL_SHOPPING'|'CONVENIENCE_STORE'|'MART_SUPERMARKET';
  activityPreferences?: string[];
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
    @Optional() private readonly extractionGateway?: ContextExtractionGateway,
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
    let companions = [...(input.companions || [])];
    let transportMode = input.transportMode;
    let stayUntil = input.stayUntil;
    let walkingLevel = input.walkingLevel;
    let companionConstraints = [...(input.companionConstraints || [])];
    let activityPreferences = [...(input.activityPreferences || [])];
    let accommodationIntents = [...(input.accommodationIntents || [])];
    let extractionDebug: Record<string, any> | undefined;
    let stayUntilPeriod: string | undefined;
    let extractedIntent: string | undefined;
    const gatewayOutcome = this.extractionGateway
      ? await this.extractionGateway.extract({ text: input.rawMessage, sessionId: input.contextSessionId, followup: input.isFollowup })
      : { decision: 'SKIP_LLM' as const, invocationReason: input.rawMessage ? (input.isFollowup ? 'FREE_TEXT_FOLLOWUP' as const : 'FREE_TEXT_INITIAL' as const) : 'NOT_REQUIRED' as const, result: { status: 'DISABLED' as const, provider: 'none', latencyMs: 0, errorCode: 'NO_GATEWAY' } };
    extractionDebug = { extractorInvocationReason: gatewayOutcome.invocationReason, gatewayDecision: gatewayOutcome.decision, duplicate: gatewayOutcome.duplicate, limitReached: gatewayOutcome.limitReached };
    const actors: string[] = [];

    if (companions.length) {
      for (const c of companions) {
        companionConditions.push(...c.healthConditions.map((h) => this.toGajoUri(h)));
      }
    }

    // Free-text fallback / augmentation via lightweight keyword extraction.
    if (input.rawMessage) {
      const extracted = parseNaturalLanguageContext(input.rawMessage);
      const extractorResult: ExtractorResult = gatewayOutcome.result;
      const merged = mergeContextExtractions(extracted, extractorResult);
      if(extracted.explicitAccommodation){const normalized=extracted.explicitAccommodation.replace(/\s/g,'');const match=REGIONAL_CANDIDATE_DATASETS[input.regionId||'gajo']?.records.find(record=>record.entityType==='ACCOMMODATION'&&[record.canonicalLabelKo,...record.alternateLabels].some(label=>label.replace(/\s/g,'')===normalized));if(match)accommodationIntents=[{entityId:match.entityUri,label:match.canonicalLabelKo,resolved:true}]}
      if (companions.length === 0) companions = merged.companions;
      if (merged.transportMode && (input.isFollowup || !transportMode)) transportMode = merged.transportMode as TransportMode;
      if (merged.stayUntil && (input.isFollowup || !stayUntil)) stayUntil = merged.stayUntil;
      if (merged.walkingLevel && (input.isFollowup || !walkingLevel)) walkingLevel = merged.walkingLevel as WalkingLevel;
      companionConstraints = [...new Set([...companionConstraints, ...merged.companionConstraints])];
      activityPreferences = [...new Set([...activityPreferences, ...merged.activityPreferences])];
      stayUntilPeriod = merged.stayUntilPeriod;
      extractedIntent = merged.intent;
      if (!input.isFollowup) {
        const selected:Record<string,unknown>={transportMode:input.transportMode,stayUntil:input.stayUntil,walkingLevel:input.walkingLevel,companions:input.companions?.length?input.companions:undefined};
        for(const resolution of merged.diagnostics){if(selected[resolution.field]!==undefined&&JSON.stringify(selected[resolution.field])!==JSON.stringify(resolution.finalValue)){resolution.finalValue=selected[resolution.field];resolution.resolution='USER_SELECTION_WINS';}}
      }
      extractionDebug = { ...extractionDebug, ...merged.extractor, fieldsExtracted: merged.diagnostics.map(item => item.field), conflictsCount: merged.diagnostics.filter(item => ['USER_SELECTION_WINS','DETERMINISTIC_WINS','UNRESOLVED'].includes(item.resolution)).length, resolutions: merged.diagnostics, validatedExtraction: extractorResult.extraction, needsClarification: merged.needsClarification, clarificationReason: merged.clarificationReason, suggestedQuestion: merged.suggestedQuestion };
      for (const goal of merged.wellnessGoals) if (!wellnessGoals.includes(gajo(goal))) wellnessGoals.push(gajo(goal));
      for (const c of merged.conditions) {
        const uri = gajo(c);
        if (!healthConditions.includes(uri) && !companionConditions.includes(uri)) {
          companionConditions.push(uri);
        }
      }
      if (extracted.weather && !weatherUri) weatherUri = gajo(extracted.weather);
      if (extracted.congestion && !congestionUri) congestionUri = gajo(extracted.congestion);
      if (extracted.wellnessGoal && wellnessGoals.length === 0) wellnessGoals.push(gajo(extracted.wellnessGoal));
      if (extracted.conditions.includes('kneePain')) {
        for (const companion of companions) {
          if (!companion.healthConditions.includes('kneePain')) companion.healthConditions.push('kneePain');
        }
      }
    }

    const knownHealthConstraints = new Set(['kneePain', 'fatigue', 'limitedMobility', 'hypertensionConcern']);
    const knownMobilityConstraints = new Set(['shortWalkingDistance', 'elevatorAvailable', 'wheelchairAccessible', 'stairsRequired']);
    const constraintLocalName = (value: string) => value.split('#').pop() || value;
    for (const constraint of companionConstraints) {
      const local = constraintLocalName(constraint);
      if (knownHealthConstraints.has(local)) {
        const uri = gajo(local);
        if (!healthConditions.includes(uri) && !companionConditions.includes(uri)) companionConditions.push(uri);
      }
    }
    const explicitMobilityConditions = companionConstraints
      .map(constraintLocalName)
      .filter(value => knownMobilityConstraints.has(value))
      .map(value => gajo(value));

    const allConditionSeeds = [
      ...healthConditions,
      ...companionConditions,
      ...(weatherUri ? [weatherUri] : []),
      ...(congestionUri ? [congestionUri] : []),
    ].filter(Boolean);

    const expansion = this.traversal.expandConditions(allConditionSeeds);

    // Governing policies: any roo:Policy whose rule ifCondition matches an active (seed or expanded) condition.
    const alignedExpandedConditions = [...new Set([...explicitMobilityConditions, ...expansion.expanded])];
    const activeConditions = [...allConditionSeeds, ...alignedExpandedConditions];
    const firedRules = this.traversal.evaluateRules(activeConditions);
    const policies = Array.from(new Set(firedRules.map((r) => r.policyUri).filter(Boolean))) as string[];

    // Operation selection: MVP maps "has a senior/limited-mobility companion" -> seniorDayTripPlanningOperation.
    // This is itself grounded in the ontology: gajo:seniorDayTripPlanningOperation is the only
    // gajo:ConciergeOperation individual currently defined, so we select it whenever any Task-relevant
    // condition is present; additional Operations can be added to the .ttl and this selection generalized
    // to a capability-matching search without changing the API contract.
    const operations = this.traversal.individualsOfIncludingSubclasses(CLASS.Operation);
    const operationUri = operations[0]; // MVP: single seeded operation

    const contextNo = `RC-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const doc = await this.contextModel.create({
      contextNo,
      regionId: input.regionId || 'gajo',
      duration: input.duration,
      visitorNo: input.visitorNo,
      rawMessage: input.rawMessage,
      actors,
      healthConditions: [...healthConditions, ...companionConditions],
      companions,
      wellnessGoals,
      activityPreferences,
      mustVisitPlaces: input.mustVisitPlaces || [],
      accommodationIntents,
      environmentConditions: [weatherUri, congestionUri].filter(Boolean) as string[],
      expandedConditions: alignedExpandedConditions,
      risks: expansion.risks,
      operationUri,
      policies,
      currentTime: input.currentTime,
      currentDate: input.currentDate,
      dayOfWeek: input.dayOfWeek,
      weather: weatherUri,
      weatherState: input.weatherState,
      temperature: input.temperature,
      precipitation: input.precipitation,
      transportMode,
      stayUntil,
      walkingLevel,
      companionConstraints,
      stayUntilPeriod,
      extractedIntent,
      congestionState: input.congestionState,
      runtimeStates: input.runtimeStates || [],
      raw: { input: { ...input, companions, transportMode, stayUntil, walkingLevel, companionConstraints, activityPreferences, wellnessGoals, latitude: undefined, longitude: undefined, locationAccuracy: undefined, locationObservedAt: undefined }, firedRules, extractionDebug, fieldProvenance: {
        companions: input.companions?.length ? 'USER_SELECTION' : input.rawMessage ? 'DETERMINISTIC_OR_LLM' : undefined,
        transportMode: input.transportMode && !input.isFollowup ? 'USER_SELECTION' : input.rawMessage ? 'DETERMINISTIC_OR_LLM' : undefined,
        stayUntil: input.stayUntil && !input.isFollowup ? 'USER_SELECTION' : input.rawMessage ? 'DETERMINISTIC_OR_LLM' : undefined,
        walkingLevel: input.walkingLevel && !input.isFollowup ? 'USER_SELECTION' : input.rawMessage ? 'DETERMINISTIC_OR_LLM' : undefined,
        wellnessGoals: input.wellnessGoals?.length ? 'USER_SELECTION' : input.rawMessage ? 'DETERMINISTIC_OR_LLM' : undefined,
      } },
    });

    return {
      context: { ...doc.toObject(), conversationalAnchor: input.conversationalAnchor, discoveryContext: input.discoveryContext, turnId: input.turnId, latitude: input.latitude, longitude: input.longitude, locationAccuracy: input.locationAccuracy, locationObservedAt: input.locationObservedAt, locationStatus: input.locationStatus },
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
