import { canonicalAccommodationProfile } from './accommodation-taxonomy';

describe('canonicalAccommodationProfile',()=>{
  it.each(['GLAMPING','CAMPING','AUTO_CAMPING','CARAVAN'])('maps legacy %s additively to one accommodation category',(accommodationType)=>{
    const record={entityUri:'stable-place-id',entityType:'ACCOMMODATION',accommodationType};
    expect(canonicalAccommodationProfile(record)).toEqual({
      primaryCategory:'ACCOMMODATION', accommodationType:'CAMPING_GLAMPING',
      facets:['OUTDOOR','NATURE_EXPERIENCE'], legacyAccommodationType:accommodationType,
    });
    expect(record.entityUri).toBe('stable-place-id');
    expect(record.accommodationType).toBe(accommodationType);
  });
});
