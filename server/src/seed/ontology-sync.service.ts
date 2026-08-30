import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OntologyGraphService } from '../ontology/ontology-graph.service';
import { OntologyIndividualDoc } from '../schemas/ontology-individual.schema';
import { CLASS } from '../ontology/ontology.constants';
import { automaticBootstrapSeedEnabled } from '../bootstrap/startup-data-policy';

/**
 * OntologySyncService: materializes RDF individuals from the in-memory
 * ontology graph (single source of truth, loaded from the .ttl files) into
 * their corresponding MongoDB collections (facilities, programs,
 * healthConditions, wellnessGoals, risks, mobilityConditions,
 * environmentConditions, policies, rules, agents, capabilities, tools,
 * tasks, operations).
 *
 * This is a one-way TTL --> Mongo projection that runs once at boot
 * (idempotent upsert by `uri`), so that:
 *   - FacilityService / AdminService can do normal Mongo CRUD for
 *     operational fields (capacity, opening hours, live status) without
 *     touching the ontology source,
 *   - every collection required by the spec exists and is queryable with
 *     normal Mongo queries/pagination for the Admin Dashboard,
 *   - reasoning/traversal continues to run against the RDF graph
 *     (OntologyGraphService), which remains authoritative.
 */
@Injectable()
export class OntologySyncService implements OnModuleInit {
  private readonly logger = new Logger(OntologySyncService.name);

  constructor(
    private readonly graph: OntologyGraphService,
    @InjectModel('HealthConditionModel') private healthConditionModel: Model<OntologyIndividualDoc>,
    @InjectModel('WellnessGoalModel') private wellnessGoalModel: Model<OntologyIndividualDoc>,
    @InjectModel('FacilityModel') private facilityModel: Model<OntologyIndividualDoc>,
    @InjectModel('ProgramModel') private programModel: Model<OntologyIndividualDoc>,
    @InjectModel('EnvironmentConditionModel') private environmentConditionModel: Model<OntologyIndividualDoc>,
    @InjectModel('MobilityConditionModel') private mobilityConditionModel: Model<OntologyIndividualDoc>,
    @InjectModel('RiskModel') private riskModel: Model<OntologyIndividualDoc>,
    @InjectModel('PolicyModel') private policyModel: Model<OntologyIndividualDoc>,
    @InjectModel('RuleModel') private ruleModel: Model<OntologyIndividualDoc>,
    @InjectModel('AgentModel') private agentModel: Model<OntologyIndividualDoc>,
    @InjectModel('CapabilityModel') private capabilityModel: Model<OntologyIndividualDoc>,
    @InjectModel('ToolModel') private toolModel: Model<OntologyIndividualDoc>,
    @InjectModel('TaskModel') private taskModel: Model<OntologyIndividualDoc>,
    @InjectModel('OperationModel') private operationModel: Model<OntologyIndividualDoc>,
  ) {}

  async onModuleInit() {
    // Ontology graph loads synchronously in its own onModuleInit; Nest
    // guarantees provider onModuleInit order follows the dependency graph,
    // and OntologyGraphService is a dependency of this service, so it is
    // already populated by the time we get here.
    const jobs: [string, string, Model<OntologyIndividualDoc>][] = [
      [CLASS.HealthCondition, 'HealthCondition', this.healthConditionModel],
      [CLASS.WellnessGoal, 'WellnessGoal', this.wellnessGoalModel],
      [CLASS.Facility, 'Facility', this.facilityModel],
      [CLASS.Program, 'Program', this.programModel],
      [CLASS.EnvironmentCondition, 'EnvironmentCondition', this.environmentConditionModel],
      [CLASS.MobilityCondition, 'MobilityCondition', this.mobilityConditionModel],
      [CLASS.SafetyRisk, 'SafetyRisk', this.riskModel],
      [CLASS.Policy, 'Policy', this.policyModel],
      [CLASS.Rule, 'Rule', this.ruleModel],
      [CLASS.ArtificialAgent, 'ArtificialAgent', this.agentModel],
      [CLASS.Capability, 'Capability', this.capabilityModel],
      [CLASS.Tool, 'Tool', this.toolModel],
      [CLASS.Task, 'Task', this.taskModel],
      [CLASS.Operation, 'ConciergeOperation', this.operationModel],
    ];

    let total = 0,
      missing = 0;
    for (const [classUri, , model] of jobs) {
      const uris = this.graph.individualsOfIncludingSubclasses(classUri);
      for (const uri of uris) {
        if (!automaticBootstrapSeedEnabled()) {
          if (!(await model.findOne({ uri }))) missing++;
          total++;
          continue;
        }
        await model.findOneAndUpdate(
          { uri },
          {
            uri,
            label: this.graph.label(uri),
            comment: this.graph.description(uri),
            types: this.graph.typesOf(uri),
            literalProps: this.graph.literalProps(uri),
            objectProps: this.graph.objectProps(uri),
          },
          { upsert: true, new: true },
        );
        total++;
      }
    }
    if (!automaticBootstrapSeedEnabled() && missing)
      throw new Error(
        `Ontology bootstrap validation failed: missing documents=${missing}`,
      );
    this.logger.log(
      automaticBootstrapSeedEnabled()
        ? `Materialized ${total} ontology individuals into MongoDB collections`
        : `Validated ${total} ontology individuals without startup writes`,
    );
  }
}
