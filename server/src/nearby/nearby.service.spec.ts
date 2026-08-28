import { NearbyService, NearbyServiceError, normalizeNearbyCategory } from './nearby.service';

describe('NearbyService', () => {
  const config = (values: Record<string, unknown>) => ({ get: jest.fn((key: string) => values[key]) } as any);
  afterEach(() => jest.restoreAllMocks());
  it('normalizes provider categories', () => {
    expect(normalizeNearbyCategory('다온 카페', '', 'CE7')).toBe('CAFE');
    expect(normalizeNearbyCategory('가조 펜션')).toBe('LODGING');
    expect(normalizeNearbyCategory('행복 스크린골프')).toBe('GOLF_SCREEN_GOLF');
  });
  it('reports missing key without exposing it', () => expect(new NearbyService(config({})).status()).toEqual(expect.objectContaining({ configured: false, state: 'NOT_CONFIGURED' })));
  it('reverse geocodes with the server key without returning it',async()=>{jest.spyOn(global,'fetch').mockResolvedValue(response({documents:[{address:{address_name:'경상남도 합천군 대병면',region_1depth_name:'경상남도',region_2depth_name:'합천군',region_3depth_name:'대병면'}}]}));const result=await new NearbyService(config({KAKAO_REST_API_KEY:'server-secret'})).reverseGeocode(35.5,128);expect(result).toMatchObject({label:'경상남도 합천군 대병면'});expect(JSON.stringify(result)).not.toContain('server-secret')});
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
    expect(row.availabilityMessage).toBe('숙박 정보 확인 필요');
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
  it('surfaces provider errors, timeout and malformed data', async () => {
    const service = new NearbyService(config({ KAKAO_REST_API_KEY: 'key' }));
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(response({}, 503)); await expect(service.search('CAFE', 35.7, 128)).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(Object.assign(new Error(), { name: 'AbortError' })); await expect(service.search('CAFE', 35.7, 128)).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(response({ nope: true })); await expect(service.search('CAFE', 35.7, 128)).rejects.toBeInstanceOf(NearbyServiceError);
  });
});
function response(body: any, status = 200) { return { ok: status >= 200 && status < 300, status, json: jest.fn(async () => body) } as any; }
function document(code = 'FD6', name = code === 'CE7' ? '다온 카페' : code === 'AD5' ? '가조 펜션' : '테스트 식당') { return { id: `${code}-${name}`, place_name: name, category_name: code === 'CE7' ? '음식점 > 카페' : code === 'AD5' ? '여행 > 숙박' : '음식점 > 한식', category_group_code: code, address_name: '거창군', road_address_name: '', phone: '', y: '35.7', x: '128', distance: '120', place_url: 'https://place.map.kakao.com/1' }; }
