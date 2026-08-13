import { validateContextExtraction } from './context-extraction.validator';
import { mergeContextExtractions } from './context-extraction.merger';
import { parseNaturalLanguageContext } from './natural-language-context.parser';

const llmResult=(extraction:any)=>({status:'SUCCESS' as const,provider:'mock',model:'test',latencyMs:2,extraction});
const f=(value:any,sourceText='말씀')=>({value,confidence:.9,sourceText,source:'LLM' as const});

describe('context extraction validation and merge',()=>{
  it('accepts valid controlled facts',()=>expect(validateContextExtraction({transportMode:f('CAR'),needsClarification:false})?.transportMode?.value).toBe('CAR'));
  it('rejects invented enum values',()=>expect(validateContextExtraction({transportMode:f('PRIVATE_VEHICLE_PROBABLY')})).toBeUndefined());
  it('uses an LLM-only valid fact',()=>expect(mergeContextExtractions(parseNaturalLanguageContext('추천해 주세요'),llmResult({transportMode:f('CAR')})).transportMode).toBe('CAR'));
  it('records agreement',()=>expect(mergeContextExtractions(parseNaturalLanguageContext('자동차로 이동해요'),llmResult({transportMode:f('CAR')})).diagnostics[0].resolution).toBe('AGREED'));
  it('lets an explicit deterministic fact win a conflict',()=>{const merged=mergeContextExtractions(parseNaturalLanguageContext('오후 5시까지 있어요'),llmResult({stayUntilExact:f('18:00','오후 5시까지')}));expect(merged.stayUntil).toBe('17:00');expect(merged.diagnostics.find(x=>x.field==='stayUntil')?.resolution).toBe('DETERMINISTIC_WINS')});
  it('does not invent an exact time for a vague period',()=>{const merged=mergeContextExtractions(parseNaturalLanguageContext('저녁쯤 돌아가야 해요'),llmResult({stayUntilPeriod:f('EVENING','저녁쯤')}));expect(merged.stayUntil).toBeUndefined();expect(merged.stayUntilPeriod).toBe('EVENING')});
  it('preserves current explicit fields when a follow-up omits them',()=>{const patch=mergeContextExtractions(parseNaturalLanguageContext('4시에 가야 해요'),llmResult({intent:f('FOLLOW_UP_MODIFICATION')}));const current={transportMode:'CAR',companions:[{age:78}]};expect({...current,...Object.fromEntries(Object.entries({stayUntil:patch.stayUntil}).filter(([,v])=>v!==undefined))}).toMatchObject({transportMode:'CAR',companions:[{age:78}],stayUntil:'16:00'})});
  it('does not carry recommendation leakage into its owned model',()=>expect((validateContextExtraction({transportMode:f('CAR'),recommendedFacility:'somewhere'}) as any).recommendedFacility).toBeUndefined());
  it('never promotes runtime-only preferences to invented wellness-goal URIs',()=>{const merged=mergeContextExtractions(parseNaturalLanguageContext('온천과 카페에 가고 싶어요'),llmResult({preferences:f(['HOT_SPRING','CAFE'],'온천과 카페')}));expect(merged.activityPreferences).toEqual(expect.arrayContaining(['HOT_SPRING','CAFE']));expect(merged.wellnessGoals).not.toEqual(expect.arrayContaining(['hotSpringWellness','cafePreference']))});
  it('promotes only the exact REST_AND_RECOVERY ontology goal',()=>expect(mergeContextExtractions(parseNaturalLanguageContext('편안하게 쉬고 싶어요'),llmResult({preferences:f(['REST_AND_RECOVERY'],'쉬고 싶어요')})).wellnessGoals).toContain('restAndRecovery'));

  it.each([
    ['엄마가 오래 걸으면 힘들어하세요. 차 가지고 왔고 저녁에는 돌아가야 합니다.', {walkingLevel:f('LOW','오래 걸으면 힘들어하세요'),transportMode:f('CAR','차 가지고 왔고'),stayUntilPeriod:f('EVENING','저녁에는'),preferences:f(['REST_AND_RECOVERY','LOW_WALKING'],'오래 걸으면 힘들어하세요')}, {transportMode:'CAR',walkingLevel:'LOW',stayUntilPeriod:'EVENING'}],
    ['아버지는 걷는 건 괜찮아요. 야외에서 좀 걷고 싶습니다.', {walkingLevel:f('MODERATE','걷는 건 괜찮아요'),preferences:f(['OUTDOOR','NATURE'],'야외에서 좀 걷고')}, {walkingLevel:'MODERATE'}],
    ['아이 둘이랑 왔고 비가 와서 실내에서 쉬고 싶어요.', {preferences:f(['INDOOR','REST_AND_RECOVERY'],'실내에서 쉬고 싶어요')}, {}],
    ['온천하고 밥 먹고 카페 정도 가고 싶어요.', {preferences:f(['HOT_SPRING','FOOD','CAFE'],'온천하고 밥 먹고 카페')}, {}],
    ['어머니가 많이 피곤해하셔서 남은 일정은 짧게 해주세요.', {healthConditions:f(['fatigue'],'많이 피곤해하셔서'),walkingLevel:f('LOW','남은 일정은 짧게'),intent:f('FOLLOW_UP_MODIFICATION','남은 일정은')}, {walkingLevel:'LOW'}],
  ])('merges controlled facts for free Korean: %s',(utterance,extraction,expected)=>expect(mergeContextExtractions(parseNaturalLanguageContext(utterance),llmResult(extraction))).toMatchObject(expected));
});
