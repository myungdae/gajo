import { routeNaturalLanguageIntent } from './intent-routing';

describe('Gajo representative destination golden routing', () => {
  it.each([
    ['창포원 가고 싶어요.', ['창포원']],
    ['수승대 가고 싶어요.', ['수승대']],
  ])('preserves the explicit destination in %s', (rawMessage, explicitDestinations) => {
    expect(routeNaturalLanguageIntent({ rawMessage, inputMode: 'FREE_TEXT' })).toEqual({
      intentRoute: 'JOURNEY_PLAN',
      category: undefined,
      multiDestination: false,
      explicitDestinations,
    });
  });

  it('preserves both destinations in the combined request', () => {
    expect(routeNaturalLanguageIntent({ rawMessage: '창포원하고 수승대 가고 싶어요.', inputMode: 'FREE_TEXT' })).toEqual({
      intentRoute: 'JOURNEY_PLAN',
      category: undefined,
      multiDestination: true,
      explicitDestinations: ['창포원', '수승대'],
    });
  });

  it.each([
    ['어디부터 갈까?', 'REPLAN', undefined],
    ['수승대 근처 밥집은?', 'PLACE_DISCOVERY', 'FOOD'],
    ['창포원 근처 카페는?', 'PLACE_DISCOVERY', 'CAFE'],
  ])('routes the follow-up %s safely', (rawMessage, intentRoute, category) => {
    expect(routeNaturalLanguageIntent({ rawMessage, inputMode: 'FREE_TEXT', isFollowup: true })).toMatchObject({ intentRoute, ...(category ? { category } : {}) });
  });
});
