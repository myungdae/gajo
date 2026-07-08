/**
 * Namespace prefixes used across the Runtime Operational Ontology (ROO) core
 * and the Gajo AI Concierge domain ontology.
 *
 * These MUST stay in sync with the @prefix declarations in the .ttl files
 * under `src/ontology-data/`, since the OntologyGraphService loads those
 * files verbatim as the single source of truth for the knowledge graph.
 */
export const ROO = 'https://linkeddata.center/roo-core#';
export const GAJO = 'https://gajo-wellness.kr/ontology#';
export const SCHEMA = 'https://schema.org/';
export const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
export const OWL = 'http://www.w3.org/2002/07/owl#';
export const XSD = 'http://www.w3.org/2001/XMLSchema#';

export const RDF_TYPE = `${RDF}type`;
export const RDFS_LABEL = `${RDFS}label`;
export const RDFS_COMMENT = `${RDFS}comment`;
export const RDFS_SUBCLASSOF = `${RDFS}subClassOf`;
export const RDFS_DOMAIN = `${RDFS}domain`;
export const RDFS_RANGE = `${RDFS}range`;
export const OWL_CLASS = `${OWL}Class`;
export const OWL_OBJECT_PROPERTY = `${OWL}ObjectProperty`;
export const OWL_DATATYPE_PROPERTY = `${OWL}DatatypeProperty`;
export const OWL_ONTOLOGY = `${OWL}Ontology`;

// Frequently traversed ROO-core relationships
export const roo = (local: string) => `${ROO}${local}`;
export const gajo = (local: string) => `${GAJO}${local}`;

export const PRED = {
  semanticallyExpandsTo: roo('semanticallyExpandsTo'),
  relatedTo: roo('relatedTo'),
  hasRisk: roo('hasRisk'),
  mitigatesRisk: roo('mitigatesRisk'),
  increasesRisk: roo('increasesRisk'),
  hasEvidence: roo('hasEvidence'),
  basedOnContext: roo('basedOnContext'),
  hasActor: roo('hasActor'),
  hasEntity: roo('hasEntity'),
  hasState: roo('hasState'),
  hasOperation: roo('hasOperation'),
  hasTask: roo('hasTask'),
  requiresCapability: roo('requiresCapability'),
  assignedToAgent: roo('assignedToAgent'),
  hasCapability: roo('hasCapability'),
  usesTool: roo('usesTool'),
  governedByPolicy: roo('governedByPolicy'),
  hasRule: roo('hasRule'),
  ifCondition: roo('ifCondition'),
  thenAction: roo('thenAction'),
  thenRecommendation: roo('thenRecommendation'),
  decisionMadeBy: roo('decisionMadeBy'),
  confidenceScore: roo('confidenceScore'),
  riskLevel: roo('riskLevel'),
  priority: roo('priority'),
  description: roo('description'),

  hasCompanion: gajo('hasCompanion'),
  hasHealthCondition: gajo('hasHealthCondition'),
  hasWellnessGoal: gajo('hasWellnessGoal'),
  affectedByEnvironment: gajo('affectedByEnvironment'),
  suitableForHealthCondition: gajo('suitableForHealthCondition'),
  suitableForWellnessGoal: gajo('suitableForWellnessGoal'),
  requiresMobilityCondition: gajo('requiresMobilityCondition'),
  heldAtFacility: gajo('heldAtFacility'),
  offersProgram: gajo('offersProgram'),
  connectedToFacility: gajo('connectedToFacility'),
  hasAccessibilityFeature: gajo('hasAccessibilityFeature'),
  recommendedItinerary: gajo('recommendedItinerary'),
  recommendedFacility: gajo('recommendedFacility'),
  recommendedProgram: gajo('recommendedProgram'),
  age: gajo('age'),
  isIndoor: gajo('isIndoor'),
  isAccessible: gajo('isAccessible'),
  requiresReservation: gajo('requiresReservation'),
  durationMinutes: gajo('durationMinutes'),
};

export const CLASS = {
  HealthCondition: gajo('HealthCondition'),
  WellnessGoal: gajo('WellnessGoal'),
  EnvironmentCondition: gajo('EnvironmentCondition'),
  WeatherCondition: gajo('WeatherCondition'),
  CongestionCondition: gajo('CongestionCondition'),
  MobilityCondition: gajo('MobilityCondition'),
  SafetyRisk: gajo('SafetyRisk'),
  Facility: gajo('Facility'),
  Program: gajo('Program'),
  ArtificialAgent: roo('ArtificialAgent'),
  Capability: roo('Capability'),
  Tool: roo('Tool'),
  Task: roo('Task'),
  Operation: gajo('ConciergeOperation'),
  Policy: roo('Policy'),
  Rule: roo('Rule'),
};
