import { BadRequestException, Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { NearbyService } from './nearby.service';

/**
 * /api/nearby/* — real-world, GPS-anchored POI lookup + route preview +
 * navigation handoff. Deliberately kept separate from the ontology-driven
 * `/api/recommendations` (which only knows about Gajo's own registered
 * Facility/Program individuals). This controller answers questions like
 * "지금 내 위치 기준으로 주변 건강식 식당이 어디 있어?" using live
 * third-party map data (Kakao Local API) rather than the domain ontology.
 */
@Controller('api/nearby')
export class NearbyController {
  constructor(private readonly nearby: NearbyService) {}

  @Get('status')
  status() {
    return { configured: this.nearby.isConfigured() };
  }

  @Get('restaurants')
  async restaurants(
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string,
    @Query('radius') radiusStr?: string,
  ) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new BadRequestException('lat, lng 쿼리 파라미터가 필요합니다.');
    }
    const radius = radiusStr ? Math.min(Math.max(parseInt(radiusStr, 10), 200), 5000) : 2000;
    if (!this.nearby.isConfigured()) {
      throw new ServiceUnavailableException(
        'KAKAO_REST_API_KEY가 설정되지 않았습니다. 카카오 디벨로퍼스에서 REST API 키를 발급받아 서버 환경변수로 등록해주세요.',
      );
    }
    const results = await this.nearby.searchRestaurants(lat, lng, radius);

    const grouped: Record<string, typeof results> = {};
    for (const r of results) {
      grouped[r.categoryGroup] = grouped[r.categoryGroup] || [];
      grouped[r.categoryGroup].push(r);
    }

    return {
      origin: { lat, lng },
      radius,
      total: results.length,
      groups: grouped,
      results,
    };
  }

  @Get('route')
  async route(
    @Query('startLat') startLatStr: string,
    @Query('startLng') startLngStr: string,
    @Query('endLat') endLatStr: string,
    @Query('endLng') endLngStr: string,
    @Query('mode') mode?: 'foot' | 'car',
  ) {
    const startLat = parseFloat(startLatStr);
    const startLng = parseFloat(startLngStr);
    const endLat = parseFloat(endLatStr);
    const endLng = parseFloat(endLngStr);
    if ([startLat, startLng, endLat, endLng].some(Number.isNaN)) {
      throw new BadRequestException('startLat, startLng, endLat, endLng 쿼리 파라미터가 필요합니다.');
    }
    const preview = await this.nearby.getRoutePreview(startLat, startLng, endLat, endLng, mode || 'foot');
    if (!preview) {
      return { available: false };
    }
    return { available: true, ...preview };
  }

  @Get('navigation-links')
  navigationLinks(
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string,
    @Query('name') name?: string,
  ) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new BadRequestException('lat, lng 쿼리 파라미터가 필요합니다.');
    }
    return this.nearby.buildNavigationLinks(lat, lng, name || '목적지');
  }
}
