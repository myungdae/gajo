import { PlaceDiscoveryService } from './place-discovery.service';
import { RegionConfigService } from '../region/region-config.service';
import { NearbyService } from '../nearby/nearby.service';

describe('receipt 36 operational-region contracts', () => {
  afterEach(()=>jest.restoreAllMocks());
  const config=(values:Record<string,unknown>)=>({get:jest.fn((key:string)=>values[key])} as any),response=(body:any)=>({ok:true,status:200,json:jest.fn(async()=>body)} as any);
  it('adopts OUTSIDE GPS and detects Gajo without changing the Hapcheon experience',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{address:{address_name:'경상남도 거창군 가조면 지산로 1477',region_1depth_name:'경상남도',region_2depth_name:'거창군',region_3depth_name:'가조면'}}]}));await expect(new NearbyService(config({KAKAO_REST_API_KEY:'key'})).reverseGeocode(35.708488,128.0158,'hapcheon',20)).resolves.toMatchObject({regionMembership:'OUTSIDE',searchRegionId:'gajo'})});
  it('keeps unsupported coordinate results and provider identity without a service-region filter',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{id:'1554326093',place_name:'미가추어탕',category_name:'음식점 > 한식',category_group_code:'FD6',address_name:'경상남도 거창군 가조면',road_address_name:'경상남도 거창군 가조면 지산로 1477',y:'35.708488',x:'128.0158',distance:'10',place_url:'https://place.map.kakao.com/1554326093'}],meta:{is_end:true}}));const [place]=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('FOOD',35.708488,128.0158,1000,{},undefined);expect(place).toMatchObject({provider:'KAKAO',providerPlaceId:'1554326093',administrativeRegion:'거창군 가조면'})});
  it('resolves a provider place as an individual identity instead of a free-text placeholder', async () => {
    const regional = {
        effectiveDataset: jest.fn(async () => ({ records: [] })),
      },
      nearby = {
        searchByKeyword: jest.fn(async () => [
          {
            id: '1554326093',
            provider: 'KAKAO',
            providerPlaceId: '1554326093',
            name: '미가추어탕',
            category: 'FOOD',
            lat: 35.708488,
            lng: 128.0158,
            address: '경상남도 거창군 가조면 지산로 1477',
            placeUrl: 'https://place.map.kakao.com/1554326093',
          },
        ]),
      };
    const [place]: any = await new PlaceDiscoveryService(
      regional as any,
      undefined,
      nearby as any,
      undefined,
      new RegionConfigService(),
    ).resolveRequestedDestinations('hapcheon', ['미가 추어탕'], {
      searchRegionId: 'gajo',
      latitude: 35.708488,
      longitude: 128.0158,
    });
    expect(place).toMatchObject({
      entityId: 'provider:kakao:1554326093',
      provider: 'KAKAO',
      providerPlaceId: '1554326093',
      label: '미가추어탕',
      resolved: true,
      source: 'SEARCH',
      category: 'FOOD',
      regionId: 'gajo',
    });
  });
  it('does not arbitrarily resolve duplicate normalized provider names', async () => {
    const regional = {
        effectiveDataset: jest.fn(async () => ({ records: [] })),
      },
      nearby = {
        searchByKeyword: jest.fn(async () =>
          [1, 2].map((id) => ({
            id: String(id),
            provider: 'KAKAO',
            providerPlaceId: String(id),
            name: '동일식당',
            category: 'FOOD',
            lat: 35.7,
            lng: 128,
            address: `주소 ${id}`,
          })),
        ),
      };
    const [place]: any = await new PlaceDiscoveryService(
      regional as any,
      undefined,
      nearby as any,
      undefined,
      new RegionConfigService(),
    ).resolveRequestedDestinations('hapcheon', ['동일식당'], {
      searchRegionId: 'gajo',
    });
    expect(place).toMatchObject({
      resolved: false,
      ambiguity: {
        candidates: [{ providerPlaceId: '1' }, { providerPlaceId: '2' }],
      },
    });
  });
});
