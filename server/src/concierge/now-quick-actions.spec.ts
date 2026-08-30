import { routeNaturalLanguageIntent } from './intent-routing';
describe('NOW quick actions', () => {
  it.each([
    ['지금 식당을 찾고 싶어요', 'IMMEDIATE_NOW', 'FOOD'],
    ['잠시 쉬어갈 카페를 찾고 싶어요', 'PLACE_DISCOVERY', 'CAFE'],
    ['주변에 가볼 만한 곳을 찾고 싶어요', 'PLACE_DISCOVERY', 'TOURISM_NATURE'],
    ['다음 여행지를 추천해 주세요', 'REPLAN', 'TOURISM_NATURE'],
    ['지금 숙소를 찾고 싶어요', 'IMMEDIATE_NOW', 'LODGING'],
    ['지금 밥 먹고 싶어요', 'IMMEDIATE_NOW', 'FOOD'],
    ['지금 카페 가고 싶어요', 'IMMEDIATE_NOW', 'CAFE'],
    ['다음 어디 갈까요?', 'REPLAN', 'TOURISM_NATURE'],
    ['비가 와요', 'REPLAN', undefined],
    ['숙소로 갈래요', 'REPLAN', 'LODGING'],
    ['오늘 잘 곳', 'IMMEDIATE_NOW', 'LODGING'],
  ])(
    '%s enters the existing AI intent pipeline',
    (rawMessage, intentRoute, category) =>
      expect(
        routeNaturalLanguageIntent({ rawMessage, inputMode: 'FREE_TEXT' }),
      ).toEqual({ intentRoute, category }),
  );
  it.each([
    ['배고파','IMMEDIATE_NOW','FOOD'],['배가 고프다','IMMEDIATE_NOW','FOOD'],['밥 먹고 싶어','PLACE_DISCOVERY','FOOD'],['식당 어디 있어?','PLACE_DISCOVERY','FOOD'],['근처 밥집','PLACE_DISCOVERY','FOOD'],['뭐 먹지?','IMMEDIATE_NOW','FOOD'],['카페','PLACE_DISCOVERY','CAFE'],['잠깐 쉬고 싶어','PLACE_DISCOVERY','CAFE'],['다음 어디 가지?','REPLAN','TOURISM_NATURE'],['비가 와','REPLAN',undefined],['일정 다시 짜줘','REPLAN',undefined],
  ])('%s remains available to the existing natural-language pipeline',(rawMessage,intentRoute,category)=>expect(routeNaturalLanguageIntent({rawMessage,inputMode:'FREE_TEXT'})).toEqual({intentRoute,category}));
});
