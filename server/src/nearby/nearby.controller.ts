import { BadGatewayException, BadRequestException, Controller, GatewayTimeoutException, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { NearbyCategory, NearbyService, NearbyServiceError } from './nearby.service';

const CATEGORIES: NearbyCategory[] = ['FOOD', 'CAFE', 'LODGING', 'HOT_SPRING_WELLNESS', 'GOLF_SCREEN_GOLF', 'ACTIVITY', 'TOURISM_NATURE', 'CONVENIENCE', 'OTHER'];

@Controller('api/nearby')
export class NearbyController {
  constructor(private readonly nearby: NearbyService) {}
  @Get('status') status(@Query('regionId') regionId?:string) { return this.nearby.status(regionId); }

  @Get('discovery')
  async discovery(@Query('category') categoryValue: string, @Query('lat') latValue: string, @Query('lng') lngValue: string,
    @Query('radius') radiusValue?: string, @Query('weather') weather?: string, @Query('useDistance') useDistanceValue?: string,
    @Query('transportMode') transportMode?: 'car' | 'foot', @Query('regionId') regionId?: string) {
    if (!CATEGORIES.includes(categoryValue as NearbyCategory)) throw new BadRequestException('지원하지 않는 주변 장소 종류입니다.');
    const { lat, lng, radius } = this.validateSearch(latValue, lngValue, radiusValue);
    try {
      const results = await this.nearby.search(categoryValue as NearbyCategory, lat, lng, radius, { weather, useDistance: useDistanceValue !== 'false', transportMode: transportMode === 'car' ? 'car' : 'foot' }, regionId);
      return { origin: { lat, lng, distanceTrusted: useDistanceValue !== 'false' }, category: categoryValue, radius, total: results.length, resultStatus: results.length ? 'AVAILABLE' : 'EMPTY', results };
    } catch (error) { this.rethrow(error); }
  }

  /** Backward-compatible restaurant endpoint. */
  @Get('restaurants')
  async restaurants(@Query('lat') latValue: string, @Query('lng') lngValue: string, @Query('radius') radiusValue?: string) {
    const { lat, lng, radius } = this.validateSearch(latValue, lngValue, radiusValue); this.ensureConfigured();
    try {
      const results = await this.nearby.searchRestaurants(lat, lng, radius); const groups: Record<string, typeof results> = {};
      for (const row of results) (groups[row.categoryGroup || '맛집'] ||= []).push(row);
      return { origin: { lat, lng }, radius, total: results.length, resultStatus: results.length ? 'AVAILABLE' : 'EMPTY', groups, results };
    } catch (error) { this.rethrow(error); }
  }

  @Get('route')
  async route(@Query('startLat') a: string, @Query('startLng') b: string, @Query('endLat') c: string, @Query('endLng') d: string, @Query('mode') mode?: 'foot' | 'car') {
    const values = [a, b, c, d].map(Number); if (values.some(value => !Number.isFinite(value))) throw new BadRequestException('올바른 출발지와 목적지 좌표가 필요합니다.');
    const preview = await this.nearby.getRoutePreview(values[0], values[1], values[2], values[3], mode || 'foot'); return preview ? { available: true, ...preview } : { available: false };
  }

  @Get('navigation-links')
  navigationLinks(@Query('lat') latValue: string, @Query('lng') lngValue: string, @Query('name') name?: string) {
    const lat = Number(latValue), lng = Number(lngValue); if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new BadRequestException('올바른 목적지 좌표가 필요합니다.');
    return this.nearby.buildNavigationLinks(lat, lng, name || '목적지');
  }

  private ensureConfigured() { if (!this.nearby.isConfigured()) throw new ServiceUnavailableException({ code: 'NOT_CONFIGURED', message: '주변 장소 검색은 현재 준비 중입니다. 다른 컨시어지 기능은 계속 이용할 수 있습니다.' }); }
  private validateSearch(latValue: string, lngValue: string, radiusValue?: string) {
    const lat = Number(latValue), lng = Number(lngValue), inputRadius = radiusValue ? Number(radiusValue) : 2000;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new BadRequestException('올바른 lat, lng 값이 필요합니다.');
    if (!Number.isFinite(inputRadius)) throw new BadRequestException('radius는 숫자여야 합니다.');
    return { lat, lng, radius: Math.min(Math.max(inputRadius, 200), 5000) };
  }
  private rethrow(error: unknown): never {
    if (error instanceof NearbyServiceError) {
      if (error.code === 'UPSTREAM_TIMEOUT') throw new GatewayTimeoutException({ code: error.code, message: error.message });
      if (error.code === 'NOT_CONFIGURED') throw new ServiceUnavailableException({ code: error.code, message: error.message });
      throw new BadGatewayException({ code: error.code, message: error.message });
    }
    throw error;
  }
}
