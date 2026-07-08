import * as mongoose from 'mongoose';

/**
 * Shared document shape for every MongoDB collection that is a
 * "materialized view" of ontology individuals (facilities, programs,
 * policies, rules, agents, capabilities, tools, healthConditions,
 * wellnessGoals, risks, mobilityConditions, environmentConditions, tasks,
 * operations, ...).
 *
 * The RDF graph itself (loaded from the .ttl files by OntologyGraphService)
 * remains the single source of truth for reasoning/traversal. These Mongo
 * collections exist so that:
 *   1. FacilityService / AdminService can do normal CRUD (create/update
 *      operating hours, capacity, etc. — things that legitimately change
 *      at runtime and shouldn't require editing the .ttl source),
 *   2. the required "Mongo Collections" list from the spec is satisfied
 *      with real, queryable collections instead of only an in-memory
 *      graph,
 *   3. the OntologySeedService can (re)materialize them from the graph on
 *      demand as a one-way sync: TTL --> Mongo (Mongo is a projection).
 */
export interface OntologyIndividualDoc extends mongoose.Document {
  uri: string;
  label: string;
  comment?: string;
  types: string[];
  /** Flattened rdfs/roo/gajo literal datatype properties, e.g. { age: '78', durationMinutes: '60' } */
  literalProps: Record<string, any>;
  /** Flattened object-property edges (URI arrays), e.g. { suitableForHealthCondition: ['https://.../kneePain'] } */
  objectProps: Record<string, string[]>;
  createdAt: Date;
  updatedAt: Date;
}

export function createIndividualSchema() {
  return new mongoose.Schema<OntologyIndividualDoc>(
    {
      uri: { type: String, required: true, unique: true, index: true },
      label: { type: String, default: '' },
      comment: { type: String },
      types: { type: [String], default: [] },
      literalProps: { type: mongoose.Schema.Types.Mixed, default: {} },
      objectProps: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true },
  );
}

/** name/collection pairs for every ontology-materialized Mongo collection required by the spec. */
export const ONTOLOGY_COLLECTIONS: { name: string; collection: string }[] = [
  { name: 'HealthConditionModel', collection: 'healthConditions' },
  { name: 'WellnessGoalModel', collection: 'wellnessGoals' },
  { name: 'FacilityModel', collection: 'facilities' },
  { name: 'ProgramModel', collection: 'programs' },
  { name: 'EnvironmentConditionModel', collection: 'environmentConditions' },
  { name: 'MobilityConditionModel', collection: 'mobilityConditions' },
  { name: 'RiskModel', collection: 'risks' },
  { name: 'PolicyModel', collection: 'policies' },
  { name: 'RuleModel', collection: 'rules' },
  { name: 'AgentModel', collection: 'agents' },
  { name: 'CapabilityModel', collection: 'capabilities' },
  { name: 'ToolModel', collection: 'tools' },
  { name: 'TaskModel', collection: 'tasks' },
  { name: 'OperationModel', collection: 'operations' },
];
