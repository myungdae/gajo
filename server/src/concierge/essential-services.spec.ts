import { discoveryCategory, routeNaturalLanguageIntent } from './intent-routing';
import { essentialServiceReadiness, safeEssentialActions } from './essential-services';

describe('shared hyperlocal essential services', () => {
  it.each([
    ['화장실 어디 있어?', 'PUBLIC_TOILET'], ['엄마가 화장실 가셔야 해.', 'PUBLIC_TOILET'],
    ['차 어디 세워?', 'PARKING'], ['기름 넣어야 해.', 'GAS_STATION'],
    ['전기차 충전할 곳?', 'EV_CHARGER'], ['관광안내소 어디예요?', 'TOURIST_INFORMATION'],
  ])('routes %s to %s', (message, category) => expect(discoveryCategory(message)).toBe(category));

  it('prioritizes an explicit urgent need without medical inference', () => {
    expect(routeNaturalLanguageIntent({ rawMessage: '어머니가 화장실을 급하게 찾으세요.', inputMode: 'FREE_TEXT' }))
      .toMatchObject({ intentRoute: 'IMMEDIATE_NOW', category: 'PUBLIC_TOILET', priority: 'ESSENTIAL_IMMEDIATE' });
  });

  it('preserves the essential category for conversational alternatives', () => {
    expect(routeNaturalLanguageIntent({ rawMessage: '다른 데는?', inputMode: 'FREE_TEXT', isFollowup: true, discoveryCategoryHint: 'PUBLIC_TOILET' }))
      .toMatchObject({ intentRoute: 'PLACE_DISCOVERY', category: 'PUBLIC_TOILET', alternative: true });
  });

  it('never exposes navigation from unverified or coordinate-free evidence', () => {
    expect(safeEssentialActions({ runtimeDataStatus: 'UNVERIFIED', latitude: 36, longitude: 127, actions: { navigate: 'unsafe' } })).toEqual({ navigate: undefined, call: undefined });
    expect(safeEssentialActions({ runtimeDataStatus: 'VERIFIED', actions: { navigate: 'unsafe' } }).navigate).toBeUndefined();
  });

  it('audits every region independently without cross-region counts', () => {
    const hapcheon = essentialServiceReadiness([{ regionId:'hapcheon', entityType:'PUBLIC_TOILET', runtimeDataStatus:'VERIFIED', latitude:35, longitude:128 }]);
    const gajo = essentialServiceReadiness([]);
    expect(hapcheon.PUBLIC_TOILET).toMatchObject({ status:'READY', canonicalCount:1 });
    expect(gajo.PUBLIC_TOILET).toMatchObject({ status:'DATA_REQUIRED', canonicalCount:0 });
  });
});
