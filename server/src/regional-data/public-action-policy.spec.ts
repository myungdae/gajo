import {
  safeExternalHttpsUrl,
  verifiedDirectBookingAction,
} from './public-action-policy';

describe('public action policy', () => {
  const evidence = {
    kind: 'DIRECT_BOOKING' as const,
    verificationStatus: 'VERIFIED' as const,
    verifiedUrl: 'https://book.example/stay',
    sourceUrl: 'https://stay.example/booking-guide',
    verifiedAt: '2026-08-31T00:00:00Z',
  };
  it('requires https without credentials', () => {
    expect(safeExternalHttpsUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeExternalHttpsUrl('https://u:p@example.com')).toBeUndefined();
  });
  it('requires evidence bound to a distinct direct booking URL', () => {
    expect(
      verifiedDirectBookingAction(
        evidence.verifiedUrl,
        evidence,
        'https://stay.example/',
      ),
    ).toEqual({ url: evidence.verifiedUrl, evidenceMode: 'VERIFIED_DIRECT' });
    expect(
      verifiedDirectBookingAction(
        'https://stay.example/',
        { ...evidence, verifiedUrl: 'https://stay.example/' },
        'https://stay.example/',
      ),
    ).toBeUndefined();
    expect(
      verifiedDirectBookingAction(
        evidence.verifiedUrl,
        undefined,
        'https://stay.example/',
      ),
    ).toBeUndefined();
  });
});
