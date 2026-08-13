import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MasterDataService } from '../master-data/master-data.service';

export type NearbyCategory =
  | 'FOOD' | 'CAFE' | 'LODGING' | 'HOT_SPRING_WELLNESS'
  | 'GOLF_SCREEN_GOLF' | 'ACTIVITY' | 'TOURISM_NATURE' | 'CONVENIENCE' | 'OTHER';

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
  transient: true;
  relevanceScore: number;
  /** Legacy restaurant bucket, retained for /restaurants clients. */
  categoryGroup?: string;
}

export interface NearbySearchOptions {
  weather?: string;
  useDistance?: boolean;
  transportMode?: 'car' | 'foot';
}

const LABELS: Record<NearbyCategory, string> = {
  FOOD: '맛집', CAFE: '카페', LODGING: '숙박', HOT_SPRING_WELLNESS: '온천·휴식',
  GOLF_SCREEN_GOLF: '골프·스크린골프', ACTIVITY: '놀거리·체험', TOURISM_NATURE: '산책·관광',
  CONVENIENCE: '편의시설', OTHER: '기타',
};
const INDOOR = new Set<NearbyCategory>(['CAFE', 'LODGING', 'HOT_SPRING_WELLNESS', 'GOLF_SCREEN_GOLF', 'CONVENIENCE']);
const PLANS: Record<NearbyCategory, { codes: string[]; keywords: string[] }> = {
  FOOD: { codes: ['FD6'], keywords: ['약선요리', '건강식당', '사찰음식', '채식뷔페'] },
  CAFE: { codes: ['CE7'], keywords: ['카페'] },
  LODGING: { codes: ['AD5'], keywords: ['호텔', '모텔', '펜션', '숙박시설'] },
  HOT_SPRING_WELLNESS: { codes: [], keywords: ['온천', '사우나', '찜질방', '스파'] },
  GOLF_SCREEN_GOLF: { codes: [], keywords: ['스크린골프', '골프연습장'] },
  ACTIVITY: { codes: [], keywords: ['체험', '놀거리', '레저'] },
  TOURISM_NATURE: { codes: ['AT4'], keywords: ['산책', '공원', '관광지'] },
  CONVENIENCE: { codes: ['CS2', 'PM9', 'HP8'], keywords: [] },
  OTHER: { codes: [], keywords: [] },
};

export function normalizeNearbyCategory(name: string, providerCategory = '', code = '', requested?: NearbyCategory): NearbyCategory {
  const text = `${name} ${providerCategory}`;
  if (code === 'CE7' || /카페|커피|다방/.test(text)) return 'CAFE';
  if (code === 'AD5' || /호텔|모텔|펜션|민박|숙박|리조트/.test(text)) return 'LODGING';
  if (/온천|사우나|찜질|스파|웰니스/.test(text)) return 'HOT_SPRING_WELLNESS';
  if (/스크린\s*골프|골프연습장/.test(text)) return 'GOLF_SCREEN_GOLF';
  if (code === 'AT4' || /관광|공원|산책|자연|명소/.test(text)) return 'TOURISM_NATURE';
  if (['CS2', 'PM9', 'HP8'].includes(code) || /편의점|약국|병원/.test(text)) return 'CONVENIENCE';
  if (/체험|레저|놀거리/.test(text)) return 'ACTIVITY';
  if (code === 'FD6' || /음식점|식당|한식|중식|일식|분식/.test(text)) return 'FOOD';
  return requested || 'OTHER';
}

@Injectable()
export class NearbyService {
  private readonly logger = new Logger(NearbyService.name);
  constructor(private readonly config: ConfigService, @Optional() private readonly master?: MasterDataService) {}
  private get kakaoKey() { return (this.config.get<string>('KAKAO_REST_API_KEY') || process.env.KAKAO_REST_API_KEY)?.trim() || undefined; }
  private get timeoutMs() { const n = Number(this.config.get('KAKAO_LOCAL_TIMEOUT_MS') || 5000); return Number.isFinite(n) && n >= 500 && n <= 30000 ? n : 5000; }
  isConfigured() { return !!this.kakaoKey; }
  status() { return { configured: this.isConfigured(), state: this.isConfigured() ? 'READY' : 'NOT_CONFIGURED', provider: 'KAKAO_LOCAL', timeoutMs: this.timeoutMs }; }

  async search(category: NearbyCategory, lat: number, lng: number, radius = 2000, options: NearbySearchOptions = {}): Promise<NearbyPlace[]> {
    const key = this.kakaoKey;
    if (!key) throw new NearbyServiceError('NOT_CONFIGURED', '주변 장소 검색은 현재 준비 중입니다.');
    const plan = PLANS[category];
    const byId = new Map<string, NearbyPlace>();
    for (const code of plan.codes) await this.fetchCategory(key, code, category, lat, lng, radius, byId);
    for (const keyword of plan.keywords) await this.fetchKeyword(key, keyword, category, lat, lng, radius, byId);
    const useDistance = options.useDistance !== false;
    const rainy = options.weather === 'HEAVY_RAIN';
    for (const place of byId.values()) {
      if (!useDistance) { delete place.distanceMeters; delete place.estimatedTravelMinutes; }
      else if (place.distanceMeters != null) place.estimatedTravelMinutes = Math.max(1, Math.round(place.distanceMeters / (options.transportMode === 'foot' ? 75 : 300)));
      if (rainy && place.indoorRelevance === 'INDOOR') {
        place.relevanceScore += 10;
        place.contextualReasons.push('비 오는 날 이용하기 좋은 실내 장소입니다.');
      }
      if (useDistance && place.distanceMeters != null && place.distanceMeters <= 1500) place.contextualReasons.push('현재 위치에서 가까운 후보입니다.');
    }
    return [...byId.values()].sort((a, b) => b.relevanceScore - a.relevanceScore || (useDistance ? (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) : 0));
  }

  async searchRestaurants(lat: number, lng: number, radius = 2000) { return this.search('FOOD', lat, lng, radius); }

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
    const category = normalizeNearbyCategory(d.place_name, d.category_name || '', d.category_group_code || '', requested);
    const canonical = this.master?.resolveCanonical(d.place_name);
    const indoorRelevance = INDOOR.has(category) ? 'INDOOR' : category === 'TOURISM_NATURE' ? 'OUTDOOR' : 'UNKNOWN';
    const place: NearbyPlace = {
      id: d.id, name: canonical?.canonicalLabelKo || d.place_name, category, categoryLabel: LABELS[category],
      providerCategoryName: d.category_name || LABELS[category], address: canonical?.address || d.address_name || '',
      roadAddress: canonical?.address || d.road_address_name || undefined, phone: canonical?.telephone || d.phone || undefined,
      lat, lng, distanceMeters: d.distance ? Number(d.distance) : undefined, placeUrl: d.place_url || '', matchedKeyword: keyword,
      indoorRelevance, operatingState: 'UNKNOWN', operatingMessage: '현재 운영 여부 확인 필요',
      availabilityMessage: category === 'LODGING' ? '숙박 정보 확인 필요' : undefined, contextualReasons: [],
      canonicalEntityUri: canonical?.entityUri, canonicalLabel: canonical?.canonicalLabelKo,
      masterVerificationStatus: canonical?.verificationStatus, transient: true, relevanceScore: 0,
      categoryGroup: category === 'FOOD' ? '맛집' : undefined,
    };
    byId.set(place.id, place);
  }

  private async kakaoGet(url: URL, key: string): Promise<any> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: controller.signal });
      if (!response.ok) throw new NearbyServiceError('UPSTREAM_ERROR', '주변 장소 정보를 불러오지 못했습니다.', response.status);
      const data = await response.json();
      if (!data || !Array.isArray(data.documents) || typeof data.meta !== 'object') throw new NearbyServiceError('INVALID_RESPONSE', '주변 장소 응답을 확인할 수 없습니다.');
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
