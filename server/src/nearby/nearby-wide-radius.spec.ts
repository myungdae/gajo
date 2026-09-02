import { NEARBY_CACHE_MAX_ENTRIES, NEARBY_CACHE_TTL_MS, NearbyService, WIDE_PROVIDER_SEARCH_MAX_CALLS, WIDE_SEARCH_CONCURRENCY, wideSearchCenters } from './nearby.service';

const origin = { lat: 35.55, lng: 128.05 };
const offset = (meters:number, angle:number) => ({
  lat: origin.lat + meters * Math.cos(angle) / 111320,
  lng: origin.lng + meters * Math.sin(angle) / (111320 * Math.cos(origin.lat * Math.PI / 180)),
});
const planarDistance = (a:{lat:number;lng:number}, b:{lat:number;lng:number}) => {
  const north = (a.lat - b.lat) * 111320;
  const east = (a.lng - b.lng) * 111320 * Math.cos(origin.lat * Math.PI / 180);
  return Math.hypot(north, east);
};
const place = (id:string, point:{lat:number;lng:number}) => ({
  id, provider:'KAKAO', providerPlaceId:id, name:id, category:'FOOD', categoryLabel:'맛집',
  providerCategoryName:'음식점', address:'', lat:point.lat, lng:point.lng, placeUrl:'',
  indoorRelevance:'INDOOR', operatingState:'UNKNOWN', operatingMessage:'', contextualReasons:[],
  transient:true, relevanceScore:0,
} as const);

describe('explicit wide nearby search', () => {
  it.each([30000, 40000, 50000] as const)('%ikm layout covers every sampled point without a >20km gap', (radius) => {
    const centers = wideSearchCenters(origin.lat, origin.lng, radius);
    for (let distance=0; distance<=radius; distance+=1000) for (let degree=0; degree<360; degree++) {
      const point=offset(distance,degree*Math.PI/180);
      expect(Math.min(...centers.map(center=>planarDistance(point,center)))).toBeLessThanOrEqual(20000.01);
    }
  });

  it('finds 50km boundary fixtures in all eight compass directions', async () => {
    const service = new NearbyService({ get: jest.fn(() => undefined) } as any);
    const fixtures=Array.from({length:8},(_,index)=>place(`boundary-${index}`,offset(49900,index*Math.PI/4)));
    const search=jest.spyOn(service,'search').mockImplementation(async (_c,lat,lng)=>fixtures.filter(item=>planarDistance(item,{lat,lng})<=20000));
    const result=await service.searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE');
    expect(search).toHaveBeenCalledTimes(13);
    expect(result.results.map(item=>item.providerPlaceId).sort()).toEqual(fixtures.map(item=>item.providerPlaceId).sort());
  });

  it('counts the 50km cap as 13 centers times 3 real HTTP pages', async () => {
    const originalFetch=global.fetch,calls:string[]=[];
    global.fetch=jest.fn(async (input:URL|string|Request)=>{const url=new URL(String(input));calls.push(url.toString());const page=url.searchParams.get('page');return{ok:true,json:async()=>({documents:[{id:`${url.searchParams.get('x')}:${url.searchParams.get('y')}:${page}`,place_name:'fixture 식당',category_group_code:'FD6',category_name:'음식점 > 한식',x:url.searchParams.get('x'),y:url.searchParams.get('y'),distance:'0'}],meta:{is_end:false}})} as Response}) as any;
    try {
      const service=new NearbyService({get:jest.fn((key:string)=>key==='KAKAO_REST_API_KEY'?'test-key':undefined)} as any);
      const result=await service.searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE');
      expect(WIDE_PROVIDER_SEARCH_MAX_CALLS).toBe(39);
      expect(result.providerCalls).toBe(39);
      expect(calls).toHaveLength(39);
      expect(new Set(calls.map(value=>{const url=new URL(value);return `${url.searchParams.get('x')}:${url.searchParams.get('y')}`})).size).toBe(13);
      for(const center of new Set(calls.map(value=>{const url=new URL(value);return `${url.searchParams.get('x')}:${url.searchParams.get('y')}`})))expect(calls.filter(value=>{const url=new URL(value);return `${url.searchParams.get('x')}:${url.searchParams.get('y')}`===center}).map(value=>new URL(value).searchParams.get('page')).sort()).toEqual(['1','2','3']);
      expect(result.coverageStatus).toBe('COMPLETE');
    } finally { global.fetch=originalFetch; }
  });

  it('stops a dense 50km request after two center pages produce 30 valid places',async()=>{const originalFetch=global.fetch,calls:string[]=[];global.fetch=jest.fn(async(input:URL|string|Request)=>{const url=new URL(String(input)),page=Number(url.searchParams.get('page'));calls.push(url.toString());return{ok:true,json:async()=>({documents:Array.from({length:15},(_,index)=>({id:`dense-${page}-${index}`,place_name:`밀집 식당 ${page}-${index}`,category_group_code:'FD6',category_name:'음식점 > 한식',x:String(origin.lng+index*.00001),y:String(origin.lat),distance:String(index)})),meta:{is_end:false}})}as Response})as any;try{const result=await new NearbyService({get:jest.fn((key:string)=>key==='KAKAO_REST_API_KEY'?'key':undefined)}as any).searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE');expect(result.results).toHaveLength(30);expect(result.providerCalls).toBe(2);expect(new Set(calls.map(value=>new URL(value).searchParams.get('x'))).size).toBe(1)}finally{global.fetch=originalFetch}});

  it('expands a sparse 50km request through the required outer ring',async()=>{const service=new NearbyService({get:jest.fn(()=>undefined)}as any);let call=0;const search=jest.spyOn(service,'search').mockImplementation(async()=>call++===0?[]:[place(`outer-${call}`,offset(30000,call))]as any);const result=await service.searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE');expect(search).toHaveBeenCalledTimes(13);expect(result.results.length).toBeGreaterThan(0);expect(result.results.length).toBeLessThan(30)});

  it('returns fewer than 30 collected results after the full sparse search',async()=>{const service=new NearbyService({get:jest.fn(()=>undefined)}as any);const search=jest.spyOn(service,'search').mockResolvedValue([place('same',offset(10000,0))]as any);const result=await service.searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE');expect(search).toHaveBeenCalledTimes(13);expect(result.results).toHaveLength(1)});

  it('serves an identical repeated request from the bounded TTL cache',async()=>{const service=new NearbyService({get:jest.fn(()=>undefined)}as any),search=jest.spyOn(service,'search').mockResolvedValue([place('same',offset(10000,0))]as any);await service.searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE');await service.searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE');expect(search).toHaveBeenCalledTimes(13);expect(NEARBY_CACHE_TTL_MS).toBe(30000);expect(NEARBY_CACHE_MAX_ENTRIES).toBe(100)});

  it('joins simultaneous identical requests into one external search bundle',async()=>{const service=new NearbyService({get:jest.fn(()=>undefined)}as any),search=jest.spyOn(service,'search').mockImplementation(async()=>{await new Promise(resolve=>setTimeout(resolve,5));return[place('same',offset(10000,0))]as any});const[first,second]=await Promise.all([service.searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE'),service.searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE')]);expect(search).toHaveBeenCalledTimes(13);expect(second).toBe(first)});

  it('limits simultaneous provider centers to four',async()=>{const service=new NearbyService({get:jest.fn(()=>undefined)}as any);let active=0,maxActive=0;const search=jest.spyOn(service,'search').mockImplementation(async()=>{active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return[]});await service.searchProgressively('FOOD',origin.lat,origin.lng,{},'hapcheon',50000,'hapcheon','INSIDE');expect(search).toHaveBeenCalledTimes(13);expect(WIDE_SEARCH_CONCURRENCY).toBe(4);expect(maxActive).toBe(4)});

  it('uses one provider center for the supported 20km radius', async () => {
    const service = new NearbyService({ get: jest.fn(() => undefined) } as any);
    const search = jest.spyOn(service, 'search').mockResolvedValue([]);
    const result = await service.searchProgressively('FOOD', origin.lat, origin.lng, {}, 'hapcheon', 20000, 'hapcheon', 'INSIDE');
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][3]).toBe(20000);
    expect(search.mock.calls[0][8]).toBe(true);
    expect(result.radius).toBe(20000);
  });

  it('returns successful sectors with PARTIAL coverage when one sector fails', async () => {
    const service = new NearbyService({ get: jest.fn(() => undefined) } as any);
    let call = 0;
    jest.spyOn(service, 'search').mockImplementation(async () => {
      if (call++ === 0) throw new Error('sector timeout');
      return [place('nearby',offset(10000,0))] as any;
    });
    const result = await service.searchProgressively('FOOD', origin.lat, origin.lng, {}, 'hapcheon', 50000, 'hapcheon', 'INSIDE');
    expect(result.coverageStatus).toBe('PARTIAL');
    expect(result.results.map((row) => row.providerPlaceId)).toEqual(['nearby']);
  });
});
