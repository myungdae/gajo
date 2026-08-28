/* eslint-disable prettier/prettier */
import { BadGatewayException, BadRequestException, Body, Controller, GatewayTimeoutException, Get, Post, Query, ServiceUnavailableException,UseGuards } from '@nestjs/common';
import { NearbyCategory, NearbyService, NearbyServiceError } from './nearby.service';
import { PublicWriteLimit,PublicWriteRateLimitGuard } from '../partner/public-write-security';

const CATEGORIES: NearbyCategory[] = [
  'TOURIST_ATTRACTION', 'NATURE', 'CULTURE_ART', 'EXPERIENCE', 'FESTIVAL_EXHIBITION',
  'FOOD', 'FOOD_KOREAN', 'FOOD_WESTERN', 'FOOD_CHINESE', 'FOOD_JAPANESE', 'CAFE', 'CAFE_BAKERY',
  'LODGING', 'LODGING_HOTEL_RESORT', 'LODGING_PENSION_MINBAK', 'LODGING_CAMPING_GLAMPING', 'LODGING_MOTEL', 'LODGING_GUESTHOUSE',
  'HOT_SPRING_WELLNESS', 'GOLF_SCREEN_GOLF', 'ACTIVITY', 'TOURISM_NATURE', 'CONVENIENCE', 'ESSENTIAL_SHOPPING',
  'CONVENIENCE_STORE', 'MART_SUPERMARKET', 'PARKING', 'PUBLIC_TOILET', 'GAS_STATION', 'EV_CHARGER', 'TOURIST_INFORMATION', 'PHARMACY', 'HOSPITAL', 'MEDICAL', 'ATM', 'OTHER',
];

@Controller('api/nearby')
export class NearbyController {
  constructor(private readonly nearby: NearbyService) {}
  @Get('status') status(@Query('regionId') regionId?:string) { return this.nearby.status(regionId); }

  @Post('reverse-geocode') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP') async reverseGeocode(@Body() body:{latitude:number;longitude:number}){const{lat,lng}=this.validateSearch(String(body.latitude),String(body.longitude));this.ensureConfigured();try{return await this.nearby.reverseGeocode(lat,lng)}catch(error){this.rethrow(error)}}
  @Post('location-search') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP') async locationSearch(@Body() body:{query:string;regionId:string;origin?:{latitude:number;longitude:number}}){const query=(body.query||'').trim();if(query.length<2||query.length>80)throw new BadRequestException('장소명은 2자 이상 80자 이하로 입력해 주세요.');this.ensureConfigured();let origin:typeof body.origin;if(body.origin){const valid=this.validateSearch(String(body.origin.latitude),String(body.origin.longitude));origin={latitude:valid.lat,longitude:valid.lng}}try{return{results:await this.nearby.searchByKeyword(query,body.regionId,origin)}}catch(error){this.rethrow(error)}}

  @Post('discovery') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP')
  async discovery(@Body() body:{category:string;latitude:number;longitude:number;radius?:number;weather?:string;useDistance?:boolean;transportMode?:'car'|'foot';regionId?:string}) {
    const {category:categoryValue,weather,transportMode,regionId}=body,useDistanceValue=body.useDistance!==false;
    if (!CATEGORIES.includes(categoryValue as NearbyCategory)) throw new BadRequestException('지원하지 않는 주변 장소 종류입니다.');
    const { lat, lng, radius } = this.validateSearch(String(body.latitude), String(body.longitude), body.radius==null?undefined:String(body.radius));
    try {
      const results = await this.nearby.search(categoryValue as NearbyCategory, lat, lng, radius, { weather, useDistance: useDistanceValue, transportMode: transportMode === 'car' ? 'car' : 'foot' }, regionId);
      return { searchedAt:new Date().toISOString(),timeZone:'Asia/Seoul',origin: { lat, lng, distanceTrusted: useDistanceValue }, category: categoryValue, radius, total: results.length, resultStatus: results.length ? 'AVAILABLE' : 'EMPTY', results:results.slice(0,30) };
    } catch (error) { this.rethrow(error); }
  }
  @Post('restaurants') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP')
  async restaurants(@Body() body:{latitude:number;longitude:number;radius?:number}) {
    const { lat, lng, radius } = this.validateSearch(String(body.latitude),String(body.longitude),body.radius==null?undefined:String(body.radius)); this.ensureConfigured();
    try {
      const results = await this.nearby.searchRestaurants(lat, lng, radius); const groups: Record<string, typeof results> = {};
      for (const row of results) (groups[row.categoryGroup || '맛집'] ||= []).push(row);
      return { origin: { lat, lng }, radius, total: results.length, resultStatus: results.length ? 'AVAILABLE' : 'EMPTY', groups, results };
    } catch (error) { this.rethrow(error); }
  }

  @Post('route') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP')
  async route(@Body() body:{startLatitude:number;startLongitude:number;endLatitude:number;endLongitude:number;mode?:'foot'|'car'}) {
    const {startLatitude:a,startLongitude:b,endLatitude:c,endLongitude:d,mode}=body;
    const values = [a, b, c, d].map(Number); if (values.some(value => !Number.isFinite(value))) throw new BadRequestException('올바른 출발지와 목적지 좌표가 필요합니다.');
    const preview = await this.nearby.getRoutePreview(values[0], values[1], values[2], values[3], mode || 'foot'); return preview ? { available: true, ...preview } : { available: false };
  }

  @Post('navigation-links') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP')
  navigationLinks(@Body() body:{latitude:number;longitude:number;name?:string}) {
    const {latitude:lat,longitude:lng,name}=body;if (!Number.isFinite(lat) || !Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180) throw new BadRequestException('올바른 목적지 좌표가 필요합니다.');
    return this.nearby.buildNavigationLinks(lat, lng, name || '목적지');
  }

  private ensureConfigured() { if (!this.nearby.isConfigured()) throw new ServiceUnavailableException({ code: 'NOT_CONFIGURED', message: '주변 장소 검색은 현재 준비 중입니다. 다른 컨시어지 기능은 계속 이용할 수 있습니다.' }); }
  private validateSearch(latValue: string, lngValue: string, radiusValue?: string) {
    const lat = Number(latValue), lng = Number(lngValue), inputRadius = radiusValue ? Number(radiusValue) : 1000;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new BadRequestException('올바른 lat, lng 값이 필요합니다.');
    if (![1000,3000,5000].includes(inputRadius)) throw new BadRequestException('radius는 1000, 3000, 5000 중 하나여야 합니다.');
    return { lat, lng, radius:inputRadius };
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
