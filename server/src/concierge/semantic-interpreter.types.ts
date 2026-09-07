export type SemanticIntent =
  | 'VISIT'
  | 'NAVIGATION'
  | 'PLACE_DISCOVERY'
  | 'INFORMATION'
  | 'REPLAN'
  | 'IMMEDIATE_NEED'
  | 'UNKNOWN';

export type SemanticReference =
  | 'EXPLICIT_ENTITY'
  | 'PREVIOUS_SUBJECT'
  | 'CURRENT_LOCATION'
  | 'NONE';

export type SemanticRelation =
  | 'NEW'
  | 'CONTINUE'
  | 'REPLACE'
  | 'MODIFY'
  | 'NONE';

export interface SemanticInterpretation {
  intent: SemanticIntent;
  subjectText: string | null;
  referenceType: SemanticReference;
  relationToPrevious: SemanticRelation;
  requestedAction: string | null;
  categoryHint: string | null;
  confidence: number;
}

export interface SemanticInterpretationResult {
  status: 'SUCCESS'|'DISABLED'|'TIMEOUT'|'PROVIDER_ERROR'|'INVALID';
  interpretation?: SemanticInterpretation;
  provider: string;
  model?: string;
  latencyMs: number;
  errorCode?: string;
}
