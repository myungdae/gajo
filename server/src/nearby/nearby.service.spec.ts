import { classifyRegionMembership, NearbyService, NearbyServiceError, normalizeNearbyCategory } from './nearby.service';

describe('NearbyService', () => {
  const config = (values: Record<string, unknown>) => ({ get: jest.fn((key: string) => values[key]) } as any);
  afterEach(() => jest.restoreAllMocks());
  it('normalizes provider categories', () => {
    expect(normalizeNearbyCategory('다온 카페', '', 'CE7')).toBe('CAFE');
    expect(normalizeNearbyCategory('가조 펜션')).toBe('LODGING');
    expect(normalizeNearbyCategory('행복 스크린골프')).toBe('GOLF_SCREEN_GOLF');
  });
  it('reports missing key without exposing it', () => expect(new NearbyService(config({})).status()).toEqual(expect.objectContaining({ configured: false, state: 'NOT_CONFIGURED' })));
  it('reverse geocodes with the server key without returning it',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{address:{address_name:'경상남도 합천군 대병면',region_1depth_name:'경상남도',region_2depth_name:'합천군',region_3depth_name:'대병면'}}]}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'server-secret'})).reverseGeocode(35.5,128,'hapcheon',20);expect(result).toMatchObject({label:'경상남도 합천군 대병면',regionMembership:'INSIDE'});expect(JSON.stringify(result)).not.toContain('server-secret')});
  it('classifies canonical administrative evidence without trusting a place label',()=>{const hapcheon={id:'hapcheon',regionName:'합천',bounds:{north:35.84,south:35.45,east:128.18,west:127.95}};expect(classifyRegionMembership(hapcheon,35.4822804994,127.9831021731,20,{region2:'합천군'})).toBe('INSIDE');expect(classifyRegionMembership(hapcheon,35.49,127.99,20,{region2:'산청군'})).toBe('OUTSIDE');expect(classifyRegionMembership(hapcheon,35.49,127.99,350,{region2:'산청군'})).toBe('UNCERTAIN');expect(classifyRegionMembership(hapcheon,35.4,127.98,20,{region2:'합천군'})).toBe('UNCERTAIN');expect(classifyRegionMembership(hapcheon,35.4822804994,127.9831021731,20)).toBe('UNCERTAIN');expect(classifyRegionMembership({id:'gajo',regionName:'가조',bounds:{north:35.84,south:35.58,east:128.05,west:127.78}},35.714,127.918,20,{region2:'거창군',region3:'가조면'})).toBe('INSIDE');expect(classifyRegionMembership({id:'okcheon',regionName:'옥천',bounds:{north:36.45,south:36.18,east:127.93,west:127.47}},36.3064,127.5714,20,{region2:'옥천군'})).toBe('INSIDE')});
  it('rejects search when key is missing', async () => expect(new NearbyService(config({})).search('CAFE', 35.7, 128)).rejects.toMatchObject({ code: 'NOT_CONFIGURED' }));
  it.each([
    ['CAFE', 'CE7', '카페'], ['LODGING', 'AD5', '숙박'], ['FOOD', 'FD6', '맛집'],
  ] as const)('searches and maps %s', async (category, code, label) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ documents: [document(code)], meta: { is_end: true } }));
    const rows = await new NearbyService(config({ KAKAO_REST_API_KEY: 'server-secret' })).search(category, 35.7, 128);
    expect(rows[0]).toMatchObject({ category, categoryLabel: label, operatingState: 'UNKNOWN', transient: true });
    expect(rows[0]).not.toHaveProperty('verificationStatus', 'VERIFIED');
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toBe('KakaoAK server-secret');
  });
  it('uses screen-golf keyword search', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ documents: [document('', '행복 스크린골프')], meta: { is_end: true } }));
    await new NearbyService(config({ KAKAO_REST_API_KEY: 'key' })).search('GOLF_SCREEN_GOLF', 35.7, 128);
    expect((global.fetch as jest.Mock).mock.calls.some(call => String(call[0]).includes(encodeURIComponent('스크린골프')))).toBe(true);
  });
  it('does not expose distance or proximity reason for untrusted GPS', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ documents: [document('CE7')], meta: { is_end: true } }));
    const [row] = await new NearbyService(config({ KAKAO_REST_API_KEY: 'key' })).search('CAFE', 35.7, 128, 2000, { useDistance: false });
    expect(row.distanceMeters).toBeUndefined(); expect(row.contextualReasons.join(' ')).not.toContain('현재 위치');
  });
  it('orders by distance and never invents travel time or open state',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('CE7'),id:'far',distance:'800'},{...document('CE7'),id:'near',distance:'100'}],meta:{is_end:true}}));const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('CAFE',35.7,128);expect(rows.map(x=>x.id)).toEqual(['near','far']);expect(rows[0].estimatedTravelMinutes).toBeUndefined();expect(rows[0].operatingState).toBe('UNKNOWN')});
  it('gives indoor places a modest rain reason and never claims open', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ documents: [document('CE7')], meta: { is_end: true } }));
    const [row] = await new NearbyService(config({ KAKAO_REST_API_KEY: 'key' })).search('CAFE', 35.7, 128, 2000, { weather: 'HEAVY_RAIN' });
    expect(row.relevanceScore).toBe(10); expect(row.contextualReasons.join(' ')).toContain('비 오는 날'); expect(row.operatingState).toBe('UNKNOWN');
  });
  it('marks lodging availability unknown', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ documents: [document('AD5')], meta: { is_end: true } }));
    const [row] = await new NearbyService(config({ KAKAO_REST_API_KEY: 'key' })).search('LODGING', 35.7, 128);
    expect(row.availabilityMessage).toBe('예약 가능 여부는 숙소에 직접 확인해 주세요.');
  });
  it('stops at the first page of 1km when validated lodging candidates are sufficient',async()=>{const fetchSpy=jest.spyOn(global,'fetch').mockResolvedValue(response({documents:Array.from({length:5},(_,index)=>({...document('AD5',`숙소 ${index}`),id:`stay-${index}`,address_name:'경상남도 합천군'})),meta:{is_end:false}}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING',35.6,128.05,{},'hapcheon');expect(result).toMatchObject({radius:1000,expanded:false});expect(fetchSpy).toHaveBeenCalledTimes(1);expect(String(fetchSpy.mock.calls[0][0])).toContain('page=1')});
  it.each([[3000,5000,6],[5000,10000,11]])('expands only until %im has enough validated candidates',async(radius,forbiddenRadius,expectedCalls)=>{const fetchSpy=jest.spyOn(global,'fetch').mockImplementation(async(input:any)=>response({documents:String(input).includes(`radius=${radius}`)?Array.from({length:5},(_,index)=>({...document('AD5',`숙소 ${index}`),id:`stay-${index}`,address_name:'경상남도 합천군'})):[],meta:{is_end:true}}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING',35.6,128.05,{},'hapcheon');expect(result.radius).toBe(radius);expect(fetchSpy).toHaveBeenCalledTimes(expectedCalls);expect(fetchSpy.mock.calls.some(call=>String(call[0]).includes(`radius=${forbiddenRadius}`))).toBe(false)});
  it('returns only verified candidates when lodging reaches the call budget',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('AD5','유효 숙소'),id:'valid',address_name:'경상남도 합천군'},{...document('AD5','타지역 숙소'),id:'outside',y:'36.2',address_name:'경상남도 산청군'}],meta:{is_end:true}}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING',35.6,128.05,{},'hapcheon');expect(result).toMatchObject({radius:5000,coverageStatus:'PARTIAL'});expect(result.results.map(row=>row.id)).toEqual(['valid'])});
  it('reaches 10km and returns a farther valid Hapcheon attraction when the provider pages end normally',async()=>{jest.spyOn(global,'fetch').mockImplementation(async(input:any)=>response({documents:String(input).includes('radius=10000')?[{...document('','먼 합천 관광지'),id:'far-inside',category_group_code:'AT4',category_name:'여행 > 관광명소',address_name:'경상남도 합천군',x:'128.05',y:'35.6',distance:'8000'}]:[{...document('','인접 관광지'),id:'near-outside',category_group_code:'AT4',category_name:'여행 > 관광명소',address_name:'경상남도 산청군',x:'128.05',y:'35.6',distance:'300'}],meta:{is_end:true}}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('TOURIST_ATTRACTION',35.6,128.05,{},'hapcheon');expect(result).toMatchObject({radius:10000,coverageStatus:'COMPLETE'});expect(result.results.map(row=>row.id)).toEqual(['far-inside'])});
  it('uses an explicit next radius as one manual expansion step',async()=>{const fetchSpy=jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[],meta:{is_end:true}}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING',35.6,128.05,{},'hapcheon',5000);expect(result).toMatchObject({radius:5000,nextRadius:10000,expanded:false});expect(fetchSpy).toHaveBeenCalledTimes(5);expect(fetchSpy.mock.calls.every(call=>String(call[0]).includes('radius=5000'))).toBe(true)});
  it('does not count duplicate provider ids toward the validated minimum',async()=>{const fetchSpy=jest.spyOn(global,'fetch').mockImplementation(async(input:any)=>response({documents:Array.from({length:5},()=>({...document('AD5','중복 숙소'),id:'same-stay',address_name:'경상남도 합천군'})),meta:{is_end:true}}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING',35.6,128.05,{},'hapcheon');expect(result).toMatchObject({radius:5000,coverageStatus:'PARTIAL',providerCalls:12});expect(result.results).toHaveLength(1);expect(fetchSpy).toHaveBeenCalledTimes(12)});
  it('caps an empty lodging search at the request call budget and returns an honest partial result',async()=>{const fetchSpy=jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[],meta:{is_end:false}}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING',35.6,128.05,{},'hapcheon');expect(result).toMatchObject({coverageStatus:'PARTIAL',providerCalls:12,nextRadius:undefined,results:[]});expect(fetchSpy).toHaveBeenCalledTimes(12)});
  it('stops at the total time budget while preserving already verified candidates',async()=>{let nowCalls=0;const now=jest.spyOn(Date,'now').mockImplementation(()=>++nowCalls<=3?0:10001),fetchSpy=jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('AD5','검증 숙소'),id:'verified',address_name:'경상남도 합천군'}],meta:{is_end:false}}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING',35.6,128.05,{},'hapcheon');expect(result).toMatchObject({coverageStatus:'PARTIAL',providerCalls:1});expect(result.results.map(row=>row.id)).toEqual(['verified']);expect(fetchSpy).toHaveBeenCalledTimes(1);now.mockRestore()});
  it('never counts adjacent counties toward the minimum and continues to farther Hapcheon candidates',async()=>{const counties=['산청군','거창군','의령군'];const fetchSpy=jest.spyOn(global,'fetch').mockImplementation(async(input:any)=>{const radius=new URL(String(input)).searchParams.get('radius'),outside=Array.from({length:5},(_,index)=>({...document('AD5',`외부 ${index}`),id:`outside-${radius}-${index}`,x:'128.05',y:'35.6',address_name:`경상남도 ${counties[index%counties.length]}`,distance:'300'})),inside=radius==='5000'?Array.from({length:5},(_,index)=>({...document('AD5',`합천 숙소 ${index}`),id:`inside-${index}`,x:'128.05',y:'35.6',address_name:'경상남도 합천군',distance:'4000'})):[];return response({documents:[...outside,...inside],meta:{is_end:true}})});const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING',35.6,128.05,{},'hapcheon');expect(result).toMatchObject({radius:5000,coverageStatus:'COMPLETE'});expect(result.results).toHaveLength(5);expect(result.results.every(row=>row.address.includes('합천군'))).toBe(true);expect(fetchSpy.mock.calls.some(call=>String(call[0]).includes('radius=5000'))).toBe(true)});
  it.each([1000,3000,5000,10000])('applies the same Hapcheon administrative filter at %im',async radius=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('AD5','합천 숙소'),id:'inside',x:'128.05',y:'35.6',address_name:'경상남도 합천군'},{...document('AD5','산청 숙소'),id:'sancheong',x:'128.05',y:'35.6',address_name:'경상남도 산청군'},{...document('AD5','거창 숙소'),id:'geochang',x:'128.05',y:'35.6',address_name:'경상남도 거창군'},{...document('AD5','의령 숙소'),id:'uiryeong',x:'128.05',y:'35.6',address_name:'경상남도 의령군'}],meta:{is_end:true}}));const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('LODGING',35.6,128.05,radius,{},'hapcheon');expect(rows.map(row=>row.id)).toEqual(['inside'])});
  it.each([['okcheon',36.3064,127.5714,'충청북도 옥천군','충청북도 영동군'],['gajo',35.714,127.918,'경상남도 거창군 가조면','경상남도 합천군']] as const)('keeps %s results inside its canonical administrative area',async(regionId,lat,lng,insideAddress,outsideAddress)=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('CE7','내부 카페'),id:'inside',x:String(lng),y:String(lat),address_name:insideAddress},{...document('CE7','외부 카페'),id:'outside',x:String(lng),y:String(lat),address_name:outsideAddress}],meta:{is_end:true}}));const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('CAFE',lat,lng,5000,{},regionId);expect(rows.map(row=>row.id)).toEqual(['inside'])});
  it('stops progressive search immediately after a provider error',async()=>{const fetchSpy=jest.spyOn(global,'fetch').mockResolvedValue(response({},503));await expect(new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING',35.6,128.05,{},'hapcheon')).rejects.toMatchObject({code:'UPSTREAM_ERROR'});expect(fetchSpy).toHaveBeenCalledTimes(1)});
  it('keeps all-lodging results inside the provider AD5 boundary',async()=>{
    jest.spyOn(global,'fetch').mockImplementation(async(input:any)=>response({documents:String(input).includes('category_group_code=AD5')?[document('AD5','합천호 스마일펜션')]:[{...document('','오도산자연휴양림'),id:'forest',category_group_code:'AT4',category_name:'여행 > 관광명소 > 자연휴양림'}],meta:{is_end:true}}));
    const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('LODGING',35.7,128,5000);
    expect(rows.map(row=>row.name)).toEqual(['합천호 스마일펜션']);
    expect(rows.every(row=>row.providerCategoryName.includes('숙박'))).toBe(true);
  });
  it('does not infer lodging from accommodation-like words without provider evidence',()=>{
    expect(normalizeNearbyCategory('오도산자연휴양림','여행 > 관광명소','AT4','OTHER')).toBe('TOURISM_NATURE');
    expect(normalizeNearbyCategory('이름뿐인 펜션','여행 > 관광명소','','OTHER')).toBe('TOURISM_NATURE');
    expect(normalizeNearbyCategory('복합 휴양시설','여행 > 숙박 > 펜션','')).toBe('LODGING');
  });
  it('ranks location anchors by region and removes unsuitable school candidates',async()=>{
    jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[
      {...document('','합천홀씨유치원'),id:'school',category_name:'교육 > 유치원',address_name:'경상남도 합천군'},
      {...document('','합천호회양관광단지'),id:'tourism',category_name:'여행 > 관광명소',address_name:'경상남도 합천군'},
      {...document('','합천군청'),id:'office',category_name:'사회 > 관공서',address_name:'경상남도 합천군'},
    ],meta:{is_end:true}}));
    const regions={get:jest.fn(()=>({regionName:'합천',bounds:{north:36,south:35,east:129,west:127}}))}as any,rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'}),undefined,undefined,regions).searchByKeyword('합천','hapcheon');
    expect(rows.map(row=>row.id)).toEqual(['tourism','office']);
  });
  it('uses Kakao lodging evidence for camping and keeps distance order',async()=>{
    jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[
      {...document('AD5','가까운 캠핑장'),id:'near',distance:'120'},
      {...document('AD5','먼 글램핑'),id:'far',distance:'820'},
    ],meta:{is_end:true}}));
    const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('LODGING_CAMPING_GLAMPING',35.7,128,1000);
    expect(rows.map(row=>row.id)).toEqual(['near','far']);
    expect(rows.every(row=>row.category==='LODGING_CAMPING_GLAMPING'&&row.providerCategoryName.includes('숙박'))).toBe(true);
    expect(['캠핑장','글램핑']).toContain(rows[0].matchedKeyword);
  });
  it('does not silently replace a food subtype with generic restaurant results',async()=>{
    jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('','이름만 일식'),category_group_code:'',category_name:'관광명소 > 기타'}],meta:{is_end:true}}));
    const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('FOOD_JAPANESE',35.7,128,1000);
    expect(rows).toEqual([]);
    expect((global.fetch as jest.Mock).mock.calls.every(call=>!String(call[0]).includes('category_group_code=FD6'))).toBe(true);
  });
  it('links an exact canonical match without promoting transient data', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ documents: [document('', '백두산천지온천')], meta: { is_end: true } }));
    const master = { resolveCanonical: jest.fn(() => ({ entityUri: 'gajo:baekdu', canonicalLabelKo: '백두산천지온천', verificationStatus: 'PARTIAL', address: '검증 주소', telephone: '055' })) } as any;
    const [row] = await new NearbyService(config({ KAKAO_REST_API_KEY: 'key' }), master).search('HOT_SPRING_WELLNESS', 35.7, 128);
    expect(row).toMatchObject({ canonicalEntityUri: 'gajo:baekdu', transient: true, masterVerificationStatus: 'PARTIAL', address: '검증 주소' });
  });
  it('consumes an approved regional DB cafe directly for verified nearby distance',async()=>{
    const regional={effectiveDataset:jest.fn(async(regionId:string)=>regionId==='hapcheon'?{records:[{entityUri:'urn:regional:hapcheon:lowful',canonicalLabelKo:'로우풀',category:'CAFE',runtimeDataStatus:'VERIFIED',address:'경상남도 합천군 대병면 회양관광단지길 28-10',telephone:'0507-1333-2434',latitude:35.525488,longitude:128.018877,actions:{navigate:{latitude:35.525488,longitude:128.018877}}}]}:{records:[]})}as any;
    const service=new NearbyService(config({}),undefined,regional);
    const rows=await service.search('CAFE',35.524485899856,128.01578179029,2500,{},'hapcheon');
    expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({name:'로우풀',canonicalEntityUri:'urn:regional:hapcheon:lowful',transient:false,masterVerificationStatus:'VERIFIED'});expect(rows[0].distanceMeters).toBeGreaterThan(0);
    await expect(service.search('CAFE',35.524485899856,128.01578179029,2500,{},'okcheon')).rejects.toMatchObject({code:'NOT_CONFIGURED'});
  });
  it('continues keyword pagination when the first page has no validated candidates',async()=>{let page=0;const fetchSpy=jest.spyOn(global,'fetch').mockImplementation(async()=>{page++;return response({documents:page===1?[{...document('','오분류 장소'),category_group_code:'AT4',category_name:'여행 > 관광명소'}]:Array.from({length:5},(_,index)=>({...document('AD5',`캠핑 ${index}`),id:`camp-${index}`,address_name:'경상남도 합천군'})),meta:{is_end:page>=2}})});const result=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).searchProgressively('LODGING_CAMPING_GLAMPING',35.6,128.05,{},'hapcheon');expect(result.radius).toBe(1000);expect(fetchSpy.mock.calls.some(call=>String(call[0]).includes('page=2'))).toBe(true);expect(fetchSpy.mock.calls.some(call=>String(call[0]).includes('radius=3000'))).toBe(false)});
  it('includes coordinate-verified operational camping only in the camping subtype',async()=>{const regional={effectiveDataset:jest.fn(async()=>({records:[{entityUri:'urn:camp',canonicalLabelKo:'검증 캠핑장',category:'ACCOMMODATION',accommodationType:'CAMPING',runtimeDataStatus:'VERIFIED',address:'경상남도 합천군 대병면',latitude:35.6,longitude:128.05},{entityUri:'urn:pension',canonicalLabelKo:'검증 펜션',category:'ACCOMMODATION',accommodationType:'PENSION',runtimeDataStatus:'VERIFIED',address:'경상남도 합천군 대병면',latitude:35.6,longitude:128.05}]}))}as any,service=new NearbyService(config({}),undefined,regional);const rows=await service.search('LODGING_CAMPING_GLAMPING',35.6,128.05,1000,{},'hapcheon');expect(rows.map(row=>row.name)).toEqual(['검증 캠핑장']);expect(rows[0].category).toBe('LODGING_CAMPING_GLAMPING')});
  /* eslint-disable prettier/prettier, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
  it('blocks provider results outside the canonical region boundary',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('CE7'),id:'inside',y:'35.6',x:'128.05',address_name:'경상남도 합천군'},{...document('CE7'),id:'outside',y:'36.2',x:'128.05',address_name:'경상북도 다른 지역'}],meta:{is_end:true}}));const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('CAFE',35.6,128.05,5000,{},'hapcheon');expect(rows.map(row=>row.id)).toEqual(['inside'])});
  it('blocks unknown regions before querying a provider',async()=>{const fetchSpy=jest.spyOn(global,'fetch');await expect(new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('CAFE',35.6,128.05,5000,{},'unknown-region')).rejects.toBeDefined();expect(fetchSpy).not.toHaveBeenCalled()});
  it('blocks provider categories that do not match the requested category',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('FD6'),address_name:'경상남도 합천군'}],meta:{is_end:true}}));const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'})).search('CAFE',35.6,128.05,5000,{},'hapcheon');expect(rows).toEqual([])});
  it('blocks a provider result when its canonical coordinates conflict',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('CE7'),id:'conflict',y:'35.6',x:'128.05',address_name:'경상남도 합천군'}],meta:{is_end:true}}));const master={resolveCanonical:jest.fn(()=>({entityUri:'canonical:cafe',canonicalLabelKo:'검증 카페',category:'CAFE',latitude:35.7,longitude:128.05}))}as any;const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'}),master).search('CAFE',35.6,128.05,5000,{},'hapcheon');expect(rows).toEqual([])});
  it.each([[0.00089,true],[0.00091,false]])('applies the 100 m canonical coordinate boundary (%s)',async(delta,included)=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{...document('CE7'),y:'35.6',x:'128.05',address_name:'경상남도 합천군'}],meta:{is_end:true}}));const master={resolveCanonical:jest.fn(()=>({entityUri:'canonical:cafe',canonicalLabelKo:'검증 카페',category:'CAFE',latitude:35.6+delta,longitude:128.05}))}as any;const rows=await new NearbyService(config({KAKAO_REST_API_KEY:'key'}),master).search('CAFE',35.6,128.05,5000,{},'hapcheon');expect(rows.length>0).toBe(included)});
  /* eslint-enable prettier/prettier, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
  it('surfaces provider errors, timeout and malformed data', async () => {
    const service = new NearbyService(config({ KAKAO_REST_API_KEY: 'key' }));
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(response({}, 503)); await expect(service.search('CAFE', 35.7, 128)).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(Object.assign(new Error(), { name: 'AbortError' })); await expect(service.search('CAFE', 35.7, 128)).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(response({ nope: true })); await expect(service.search('CAFE', 35.7, 128)).rejects.toBeInstanceOf(NearbyServiceError);
  });
});
function response(body: any, status = 200) { return { ok: status >= 200 && status < 300, status, json: jest.fn(async () => body) } as any; }
function document(code = 'FD6', name = code === 'CE7' ? '다온 카페' : code === 'AD5' ? '가조 펜션' : '테스트 식당') { return { id: `${code}-${name}`, place_name: name, category_name: code === 'CE7' ? '음식점 > 카페' : code === 'AD5' ? '여행 > 숙박' : '음식점 > 한식', category_group_code: code, address_name: '거창군', road_address_name: '', phone: '', y: '35.7', x: '128', distance: '120', place_url: 'https://place.map.kakao.com/1' }; }
