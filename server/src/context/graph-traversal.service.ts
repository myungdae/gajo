import { Injectable } from '@nestjs/common';
import { OntologyGraphService, TraversalStep } from '../ontology/ontology-graph.service';
import { PRED, CLASS } from '../ontology/ontology.constants';

export interface SemanticExpansionResult {
  /** original condition URIs (HealthCondition / WeatherCondition / CongestionCondition individuals) */
  seeds: string[];
  /** every condition/risk/preference URI reachable via roo:semanticallyExpandsTo */
  expanded: string[];
  /** subset of `expanded` that are typed as gajo:SafetyRisk */
  risks: string[];
  /** the full explainable RDF edge path walked to reach this conclusion */
  evidence: TraversalStep[];
}

/**
 * GraphTraversalService: the domain-facing traversal API used by
 * RuntimeContextService / SemanticPlannerService / RecommendationService /
 * PolicyRuleService. It wraps the generic RDF operations exposed by
 * OntologyGraphService with Gajo-domain-specific graph walks, so that
 * every "why did the system recommend X" answer can be reconstructed
 * purely from graph edges instead of hardcoded if/else business rules.
 */
@Injectable()
export class GraphTraversalService {
  constructor(private readonly graph: OntologyGraphService) {}

  /**
   * Given HealthCondition / WeatherCondition / CongestionCondition
   * individual URIs, walk roo:semanticallyExpandsTo to discover every
   * derived MobilityCondition / preference-Condition / SafetyRisk they
   * imply, and classify which of the results are SafetyRisk individuals.
   *
   * Example: gajo:kneePain --semanticallyExpandsTo--> gajo:shortWalkingDistance,
   * gajo:elevatorAvailable, gajo:fallRisk.
   */
  expandConditions(seedUris: string[]): SemanticExpansionResult {
    const { expanded, steps } = this.graph.expand(seedUris);
    const riskIndividuals = new Set(this.graph.individualsOfIncludingSubclasses(CLASS.SafetyRisk));
    const risks = expanded.filter((uri) => riskIndividuals.has(uri));
    return { seeds: seedUris, expanded, risks, evidence: steps };
  }

  /**
   * Find every gajo:Program individual whose suitableForHealthCondition or
   * suitableForWellnessGoal set intersects with the given condition/goal
   * URIs (which may include both the original seeds and their semantic
   * expansion). Returns programs together with the matched-on URIs so the
   * caller can build an evidence trail.
   */
  findSuitablePrograms(conditionOrGoalUris: string[]): { programUri: string; matchedOn: string[] }[] {
    const seedSet = new Set(conditionOrGoalUris);
    const programUris = this.graph.individualsOfIncludingSubclasses(CLASS.Program);
    const results: { programUri: string; matchedOn: string[] }[] = [];
    for (const programUri of programUris) {
      const props = this.graph.objectProps(programUri);
      const suitableHealth = props['suitableForHealthCondition'] || [];
      const suitableGoal = props['suitableForWellnessGoal'] || [];
      const matched = [...suitableHealth, ...suitableGoal].filter((uri) => seedSet.has(uri));
      if (matched.length) {
        results.push({ programUri, matchedOn: matched });
      }
    }
    return results;
  }

  /**
   * Find gajo:Program individuals that are negatively affected by / require
   * caution under a given environment condition (affectedByEnvironment),
   * used to DEPRIORITIZE outdoor programs when e.g. gajo:rainyWeather is
   * active. Also surfaces facilities directly affected.
   */
  findEnvironmentAffected(environmentUris: string[]): { uri: string; matchedOn: string[] }[] {
    const envSet = new Set(environmentUris);
    const candidates = [
      ...this.graph.individualsOfIncludingSubclasses(CLASS.Program),
      ...this.graph.individualsOfIncludingSubclasses(CLASS.Facility),
    ];
    const results: { uri: string; matchedOn: string[] }[] = [];
    for (const uri of candidates) {
      const props = this.graph.objectProps(uri);
      const affected = props['affectedByEnvironment'] || [];
      const matched = affected.filter((a) => envSet.has(a));
      if (matched.length) results.push({ uri, matchedOn: matched });
    }
    return results;
  }

  /** Programs/Facilities that mitigate a given set of risk URIs (roo:mitigatesRisk). */
  findRiskMitigations(riskUris: string[]): { uri: string; matchedOn: string[] }[] {
    const riskSet = new Set(riskUris);
    const candidates = [
      ...this.graph.individualsOfIncludingSubclasses(CLASS.Program),
      ...this.graph.individualsOfIncludingSubclasses(CLASS.Facility),
    ];
    const results: { uri: string; matchedOn: string[] }[] = [];
    for (const uri of candidates) {
      const props = this.graph.objectProps(uri);
      const mitigates = props['mitigatesRisk'] || [];
      const matched = mitigates.filter((r) => riskSet.has(r));
      if (matched.length) results.push({ uri, matchedOn: matched });
    }
    return results;
  }

  /**
   * Evaluate every roo:Rule individual: if its roo:ifCondition URI is a
   * member of `activeConditionUris`, the rule fires and its
   * roo:thenRecommendation / roo:thenAction target is returned along with
   * the owning roo:Policy.
   */
  evaluateRules(activeConditionUris: string[]) {
    const activeSet = new Set(activeConditionUris);
    const ruleUris = this.graph.individualsOfIncludingSubclasses(CLASS.Rule);
    const fired: {
      ruleUri: string;
      ruleLabel: string;
      ifCondition: string;
      thenRecommendation?: string;
      thenAction?: string;
      policyUri?: string;
      policyLabel?: string;
    }[] = [];
    // Find owning policy for each rule via roo:hasRule (Policy -> Rule)
    const policyUris = this.graph.individualsOfIncludingSubclasses(CLASS.Policy);
    const ruleToPolicy = new Map<string, string>();
    for (const policyUri of policyUris) {
      const props = this.graph.objectProps(policyUri);
      for (const ruleUri of props['hasRule'] || []) ruleToPolicy.set(ruleUri, policyUri);
    }
    for (const ruleUri of ruleUris) {
      const props = this.graph.objectProps(ruleUri);
      const ifConds = props['ifCondition'] || [];
      const matched = ifConds.find((c) => activeSet.has(c));
      if (matched) {
        const policyUri = ruleToPolicy.get(ruleUri);
        fired.push({
          ruleUri,
          ruleLabel: this.graph.label(ruleUri),
          ifCondition: matched,
          thenRecommendation: (props['thenRecommendation'] || [])[0],
          thenAction: (props['thenAction'] || [])[0],
          policyUri,
          policyLabel: policyUri ? this.graph.label(policyUri) : undefined,
        });
      }
    }
    return fired;
  }

  /** Agents that have a given capability (roo:hasCapability), used by SemanticPlannerService for task assignment. */
  findAgentsWithCapability(capabilityUri: string): string[] {
    const agentUris = this.graph.individualsOfIncludingSubclasses(CLASS.ArtificialAgent);
    return agentUris.filter((agentUri) => {
      const props = this.graph.objectProps(agentUri);
      return (props['hasCapability'] || []).includes(capabilityUri);
    });
  }

  /** Convenience passthrough for label lookups used across services/controllers. */
  label(uri: string): string {
    return this.graph.label(uri);
  }

  labelAll(uris: string[]): { uri: string; label: string }[] {
    return uris.map((uri) => ({ uri, label: this.graph.label(uri) }));
  }

  objectProps(uri: string) {
    return this.graph.objectProps(uri);
  }

  literalProps(uri: string) {
    return this.graph.literalProps(uri);
  }

  individualsOfIncludingSubclasses(classUri: string) {
    return this.graph.individualsOfIncludingSubclasses(classUri);
  }
}
