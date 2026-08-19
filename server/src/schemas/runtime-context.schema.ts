import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * A persisted snapshot of one RuntimeContextService.createContext() call:
 * the semantic context the Orchestrator/Planner built from a single user
 * request (visitor + companions + health conditions + environment +
 * derived risks + selected operation). This is what the Ontology Explorer
 * and Admin Dashboard's "Runtime Contexts" view lists.
 */
@Schema({ timestamps: true })
export class RuntimeContext {
  @Prop({ required: true, unique: true })
  contextNo: string;

  @Prop({ required: true, index: true, default: 'gajo' })
  regionId: string;

  @Prop()
  duration?: string;

  @Prop()
  visitorNo?: string;

  @Prop()
  rawMessage?: string;

  /** URIs of gajo:Visitor / gajo:Companion individuals (or ad-hoc runtime individuals) */
  @Prop({ type: [String], default: [] })
  actors: string[];

  /** URIs of gajo:HealthCondition individuals attached to actors */
  @Prop({ type: [String], default: [] })
  healthConditions: string[];

  /** Structured companions parsed from the request or supplied explicitly. */
  @Prop({ type: [Object], default: [] })
  companions: { age?: number; relationship?: string; healthConditions: string[] }[];

  /** URIs of gajo:WellnessGoal individuals */
  @Prop({ type: [String], default: [] })
  wellnessGoals: string[];

  /** Controlled visitor selections not yet represented as ontology WellnessGoal individuals. */
  @Prop({ type: [String], default: [] })
  activityPreferences: string[];

  @Prop({ type: [Object], default: [] })
  mustVisitPlaces: { entityId?: string; label: string; resolved: boolean }[];

  @Prop({ type: [Object], default: [] })
  accommodationIntents: { entityId?: string; label: string; resolved: boolean }[];

  /** URIs of gajo:WeatherCondition / gajo:CongestionCondition individuals */
  @Prop({ type: [String], default: [] })
  environmentConditions: string[];

  /** URIs derived via roo:semanticallyExpandsTo (mobility conditions, preferences, ...) */
  @Prop({ type: [String], default: [] })
  expandedConditions: string[];

  /** URIs of gajo:SafetyRisk individuals identified for this context */
  @Prop({ type: [String], default: [] })
  risks: string[];

  /** URI of the selected gajo:ConciergeOperation */
  @Prop()
  operationUri?: string;

  /** URIs of roo:Policy individuals that govern this context */
  @Prop({ type: [String], default: [] })
  policies: string[];

  @Prop() currentTime?: string;
  @Prop() currentDate?: string;
  @Prop() dayOfWeek?: string;
  @Prop() weather?: string;
  @Prop() weatherState?: string;
  @Prop() temperature?: number;
  @Prop() precipitation?: number;
  @Prop({ type: Object }) weatherObservation?: { regionId:string;observedAt:string;source:string;locationSourceId:string };
  @Prop() latitude?: number;
  @Prop() longitude?: number;
  @Prop() transportMode?: string;
  @Prop() stayUntil?: string;
  @Prop() stayUntilPeriod?: string;
  @Prop() extractedIntent?: string;
  @Prop() walkingLevel?: string;
  @Prop({ type: [String], default: [] }) companionConstraints: string[];
  @Prop() congestionState?: string;

  /** Operational observations keyed by static ontology entity URI. */
  @Prop({ type: [Object], default: [] })
  runtimeStates: Record<string, any>[];

  @Prop({ type: Object, default: {} })
  raw: Record<string, any>;
}

export type RuntimeContextDocument = RuntimeContext & Document;
export const RuntimeContextSchema = SchemaFactory.createForClass(RuntimeContext);
