import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MasterDataService } from '../master-data/master-data.service';
import { RegionalDataService } from '../regional-data/regional-data.service';
import { REGIONAL_CANDIDATE_DATASETS } from '../regions/regional-candidate.registry';
import { RegionConfigService } from '../region/region-config.service';

export type NearbyCategory =
  | 'FOOD' | 'CAFE' | 'LODGING' | 'HOT_SPRING_WELLNESS'
  | 'TOURIST_ATTRACTION' | 'NATURE' | 'CULTURE_ART' | 'EXPERIENCE' | 'FESTIVAL_EXHIBITION'
  | 'FOOD_KOREAN' | 'FOOD_WESTERN' | 'FOOD_CHINESE' | 'FOOD_JAPANESE' | 'CAFE_BAKERY'
  | 'LODGING_HOTEL_RESORT' | 'LODGING_PENSION_MINBAK' | 'LODGING_CAMPING_GLAMPING'
  | 'LODGING_MOTEL' | 'LODGING_GUESTHOUSE' | 'MEDICAL'
  | 'GOLF_SCREEN_GOLF' | 'ACTIVITY' | 'TOURISM_NATURE' | 'CONVENIENCE'
  | 'ESSENTIAL_SHOPPING' | 'CONVENIENCE_STORE' | 'MART_SUPERMARKET'
  | 'PARKING' | 'PUBLIC_TOILET' | 'GAS_STATION' | 'EV_CHARGER'
  | 'TOURIST_INFORMATION' | 'PHARMACY' | 'HOSPITAL' | 'ATM' | 'OTHER';

const CANONICAL_PROVIDER_MAX_DRIFT_METERS = 100;


export type NearbyFailureCode = 'NOT_CONFIGURED' | 'UPSTREAM_ERROR' | 'UPSTREAM_TIMEOUT' | 'INVALID_RESPONSE';
export class NearbyServiceError extends Error {
  constructor(public readonly code: NearbyFailureCode, message: string, public readonly upstreamStatus?: number) { super(message); }
}

export interface NearbyPlace {
  id: string;
  name: string;
  category: NearbyCategory;
  categoryLabel: string;
  providerCategoryName: string;
  address: string;
  roadAddress?: string;
  phone?: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  estimatedTravelMinutes?: number;
  placeUrl: string;
  matchedKeyword?: string;
  indoorRelevance: 'INDOOR' | 'OUTDOOR' | 'UNKNOWN';
  operatingState: 'UNKNOWN';
  operatingMessage: string;
  availabilityMessage?: string;
  contextualReasons: string[];
  canonicalEntityUri?: string;
  canonicalLabel?: string;
  masterVerificationStatus?: string;
  transient: boolean;
  relevanceScore: number;
  /** Legacy restaurant bucket, retained for /restaurants clients. */
  categoryGroup?: string;
}

export interface NearbySearchOptions {
  weather?: string;
  useDistance?: boolean;
  transportMode?: 'car' | 'foot';
}

// eslint-disable-next-line prettier/prettier
const TOURISM_CATEGORIES=new Set<NearbyCategory>(['TOURIST_ATTRACTION','NATURE','CULTURE_ART','EXPERIENCE','FESTIVAL_EXHIBITION','ACTIVITY','TOURISM_NATURE']);

const LABELS: Record<NearbyCategory, string> = {
  FOOD: '맛집', CAFE: '카페', LODGING: '숙박', HOT_SPRING_WELLNESS: '온천·휴식',
  TOURIST_ATTRACTION: '관광지', NATURE: '자연', CULTURE_ART: '문화·예술', EXPERIENCE: '체험', FESTIVAL_EXHIBITION: '축제·전시',
  FOOD_KOREAN: '한식', FOOD_WESTERN: '양식', FOOD_CHINESE: '중식', FOOD_JAPANESE: '일식', CAFE_BAKERY: '카페·베이커리',
  LODGING_HOTEL_RESORT: '호텔·리조트', LODGING_PENSION_MINBAK: '펜션·민박', LODGING_CAMPING_GLAMPING: '캠핑·글램핑',
  LODGING_MOTEL: '모텔', LODGING_GUESTHOUSE: '게스트하우스', MEDICAL: '약국·병원',
  GOLF_SCREEN_GOLF: '골프·스크린골프', ACTIVITY: '놀거리·체험', TOURISM_NATURE: '산책·관광',
  CONVENIENCE: '편의시설', ESSENTIAL_SHOPPING: '생필품 쇼핑',
  CONVENIENCE_STORE: '편의점', MART_SUPERMARKET: '마트·슈퍼마켓', OTHER: '기타',
  PARKING: '주차장', PUBLIC_TOILET: '공중화장실', GAS_STATION: '주유소',
  EV_CHARGER: '전기차 충전소', TOURIST_INFORMATION: '관광안내소', PHARMACY: '약국', HOSPITAL: '병원', ATM: 'ATM',
};
const INDOOR = new Set<NearbyCategory>(['CAFE', 'CAFE_BAKERY', 'FOOD', 'FOOD_KOREAN', 'FOOD_WESTERN', 'FOOD_CHINESE', 'FOOD_JAPANESE', 'LODGING', 'LODGING_HOTEL_RESORT', 'LODGING_PENSION_MINBAK', 'LODGING_CAMPING_GLAMPING', 'LODGING_MOTEL', 'LODGING_GUESTHOUSE', 'HOT_SPRING_WELLNESS', 'GOLF_SCREEN_GOLF', 'CONVENIENCE', 'ESSENTIAL_SHOPPING', 'CONVENIENCE_STORE', 'MART_SUPERMARKET', 'PHARMACY', 'HOSPITAL', 'MEDICAL', 'ATM']);
type NearbyPlan = { codes: string[]; keywords: string[]; providerGroup?: 'FOOD' | 'LODGING' | 'TOURISM' };
const PLANS: Record<NearbyCategory, NearbyPlan> = {
  // eslint-disable-next-line prettier/prettier
  FOOD: { codes: ['FD6'], keywords: ['약선요리', '건강식당', '사찰음식', '채식뷔페'], providerGroup: 'FOOD' },
  CAFE: { codes: ['CE7'], keywords: ['카페'] },
  LODGING: { codes: ['AD5'], keywords: ['호텔', '모텔', '펜션', '숙박시설'], providerGroup: 'LODGING' },
  TOURIST_ATTRACTION: { codes: ['AT4'], keywords: [], providerGroup: 'TOURISM' },
  NATURE: { codes: [], keywords: ['자연명소', '자연휴양림', '수목원'], providerGroup: 'TOURISM' },
  CULTURE_ART: { codes: [], keywords: ['박물관', '미술관', '문화예술'], providerGroup: 'TOURISM' },
  EXPERIENCE: { codes: [], keywords: ['관광체험', '농촌체험'], providerGroup: 'TOURISM' },
  FESTIVAL_EXHIBITION: { codes: [], keywords: ['축제', '전시'], providerGroup: 'TOURISM' },
  FOOD_KOREAN: { codes: [], keywords: ['한식'], providerGroup: 'FOOD' },
  FOOD_WESTERN: { codes: [], keywords: ['양식'], providerGroup: 'FOOD' },
  FOOD_CHINESE: { codes: [], keywords: ['중식'], providerGroup: 'FOOD' },
  FOOD_JAPANESE: { codes: [], keywords: ['일식'], providerGroup: 'FOOD' },
  CAFE_BAKERY: { codes: ['CE7'], keywords: ['베이커리'], providerGroup: 'FOOD' },
  LODGING_HOTEL_RESORT: { codes: [], keywords: ['호텔', '리조트'], providerGroup: 'LODGING' },
  LODGING_PENSION_MINBAK: { codes: [], keywords: ['펜션', '민박'], providerGroup: 'LODGING' },
  LODGING_CAMPING_GLAMPING: { codes: [], keywords: ['캠핑장', '글램핑'], providerGroup: 'LODGING' },
  LODGING_MOTEL: { codes: [], keywords: ['모텔'], providerGroup: 'LODGING' },
  LODGING_GUESTHOUSE: { codes: [], keywords: ['게스트하우스'], providerGroup: 'LODGING' },
  MEDICAL: { codes: ['PM9', 'HP8'], keywords: [] },
  HOT_SPRING_WELLNESS: { codes: [], keywords: ['온천', '사우나', '찜질방', '스파'] },
  GOLF_SCREEN_GOLF: { codes: [], keywords: ['스크린골프', '골프연습장'] },
  ACTIVITY: { codes: [], keywords: ['체험', '놀거리', '레저'] },
  TOURISM_NATURE: { codes: ['AT4'], keywords: ['산책', '공원', '관광지'] },
  CONVENIENCE: { codes: ['PM9', 'HP8'], keywords: [] },
  CONVENIENCE_STORE: { codes: ['CS2'], keywords: ['편의점'] },
  MART_SUPERMARKET: { codes: ['MT1'], keywords: ['마트', '슈퍼마켓', '식료품점'] },
  ESSENTIAL_SHOPPING: { codes: ['CS2', 'MT1'], keywords: ['마트', '슈퍼마켓', '식료품점'] },
  PARKING: { codes: ['PK6'], keywords: ['주차장'] },
  PUBLIC_TOILET: { codes: [], keywords: ['공중화장실'] },
  GAS_STATION: { codes: ['OL7'], keywords: ['주유소'] },
  EV_CHARGER: { codes: [], keywords: ['전기차 충전소'] },
  TOURIST_INFORMATION: { codes: [], keywords: ['관광안내소'] },
  PHARMACY: { codes: ['PM9'], keywords: ['약국'] },
  HOSPITAL: { codes: ['HP8'], keywords: ['병원'] },
  ATM: { codes: ['BK9'], keywords: ['ATM'] },
  OTHER: { codes: [], keywords: [] },
};

export function normalizeNearbyCategory(name: string, providerCategory = '', code = '', requested?: NearbyCategory): NearbyCategory {
  const text = `${name} ${providerCategory}`;
  if (code === 'CE7' || /카페|커피|다방/.test(text)) return 'CAFE';
  if (code === 'AD5' || /(?:^|\s|>)숙박(?:\s|>|$)/.test(providerCategory) || providerCategory === 'ACCOMMODATION' || (!providerCategory && /호텔|모텔|펜션|민박|숙박|리조트/.test(name))) return 'LODGING';
  if (/온천|사우나|찜질|스파|웰니스|spa/i.test(text)) return 'HOT_SPRING_WELLNESS';
  if (/스크린\s*골프|골프연습장/.test(text)) return 'GOLF_SCREEN_GOLF';
  if (code === 'AT4' || /관광|공원|산책|자연|명소/.test(text)) return 'TOURISM_NATURE';
  if (code === 'CS2' || /편의점|(?:^|\s)(?:CU|GS25)(?:\s|$)|세븐일레븐|이마트24|미니스톱/i.test(text)) return 'CONVENIENCE_STORE';
  if (code === 'MT1' || /마트|슈퍼마켓|슈퍼(?!맨)|식료품점|식료품/.test(text)) return 'MART_SUPERMARKET';
  if (code === 'PK6' || /주차장/.test(text)) return 'PARKING';
  if (/공중\s*화장실/.test(text)) return 'PUBLIC_TOILET';
  if (code === 'OL7' || /주유소/.test(text)) return 'GAS_STATION';
  if (/전기차.*충전|EV.*충전/i.test(text)) return 'EV_CHARGER';
  if (/관광\s*안내소/.test(text)) return 'TOURIST_INFORMATION';
  if (code === 'PM9' || /약국/.test(text)) return 'PHARMACY';
  if (code === 'HP8' || /병원|의원/.test(text)) return 'HOSPITAL';
  if (code === 'BK9' || /ATM|현금자동입출금기/i.test(text)) return 'ATM';
  if (/체험|레저|놀거리/.test(text)) return 'ACTIVITY';
  if (code === 'FD6' || /음식점|식당|한식|중식|일식|분식/.test(text)) return 'FOOD';
  return requested || 'OTHER';
}

const FOOD_CATEGORIES = new Set<NearbyCategory>(['FOOD', 'FOOD_KOREAN', 'FOOD_WESTERN', 'FOOD_CHINESE', 'FOOD_JAPANESE', 'CAFE_BAKERY']);
const LODGING_CATEGORIES = new Set<NearbyCategory>(['LODGING', 'LODGING_HOTEL_RESORT', 'LODGING_PENSION_MINBAK', 'LODGING_CAMPING_GLAMPING', 'LODGING_MOTEL', 'LODGING_GUESTHOUSE']);
function providerSupportsRequestedCategory(requested: NearbyCategory, code = '', providerCategory = '', keyword?: string) {
  const plan = PLANS[requested];
  if (!plan.providerGroup) return true;
  const food = code === 'FD6' || code === 'CE7' || /음식점|카페/.test(providerCategory);
  const lodging = code === 'AD5' || /숙박/.test(providerCategory);
  const tourism = code === 'AT4' || /관광명소|문화시설/.test(providerCategory);
  if (plan.providerGroup === 'FOOD') return food && Boolean(code || keyword);
  if (plan.providerGroup === 'LODGING') return lodging && Boolean(code || keyword);
  return tourism && Boolean(code || keyword);
}

@Injectable()
export class NearbyService {
  private readonly logger = new Logger(NearbyService.name);
  constructor(private readonly config: ConfigService, @Optional() private readonly master?: MasterDataService, @Optional() private readonly regionalData?: RegionalDataService, @Optional() private readonly regions?:RegionConfigService) {}
  private get kakaoKey() { return (this.config.get<string>('KAKAO_REST_API_KEY') || process.env.KAKAO_REST_API_KEY)?.trim() || undefined; }
  private get timeoutMs() { const n = Number(this.config.get('KAKAO_LOCAL_TIMEOUT_MS') || 5000); return Number.isFinite(n) && n >= 500 && n <= 30000 ? n : 5000; }
  isConfigured() { return !!this.kakaoKey; }
  status(regionId?: string) { const configured=this.isConfigured()||Boolean(regionId&&this.regionalData&&REGIONAL_CANDIDATE_DATASETS[regionId]);return { configured, state: configured ? 'READY' : 'NOT_CONFIGURED', provider: this.isConfigured()?'KAKAO_LOCAL':'REGIONAL_OPERATIONAL_DATA', timeoutMs: this.timeoutMs }; }

  async search(category: NearbyCategory, lat: number, lng: number, radius = 2000, options: NearbySearchOptions = {}, regionId?: string): Promise<NearbyPlace[]> {
    // eslint-disable-next-line prettier/prettier
    const region=regionId?(this.regions||new RegionConfigService()).get(regionId):undefined;
    const key = this.kakaoKey;
    const plan = PLANS[category];
    const byId = new Map<string, NearbyPlace>();
    if (key) {
      for (const code of plan.codes) await this.fetchCategory(key, code, category, lat, lng, radius, byId);
      for (const keyword of plan.keywords) await this.fetchKeyword(key, keyword, category, lat, lng, radius, byId);
    }
    if (regionId && this.regionalData) await this.addOperationalPlaces(byId, category, lat, lng, radius, regionId);
    if (!key && byId.size === 0) throw new NearbyServiceError('NOT_CONFIGURED', '주변 장소 검색은 현재 준비 중입니다.');
    const useDistance = options.useDistance !== false;
    const rainy = options.weather === 'HEAVY_RAIN';
    for (const place of byId.values()) {
      if (!useDistance) { delete place.distanceMeters; delete place.estimatedTravelMinutes; }
      if (rainy && place.indoorRelevance === 'INDOOR') {
        place.relevanceScore += 10;
        place.contextualReasons.push('비 오는 날 이용하기 좋은 실내 장소입니다.');
      }
      if (useDistance && place.distanceMeters != null && place.distanceMeters <= 1500) place.contextualReasons.push('현재 위치에서 가까운 후보입니다.');
    }
    // eslint-disable-next-line prettier/prettier
    return [...byId.values()].filter(place=>!regionId||this.insideRegion(place.lat,place.lng,region?.bounds)).filter(place=>this.canonicalConsistent(place)).filter(place=>this.requestedCategoryMatches(category,place.category)).sort((a, b) => (useDistance ? (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) : 0) || b.relevanceScore - a.relevanceScore).slice(0,30);
  }

  async searchRestaurants(lat: number, lng: number, radius = 2000) { return this.search('FOOD', lat, lng, radius); }

  async searchByKeyword(query:string,regionId:string,origin?:{latitude:number;longitude:number}):Promise<NearbyPlace[]>{
    // eslint-disable-next-line prettier/prettier
    const region=(this.regions||new RegionConfigService()).get(regionId);
    const key=this.kakaoKey;if(!key)throw new NearbyServiceError('NOT_CONFIGURED','장소명 검색은 현재 준비 중입니다.');
    const url=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');url.searchParams.set('query',query);url.searchParams.set('size','10');
    if(origin){url.searchParams.set('x',String(origin.longitude));url.searchParams.set('y',String(origin.latitude));url.searchParams.set('sort','distance')}
    const data=await this.kakaoGet(url,key),byId=new Map<string,NearbyPlace>();
    for(const item of data.documents)this.upsert(byId,item,'OTHER',query);
    const normalizedQuery=this.normalizeSearchText(query),regionTokens=this.regionTokens(regionId);
    // eslint-disable-next-line prettier/prettier
    return[...byId.values()].filter(place=>this.insideRegion(place.lat,place.lng,region?.bounds)&&this.addressMatchesRegion(place,region?.regionName)).filter(place=>!this.isUnsuitableLocationAnchor(place.providerCategoryName)).sort((a,b)=>this.locationAnchorScore(b,normalizedQuery,regionTokens)-this.locationAnchorScore(a,normalizedQuery,regionTokens)||(a.distanceMeters??Infinity)-(b.distanceMeters??Infinity));
  }

  // eslint-disable-next-line prettier/prettier
  async representativeAnchors(regionId:string):Promise<NearbyPlace[]>{const region=(this.regions||new RegionConfigService()).get(regionId),dataset=await this.regionalData?.effectiveDataset(regionId);return(dataset?.records||[]).filter(record=>record.runtimeDataStatus==='VERIFIED'&&record.entityType==='ATTRACTION'&&Number.isFinite(record.latitude)&&Number.isFinite(record.longitude)&&this.insideRegion(record.latitude!,record.longitude!,region?.bounds)).slice(0,8).map(record=>({id:`canonical:${record.entityUri}`,name:record.canonicalLabelKo,category:'TOURIST_ATTRACTION',categoryLabel:'관광지',providerCategoryName:record.category,address:record.address||'',roadAddress:record.address,phone:record.telephone,lat:record.latitude!,lng:record.longitude!,placeUrl:record.website||'',indoorRelevance:'UNKNOWN',operatingState:'UNKNOWN',operatingMessage:'현재 운영 여부 확인 필요',contextualReasons:['검증된 지역 대표 장소입니다.'],canonicalEntityUri:record.entityUri,canonicalLabel:record.canonicalLabelKo,masterVerificationStatus:record.runtimeDataStatus,transient:false,relevanceScore:5}))}

  private normalizeSearchText(value:string){return value.replace(/\s/g,'').toLowerCase()}
  // eslint-disable-next-line prettier/prettier
  private insideRegion(lat:number,lng:number,bounds?:{north:number;south:number;east:number;west:number}){return Boolean(bounds&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat<=bounds.north&&lat>=bounds.south&&lng<=bounds.east&&lng>=bounds.west)}
  // eslint-disable-next-line prettier/prettier
  private addressMatchesRegion(place:NearbyPlace,regionName?:string){return Boolean(regionName&&`${place.roadAddress||''} ${place.address||''}`.includes(regionName))}
  // eslint-disable-next-line prettier/prettier
  private requestedCategoryMatches(requested:NearbyCategory,actual:NearbyCategory){if(requested==='FOOD')return FOOD_CATEGORIES.has(actual)||actual==='FOOD';if(TOURISM_CATEGORIES.has(requested))return TOURISM_CATEGORIES.has(actual);return requested===actual}
  // eslint-disable-next-line prettier/prettier
  private canonicalConsistent(place:NearbyPlace){if(!place.canonicalEntityUri)return true;const canonical=this.master?.resolveCanonical(place.canonicalEntityUri);if(!canonical)return true;const categoryMatches=!canonical.category||this.requestedCategoryMatches(place.category,normalizeNearbyCategory(canonical.canonicalLabelKo,canonical.category,'',canonical.category as NearbyCategory));return categoryMatches&&(!Number.isFinite(canonical.latitude)||!Number.isFinite(canonical.longitude)||this.distanceMeters(place.lat,place.lng,canonical.latitude!,canonical.longitude!)<=CANONICAL_PROVIDER_MAX_DRIFT_METERS)}
  private regionTokens(regionId:string){try{return[this.regions?.get(regionId).regionName].filter((value):value is string=>Boolean(value))}catch{return[]}}
  private isUnsuitableLocationAnchor(category:string){return /유치원|어린이집|학교|학원/.test(category)}
  private locationAnchorScore(place:NearbyPlace,query:string,regionTokens:string[]){const name=this.normalizeSearchText(place.name),address=`${place.roadAddress||''} ${place.address||''}`;return(name===query?100:0)+(name.startsWith(query)?40:0)+(name.includes(query)?20:0)+(regionTokens.some(token=>address.includes(token))?30:0)+(/관공서|행정기관|관광명소|문화시설|교통시설/.test(place.providerCategoryName)?10:0)}

  async reverseGeocode(latitude:number,longitude:number){const key=this.kakaoKey;if(!key)throw new NearbyServiceError('NOT_CONFIGURED','주소 확인은 현재 준비 중입니다.');const url=new URL('https://dapi.kakao.com/v2/local/geo/coord2address.json');url.searchParams.set('x',String(longitude));url.searchParams.set('y',String(latitude));const data=await this.kakaoGet(url,key,false),document=data.documents?.[0],address=document?.road_address||document?.address;if(!address)return{status:'EMPTY' as const,label:'주소를 확인하지 못했습니다.'};const region1=address.region_1depth_name||'',region2=address.region_2depth_name||'',region3=address.region_3depth_name||'';return{status:'RESOLVED' as const,label:[region1,region2,region3].filter(Boolean).join(' '),address:address.address_name||'',region1,region2,region3}}

  private async addOperationalPlaces(byId: Map<string, NearbyPlace>, requested: NearbyCategory, lat: number, lng: number, radius: number, regionId: string) {
    const dataset = await this.regionalData!.effectiveDataset(regionId);
    for (const record of dataset?.records || []) {
      if (!Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)) continue;
      const category = normalizeNearbyCategory(record.canonicalLabelKo, record.category, '', record.category as NearbyCategory);
      if (!this.requestedCategoryMatches(requested,category)) continue;
      const distanceMeters = this.distanceMeters(lat, lng, record.latitude!, record.longitude!);
      if (distanceMeters > radius) continue;
      const existing = [...byId.values()].find((place) => place.canonicalEntityUri === record.entityUri || (this.distanceMeters(place.lat,place.lng,record.latitude!,record.longitude!)<=30 && Boolean(place.phone&&record.telephone&&place.phone===record.telephone)));
      if (existing) {
        existing.canonicalEntityUri = record.entityUri;
        existing.canonicalLabel = record.canonicalLabelKo;
        existing.masterVerificationStatus = record.runtimeDataStatus;
        continue;
      }
      byId.set(`canonical:${record.entityUri}`, {
        id: `canonical:${record.entityUri}`, name: record.canonicalLabelKo, category, categoryLabel: LABELS[category],
        providerCategoryName: record.category, address: record.address || '', roadAddress: record.address,
        phone: record.telephone, lat: record.latitude!, lng: record.longitude!, distanceMeters,
        placeUrl: record.website || '', indoorRelevance: INDOOR.has(category) ? 'INDOOR' : 'UNKNOWN',
        operatingState: 'UNKNOWN', operatingMessage: '현재 운영 여부 확인 필요', contextualReasons: ['검증된 지역 운영 데이터입니다.'],
        canonicalEntityUri: record.entityUri, canonicalLabel: record.canonicalLabelKo,
        masterVerificationStatus: record.runtimeDataStatus, transient: false, relevanceScore: 5,
      });
    }
  }

  private distanceMeters(aLat:number,aLng:number,bLat:number,bLng:number){const r=6371000,toRad=(v:number)=>v*Math.PI/180;const dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng);const h=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;return Math.round(2*r*Math.asin(Math.sqrt(h)))}

  private async fetchCategory(key: string, code: string, requested: NearbyCategory, lat: number, lng: number, radius: number, byId: Map<string, NearbyPlace>) {
    for (let page = 1; page <= 3; page++) {
      const url = this.url('category', lat, lng, radius);
      url.searchParams.set('category_group_code', code); url.searchParams.set('page', String(page)); url.searchParams.set('size', '15');
      const data = await this.kakaoGet(url, key);
      for (const d of data.documents) this.upsert(byId, d, requested);
      if (data.meta.is_end) break;
    }
  }

  private async fetchKeyword(key: string, keyword: string, requested: NearbyCategory, lat: number, lng: number, radius: number, byId: Map<string, NearbyPlace>) {
    const url = this.url('keyword', lat, lng, radius); url.searchParams.set('query', keyword); url.searchParams.set('size', '15');
    const data = await this.kakaoGet(url, key);
    for (const d of data.documents) this.upsert(byId, d, requested, keyword);
  }

  private url(kind: 'category' | 'keyword', lat: number, lng: number, radius: number) {
    const url = new URL(`https://dapi.kakao.com/v2/local/search/${kind}.json`);
    url.searchParams.set('x', String(lng)); url.searchParams.set('y', String(lat)); url.searchParams.set('radius', String(radius)); url.searchParams.set('sort', 'distance');
    return url;
  }

  private upsert(byId: Map<string, NearbyPlace>, d: any, requested: NearbyCategory, keyword?: string) {
    const lat = Number(d.y), lng = Number(d.x); if (!d?.id || !d?.place_name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!providerSupportsRequestedCategory(requested, d.category_group_code || '', d.category_name || '', keyword)) return;
    const category = FOOD_CATEGORIES.has(requested) || LODGING_CATEGORIES.has(requested) || PLANS[requested].providerGroup === 'TOURISM'
      ? requested
      : normalizeNearbyCategory(d.place_name, d.category_name || '', d.category_group_code || '', requested);
    const canonical = this.master?.resolveCanonical(d.place_name);
    const indoorRelevance = INDOOR.has(category) ? 'INDOOR' : category === 'TOURISM_NATURE' ? 'OUTDOOR' : 'UNKNOWN';
    const place: NearbyPlace = {
      id: d.id, name: canonical?.canonicalLabelKo || d.place_name, category, categoryLabel: LABELS[category],
      providerCategoryName: d.category_name || LABELS[category], address: canonical?.address || d.address_name || '',
      roadAddress: canonical?.address || d.road_address_name || undefined, phone: canonical?.telephone || d.phone || undefined,
      lat, lng, distanceMeters: d.distance ? Number(d.distance) : undefined, placeUrl: d.place_url || '', matchedKeyword: keyword,
      indoorRelevance, operatingState: 'UNKNOWN', operatingMessage: '현재 운영 여부 확인 필요',
      availabilityMessage: LODGING_CATEGORIES.has(category) ? '예약 가능 여부는 숙소에 직접 확인해 주세요.' : undefined,
      contextualReasons: [d.category_name ? `카카오 Local 분류: ${d.category_name}` : keyword ? `검색 분류 근거: ${keyword}` : '카카오 Local 주변 검색 결과입니다.'],
      canonicalEntityUri: canonical?.entityUri, canonicalLabel: canonical?.canonicalLabelKo,
      masterVerificationStatus: canonical?.verificationStatus, transient: true, relevanceScore: 0,
      categoryGroup: FOOD_CATEGORIES.has(category) ? '맛집' : undefined,
    };
    byId.set(place.id, place);
  }

  private async kakaoGet(url: URL, key: string, requireMeta=true): Promise<any> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: controller.signal });
      if (!response.ok) throw new NearbyServiceError('UPSTREAM_ERROR', '주변 장소 정보를 불러오지 못했습니다.', response.status);
      const data = await response.json();
      if (!data || !Array.isArray(data.documents) || (requireMeta&&typeof data.meta !== 'object')) throw new NearbyServiceError('INVALID_RESPONSE', '주변 장소 응답을 확인할 수 없습니다.');
      return data;
    } catch (error: any) {
      if (error instanceof NearbyServiceError) throw error;
      if (error?.name === 'AbortError') throw new NearbyServiceError('UPSTREAM_TIMEOUT', '주변 장소 검색 응답이 지연되고 있습니다.');
      this.logger.warn(`Kakao Local request failed: ${error?.name || 'network error'}`);
      throw new NearbyServiceError('UPSTREAM_ERROR', '주변 장소 정보를 불러오지 못했습니다.');
    } finally { clearTimeout(timer); }
  }

  async getRoutePreview(startLat: number, startLng: number, endLat: number, endLng: number, mode: 'foot' | 'car' = 'foot') {
    const profile = mode === 'car' ? 'driving' : 'foot';
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`);
      if (!response.ok) return null; const route = (await response.json()).routes?.[0]; if (!route) return null;
      return { coordinates: route.geometry.coordinates.map(([x, y]: number[]) => [y, x]), distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration) };
    } catch { return null; }
  }
  buildNavigationLinks(lat: number, lng: number, name: string) { const n = encodeURIComponent(name); return {
    kakaoMapApp: `kakaomap://route?ep=${lat},${lng}&by=FOOT`, kakaoMapWeb: `https://map.kakao.com/link/to/${n},${lat},${lng}`,
    naverMapApp: `nmap://route/walk?dlat=${lat}&dlng=${lng}&dname=${n}`, googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`,
  }; }
}
