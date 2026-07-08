import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * NearbyService: real-world "주변 시설" lookup layer, separate from the
 * ontology graph (which only knows about Gajo's own registered
 * Facility/Program individuals). This is the integration point for
 * "온천 후 갈 수 있는 지역 건강식 식당을 실제 위치 기준으로 찾아달라"
 * type requests, where the answer depends on the visitor's live GPS
 * location and third-party POI data, not the domain ontology.
 *
 * Data source: Kakao Local REST API (카카오 로컬 API, 무료 티어 - 일 100,000건).
 * Server holds the REST API key (`KAKAO_REST_API_KEY` env var) and proxies
 * requests so the key is never exposed to the browser.
 *
 * Route preview: OSRM public demo routing server (router.project-osrm.org,
 * free, no API key) is used to draw a walking/driving path on the map.
 * This is a best-effort preview only; the actual turn-by-turn navigation
 * is handed off to the visitor's own map app via deep link (see
 * buildNavigationLinks()) rather than reimplemented in-house.
 */

export interface RestaurantResult {
  id: string;
  name: string;
  categoryName: string;
  categoryGroup: '건강식/약선' | '한식' | '채식/사찰음식' | '해산물' | '기타 음식점';
  address: string;
  roadAddress?: string;
  phone?: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  placeUrl: string;
  matchedKeyword?: string;
}

const HEALTH_KEYWORDS = ['약선', '한방', '건강식', '웰빙', '보양', '흑염소', '오리', '한정식'];
const VEGETARIAN_KEYWORDS = ['채식', '사찰', '비건', '템플'];
const SEAFOOD_KEYWORDS = ['해물', '수산', '회', '장어', '민물', '매운탕', '어탕'];

function classify(placeName: string, categoryName: string): { group: RestaurantResult['categoryGroup']; matchedKeyword?: string } {
  const haystack = `${placeName} ${categoryName}`;
  for (const kw of HEALTH_KEYWORDS) {
    if (haystack.includes(kw)) return { group: '건강식/약선', matchedKeyword: kw };
  }
  for (const kw of VEGETARIAN_KEYWORDS) {
    if (haystack.includes(kw)) return { group: '채식/사찰음식', matchedKeyword: kw };
  }
  for (const kw of SEAFOOD_KEYWORDS) {
    if (haystack.includes(kw)) return { group: '해산물', matchedKeyword: kw };
  }
  if (categoryName.includes('한식')) return { group: '한식' };
  return { group: '기타 음식점' };
}

@Injectable()
export class NearbyService {
  private readonly logger = new Logger(NearbyService.name);

  constructor(private readonly config: ConfigService) {}

  private get kakaoKey(): string | undefined {
    return this.config.get<string>('KAKAO_REST_API_KEY') || process.env.KAKAO_REST_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.kakaoKey;
  }

  /**
   * Search restaurants around (lat, lng) within `radius` meters using
   * Kakao Local's category search (FD6 = 음식점), then classify each
   * result into a Korean-friendly category bucket for the frontend's
   * category tabs. Also runs a couple of targeted keyword searches
   * (약선/건강식, 채식/사찰음식) so health-food-specific venues that don't
   * surface near the top of the generic category search still show up.
   */
  async searchRestaurants(lat: number, lng: number, radius = 2000): Promise<RestaurantResult[]> {
    const key = this.kakaoKey;
    if (!key) {
      throw new Error(
        'KAKAO_REST_API_KEY가 설정되지 않았습니다. 카카오 디벨로퍼스에서 REST API 키를 발급받아 서버 환경변수로 등록해주세요.',
      );
    }

    const byId = new Map<string, RestaurantResult>();

    // 1) Generic restaurant category search, sorted by distance.
    await this.fetchCategoryPages(key, lat, lng, radius, byId);

    // 2) Targeted keyword boosts so health-food venues rank/appear even if
    //    they'd otherwise be buried in the generic category listing.
    for (const keyword of ['약선요리', '건강식당', '사찰음식', '채식뷔페']) {
      await this.fetchKeywordSearch(key, keyword, lat, lng, radius, byId);
    }

    const results = Array.from(byId.values());
    results.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
    return results;
  }

  private async fetchCategoryPages(
    key: string,
    lat: number,
    lng: number,
    radius: number,
    byId: Map<string, RestaurantResult>,
  ) {
    for (let page = 1; page <= 3; page++) {
      const url = new URL('https://dapi.kakao.com/v2/local/search/category.json');
      url.searchParams.set('category_group_code', 'FD6');
      url.searchParams.set('x', String(lng));
      url.searchParams.set('y', String(lat));
      url.searchParams.set('radius', String(radius));
      url.searchParams.set('sort', 'distance');
      url.searchParams.set('page', String(page));
      url.searchParams.set('size', '15');

      const res = await this.kakaoGet(url, key);
      if (!res) return;
      const documents: any[] = res.documents || [];
      for (const d of documents) this.upsert(byId, d);
      if (res.meta?.is_end) return;
    }
  }

  private async fetchKeywordSearch(
    key: string,
    keyword: string,
    lat: number,
    lng: number,
    radius: number,
    byId: Map<string, RestaurantResult>,
  ) {
    const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    url.searchParams.set('query', keyword);
    url.searchParams.set('x', String(lng));
    url.searchParams.set('y', String(lat));
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('sort', 'distance');
    url.searchParams.set('size', '10');

    const res = await this.kakaoGet(url, key);
    if (!res) return;
    const documents: any[] = res.documents || [];
    for (const d of documents) {
      // Keyword search results are only trusted if Kakao itself tagged
      // them as a restaurant (avoids picking up unrelated businesses that
      // merely mention the keyword in their name).
      if (d.category_group_code && d.category_group_code !== 'FD6') continue;
      this.upsert(byId, d, keyword);
    }
  }

  private upsert(byId: Map<string, RestaurantResult>, d: any, forcedKeyword?: string) {
    const { group, matchedKeyword } = classify(d.place_name, d.category_name || '');
    const entry: RestaurantResult = {
      id: d.id,
      name: d.place_name,
      categoryName: d.category_name,
      categoryGroup: group,
      address: d.address_name,
      roadAddress: d.road_address_name,
      phone: d.phone || undefined,
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
      distanceMeters: d.distance ? parseInt(d.distance, 10) : undefined,
      placeUrl: d.place_url,
      matchedKeyword: forcedKeyword || matchedKeyword,
    };
    const existing = byId.get(entry.id);
    if (!existing || (entry.matchedKeyword && !existing.matchedKeyword)) {
      byId.set(entry.id, entry);
    }
  }

  private async kakaoGet(url: URL, key: string): Promise<any | null> {
    try {
      const resp = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${key}` },
      });
      if (!resp.ok) {
        this.logger.warn(`Kakao Local API ${resp.status}: ${await resp.text()}`);
        return null;
      }
      return await resp.json();
    } catch (e: any) {
      this.logger.warn(`Kakao Local API request failed: ${e?.message || e}`);
      return null;
    }
  }

  /**
   * Best-effort walking/driving route geometry between two points, using
   * the free public OSRM demo server (no API key required). Used only to
   * draw a preview polyline on the map — actual turn-by-turn guidance is
   * handed off to a real navigation app (see buildNavigationLinks).
   */
  async getRoutePreview(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    mode: 'foot' | 'car' = 'foot',
  ): Promise<{ coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } | null> {
    const profile = mode === 'car' ? 'driving' : 'foot';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      const route = data.routes?.[0];
      if (!route) return null;
      const coords: [number, number][] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
      );
      return {
        coordinates: coords,
        distanceMeters: Math.round(route.distance),
        durationSeconds: Math.round(route.duration),
      };
    } catch (e: any) {
      this.logger.warn(`OSRM route request failed: ${e?.message || e}`);
      return null;
    }
  }

  /**
   * Deep links to hand off real navigation to the visitor's own map app.
   * We don't build turn-by-turn navigation in-house — that's a solved
   * problem the visitor's phone already does well; we just get them there
   * with the destination pre-filled.
   */
  buildNavigationLinks(destLat: number, destLng: number, destName: string) {
    const encodedName = encodeURIComponent(destName);
    return {
      // Kakao Map app (Android/iOS) - opens app directly if installed.
      kakaoMapApp: `kakaomap://route?ep=${destLat},${destLng}&by=FOOT`,
      // Kakao Map web fallback (works everywhere, no app required).
      kakaoMapWeb: `https://map.kakao.com/link/to/${encodedName},${destLat},${destLng}`,
      // Naver Map app scheme.
      naverMapApp: `nmap://route/walk?dlat=${destLat}&dlng=${destLng}&dname=${encodedName}`,
      // Google Maps - universal web/app link, works worldwide incl. iOS/Android.
      googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=walking`,
    };
  }
}
