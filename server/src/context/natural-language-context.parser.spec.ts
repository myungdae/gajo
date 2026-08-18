import { parseNaturalLanguageContext } from './natural-language-context.parser';

describe('parseNaturalLanguageContext', () => {
  it('extracts the Daejeon Jung-gu parent urban-day scenario',()=>{const result=parseNaturalLanguageContext('부모님과 대전 중구에 왔어요. 많이 걷기는 힘들어하시고, 점심을 먹은 뒤 은행동과 중앙시장 쪽을 둘러보고 카페에서 쉬다가 오후 6시쯤 돌아가고 싶어요.');expect(result.companions[0]?.relationship).toBe('parent');expect(result.walkingLevel).toBe('LOW');expect(result.stayUntil).toBe('18:00');expect(result.activityPreferences).toEqual(expect.arrayContaining(['FOOD','CAFE','URBAN_CULTURE','TRADITIONAL_MARKET']))});
  it('extracts the Hapcheon lake and pension stay scenario deterministically',()=>{const result=parseNaturalLanguageContext('가족과 합천호에 놀러 가려고 합니다. 차를 가지고 가고 많이 걷지는 않으려고 해요. 맛있는 것도 먹고 호수 주변을 둘러본 뒤 전원펜션에서 하루 묵고 싶습니다.');expect(result.transportMode).toBe('CAR');expect(result.walkingLevel).toBe('LOW');expect(result.activityPreferences).toEqual(expect.arrayContaining(['HAPCHEON_LAKE','NATURE','FOOD','ACCOMMODATION']));expect(result.explicitAccommodation).toBe('전원펜션')});
  it.each([
    ['78세 어머니와 왔습니다', 78, 'mother'],
    ['80세 부모님과 왔어요', 80, 'parent'],
    ['75세 아버지와 함께 왔습니다', 75, 'father'],
  ])('parses companion from %s', (message, age, relationship) => {
    expect(parseNaturalLanguageContext(message).companions[0]).toMatchObject({ age, relationship });
  });

  it.each(['자동차로 이동합니다', '차로 왔어요', '자가용으로 이동해요'])('parses car transport from %s', message => {
    expect(parseNaturalLanguageContext(message).transportMode).toBe('CAR');
  });

  it.each([['오후 5시까지 머물 예정입니다', '17:00'], ['5시까지 있을게요', '17:00'], ['오늘 17시까지 있습니다', '17:00']])('parses stay time from %s', (message, expected) => {
    expect(parseNaturalLanguageContext(message).stayUntil).toBe(expected);
  });

  it('hydrates the complete end-to-end demo sentence', () => {
    const parsed = parseNaturalLanguageContext('78세 어머니와 가조에 왔습니다. 어머니는 무릎이 조금 불편합니다. 자동차로 이동하고 오후 5시까지 머물 예정입니다. 지금 상황에 맞게 편안한 일정을 추천해 주세요.');
    expect(parsed).toMatchObject({
      companions: [{ age: 78, relationship: 'mother' }],
      conditions: ['kneePain'], transportMode: 'CAR', stayUntil: '17:00',
      walkingLevel: 'LOW', wellnessGoal: 'restAndRecovery',
    });
    expect(parsed.companionConstraints).toEqual(expect.arrayContaining(['elderlyCompanion', 'shortWalkingDistance']));
  });

  it.each(['주차장이 넓어요', '기차표를 확인해 주세요', '차가운 물'])('does not falsely parse transport from %s', message => {
    expect(parseNaturalLanguageContext(message).transportMode).toBeUndefined();
  });

  it.each(['온천은 꼭 하고 싶어요','온천 하고 싶어요','온천은 반드시 가고 싶어요'])('extracts controlled hot-spring preference from %s',message=>{
    expect(parseNaturalLanguageContext(message).activityPreferences).toContain('HOT_SPRING');
  });

  it.each(['5시에 만나요', '17시 프로그램', '25시까지'])('does not falsely parse stay time from %s', message => {
    expect(parseNaturalLanguageContext(message).stayUntil).toBeUndefined();
  });
});
