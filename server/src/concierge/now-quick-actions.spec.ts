import { routeNaturalLanguageIntent } from './intent-routing';
describe('NOW quick actions', () => {
  it.each([
    ['지금 밥 먹고 싶어요', 'IMMEDIATE_NOW', 'FOOD'],
    ['지금 카페 가고 싶어요', 'IMMEDIATE_NOW', 'CAFE'],
    ['다음 어디 갈까요?', 'REPLAN', 'TOURISM_NATURE'],
    ['비가 와요', 'REPLAN', undefined],
    ['숙소로 갈래요', 'REPLAN', 'LODGING'],
  ])(
    '%s enters the existing AI intent pipeline',
    (rawMessage, intentRoute, category) =>
      expect(
        routeNaturalLanguageIntent({ rawMessage, inputMode: 'FREE_TEXT' }),
      ).toEqual({ intentRoute, category }),
  );
});
