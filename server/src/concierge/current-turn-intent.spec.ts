import { routeNaturalLanguageIntent } from './intent-routing';

describe('current-turn category continuity', () => {
  it('keeps an elliptical alternative in the current cafe discovery category', () => {
    expect(routeNaturalLanguageIntent({ rawMessage: '다른 곳은?', inputMode: 'FREE_TEXT', isFollowup: true, discoveryCategoryHint: 'CAFE' })).toMatchObject({ intentRoute: 'PLACE_DISCOVERY', category: 'CAFE', alternative: true });
  });
  it('lets an explicit food request replace cafe context', () => {
    expect(routeNaturalLanguageIntent({ rawMessage: '그럼 밥 먹을 곳은?', inputMode: 'FREE_TEXT', isFollowup: false, discoveryCategoryHint: 'CAFE' })).toEqual({ intentRoute: 'PLACE_DISCOVERY', category: 'FOOD' });
  });
  it('keeps weather-only followups in REPLAN', () => {
    expect(routeNaturalLanguageIntent({ rawMessage: '비가 와.', inputMode: 'FREE_TEXT', isFollowup: true, discoveryCategoryHint: 'CAFE' })).toEqual({ intentRoute: 'REPLAN', category: undefined });
  });
});
