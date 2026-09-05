import { HAPCHEON_MASTER_DATA } from './master-data';

describe('Hapcheon Smile Pension official links', () => {
  const pension = HAPCHEON_MASTER_DATA.find(
    (place) => place.canonicalId === 'hapcheon-lake-smile-pension',
  )!;

  it('keeps the exact Naver place identity separate from official evidence', () => {
    expect(pension).toMatchObject({
      naverPlaceId: '32722117',
      naverPlaceUrl:
        'https://m.place.naver.com/accommodation/32722117/home?businessCategory=pension',
      officialEvidenceUrl:
        'https://www.hc.go.kr/06574/06590/06606.web?amode=view&idx=90',
      lastVerifiedAt: '2026-09-05',
    });
    expect(pension.actions.detail?.url).toBe(pension.naverPlaceUrl);
    expect(pension.actions.website?.url).toBe('https://www.lakesmile.com/');
    expect(pension.actions.reserve).toBeUndefined();
  });
});
