import { ContextExtraction, ExtractedFact } from './context-extractor.types';

const ENUMS = {
  walkingLevel: ['LOW','MODERATE','HIGH'], transportMode: ['CAR','WALK','PUBLIC_TRANSPORT','UNKNOWN'],
  stayUntilPeriod: ['MORNING','AFTERNOON','EVENING','NIGHT'],
  healthConditions: ['kneePain','limitedMobility','fatigue','hypertensionConcern'],
  mobilityConstraints: ['shortWalkingDistance','limitedMobility'],
  preferences: ['REST_AND_RECOVERY','LOW_WALKING','FOOD','CAFE','NATURE','HOT_SPRING','INDOOR','OUTDOOR'],
  intent: ['ITINERARY_REQUEST','NEARBY_DISCOVERY','FOLLOW_UP_MODIFICATION','INFORMATION_REQUEST','UNKNOWN'],
} as const;

function fact<T>(candidate: any, validate: (value:any)=>boolean): ExtractedFact<T>|undefined {
  if (!candidate || !validate(candidate.value) || typeof candidate.confidence !== 'number' || candidate.confidence < 0 || candidate.confidence > 1 || !String(candidate.sourceText || '').trim()) return undefined;
  return { value: candidate.value, confidence: candidate.confidence, sourceText: String(candidate.sourceText).trim(), source: 'LLM' };
}

export function validateContextExtraction(value: any): ContextExtraction | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: ContextExtraction = {};
  const enumFact = (key: keyof typeof ENUMS) => fact(value[key], v => (ENUMS[key] as readonly unknown[]).includes(v));
  for (const key of ['transportMode','walkingLevel','stayUntilPeriod','intent'] as const) if (value[key] != null && !enumFact(key)) return undefined;
  if (value.stayUntilExact != null && !fact(value.stayUntilExact, v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v))) return undefined;
  for (const key of ['healthConditions','mobilityConstraints','preferences'] as const) if (value[key] != null && !fact(value[key], v => Array.isArray(v) && v.every(x => (ENUMS[key] as readonly unknown[]).includes(x)))) return undefined;
  out.transportMode = enumFact('transportMode') as any; out.walkingLevel = enumFact('walkingLevel') as any;
  out.stayUntilPeriod = enumFact('stayUntilPeriod') as any; out.intent = enumFact('intent') as any;
  out.stayUntilExact = fact(value.stayUntilExact, v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
  for (const key of ['healthConditions','mobilityConstraints','preferences'] as const) out[key] = fact(value[key], v => Array.isArray(v) && v.every(x => (ENUMS[key] as readonly unknown[]).includes(x))) as any;
  if (value.companions != null && !Array.isArray(value.companions)) return undefined;
  if (Array.isArray(value.companions)) out.companions = value.companions.map((item:any) => ({
    relationship: fact(item.relationship, v => ['mother','father','parent','spouse','other'].includes(v)),
    age: fact(item.age, v => Number.isInteger(v) && v >= 0 && v <= 120), count: fact(item.count, v => Number.isInteger(v) && v >= 1 && v <= 20),
  })).filter((item:any) => item.relationship || item.age || item.count);
  if (Array.isArray(value.companions) && (out.companions?.length || 0) !== value.companions.length) return undefined;
  out.needsClarification = value.needsClarification === true;
  if (out.needsClarification) { out.clarificationReason = String(value.clarificationReason || '').slice(0,300); out.suggestedQuestion = String(value.suggestedQuestion || '').slice(0,300); }
  return out;
}
