import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OntologyIndividualDoc } from '../schemas/ontology-individual.schema';
import { GraphTraversalService } from '../context/graph-traversal.service';

/**
 * PolicyRuleService: read/query access over the materialized `policies`
 * and `rules` collections, plus a direct passthrough to
 * GraphTraversalService.evaluateRules for ad-hoc "what rules would fire
 * given these conditions" testing from the Admin Dashboard / Ontology
 * Explorer (useful for verifying new .ttl rules before relying on them in
 * RuntimeContextService).
 */
@Injectable()
export class PolicyRuleService {
  constructor(
    @InjectModel('PolicyModel') private policyModel: Model<OntologyIndividualDoc>,
    @InjectModel('RuleModel') private ruleModel: Model<OntologyIndividualDoc>,
    private readonly traversal: GraphTraversalService,
  ) {}

  listPolicies() {
    return this.policyModel.find().sort({ label: 1 }).lean();
  }

  listRules() {
    return this.ruleModel.find().sort({ label: 1 }).lean();
  }

  evaluate(activeConditionUris: string[]) {
    return this.traversal.evaluateRules(activeConditionUris);
  }
}
