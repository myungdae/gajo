export const CONTEXT_EXTRACTOR = Symbol('CONTEXT_EXTRACTOR');

export type ExtractionSource = 'LLM';
export interface ExtractedFact<T> { value: T; confidence: number; sourceText: string; source: ExtractionSource }
export interface ExtractedCompanion { relationship?: ExtractedFact<'mother'|'father'|'parent'|'spouse'|'other'>; age?: ExtractedFact<number>; count?: ExtractedFact<number> }
export interface ContextExtraction {
  companions?: ExtractedCompanion[];
  healthConditions?: ExtractedFact<string[]>;
  walkingLevel?: ExtractedFact<'LOW'|'MODERATE'|'HIGH'>;
  mobilityConstraints?: ExtractedFact<string[]>;
  transportMode?: ExtractedFact<'CAR'|'WALK'|'PUBLIC_TRANSPORT'|'UNKNOWN'>;
  stayUntilExact?: ExtractedFact<string>;
  stayUntilPeriod?: ExtractedFact<'MORNING'|'AFTERNOON'|'EVENING'|'NIGHT'>;
  preferences?: ExtractedFact<string[]>;
  intent?: ExtractedFact<'ITINERARY_REQUEST'|'NEARBY_DISCOVERY'|'FOLLOW_UP_MODIFICATION'|'INFORMATION_REQUEST'|'UNKNOWN'>;
  needsClarification?: boolean;
  clarificationReason?: string;
  suggestedQuestion?: string;
}
export interface ExtractorResult { status: 'SUCCESS'|'DISABLED'|'TIMEOUT'|'PROVIDER_ERROR'|'INVALID'; extraction?: ContextExtraction; provider: string; model?: string; latencyMs: number; errorCode?: string; usage?:{inputTokens?:number;outputTokens?:number} }
export interface ContextExtractor { extract(text: string): Promise<ExtractorResult> }
