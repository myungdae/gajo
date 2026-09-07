import { discoveryCategory, type DiscoveryCategory } from './intent-routing';
import { SemanticInterpretation } from './semantic-interpreter.types';

export interface SemanticRuntimeSignal {
  explicitSubjectText?: string;
  usePreviousSubject: boolean;
  replacePreviousSubject: boolean;
  continuePreviousSubject: boolean;
  requestedAction?: string;
  categoryHint?: string;
  semanticIntent: SemanticInterpretation['intent'];
}

export function toSemanticRuntimeSignal(
  semantic?: SemanticInterpretation,
): SemanticRuntimeSignal | undefined {
  if (!semantic) return undefined;

  return {
    explicitSubjectText:
      semantic.referenceType === 'EXPLICIT_ENTITY' && semantic.subjectText
        ? semantic.subjectText
        : undefined,
    usePreviousSubject:
      semantic.referenceType === 'PREVIOUS_SUBJECT',
    replacePreviousSubject:
      semantic.relationToPrevious === 'REPLACE',
    continuePreviousSubject:
      semantic.relationToPrevious === 'CONTINUE',
    requestedAction: semantic.requestedAction || undefined,
    categoryHint: semantic.categoryHint || undefined,
    semanticIntent: semantic.intent,
  };
}

export function semanticDiscoveryCategory(
  categoryHint?: string,
  requestedAction?: string,
): DiscoveryCategory | undefined {
  const semanticText = [categoryHint, requestedAction]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!semanticText) return undefined;

  return discoveryCategory(semanticText);
}
