import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class EvidenceStep {
  @Prop() subject: string;
  @Prop() subjectLabel: string;
  @Prop() predicate: string;
  @Prop() predicateLabel: string;
  @Prop() object: string;
  @Prop() objectLabel: string;
}
export const EvidenceStepSchema = SchemaFactory.createForClass(EvidenceStep);

/**
 * A persisted, explainable recommendation produced by RecommendationService.
 * Every recommendation carries its full ontology-graph-traversal evidence
 * path so the "explainable AI" requirement is satisfiable end-to-end (not
 * just a text explanation from an LLM, but literal RDF edges walked).
 */
@Schema({ timestamps: true })
export class Recommendation {
  @Prop({ required: true, unique: true })
  recommendationNo: string;

  @Prop({ required: true })
  runtimeContextId: string;

  @Prop({ required: true, index: true, default: 'gajo' })
  regionId: string;

  @Prop({ type: [String], default: [] })
  candidateRegionIds: string[];

  @Prop()
  itineraryNo?: string;

  /** URIs of recommended gajo:Program individuals */
  @Prop({ type: [String], default: [] })
  recommendedPrograms: string[];

  /** URIs of recommended gajo:Facility individuals */
  @Prop({ type: [String], default: [] })
  recommendedFacilities: string[];

  @Prop()
  reasonSummary: string;

  @Prop({ type: [EvidenceStepSchema], default: [] })
  evidence: EvidenceStep[];

  /** URIs of gajo:SafetyRisk individuals surfaced in this recommendation */
  @Prop({ type: [String], default: [] })
  risks: string[];

  /** URI(s) of the roo:ArtificialAgent(s) that produced/decided this recommendation */
  @Prop({ type: [String], default: [] })
  decisionMadeBy: string[];

  @Prop({ type: Number, default: 0 })
  confidenceScore: number;

  @Prop()
  nextAction?: string;

  @Prop({ type: Object })
  decisionStages?: Record<string, any>;

  @Prop({ type: Object })
  interestCoverage?: { selected:string[];covered:string[];uncovered:string[] };
}

export type RecommendationDocument = Recommendation & Document;
export const RecommendationSchema = SchemaFactory.createForClass(Recommendation);
