/* eslint-disable prettier/prettier */
import { BadGatewayException, BadRequestException, Body, Controller, GatewayTimeoutException, Get, Post, Query, ServiceUnavailableException,UseGuards } from '@nestjs/common';
import { NearbyCategory, NearbyService, NearbyServiceError } from './nearby.service';
import { PublicWriteLimit,PublicWriteRateLimitGuard } from '../partner/public-write-security';
import { NEARBY_RADIUS_STEPS, SELECTABLE_NEARBY_RADII, type NearbyRadius } from './nearby-radius.policy';

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
  @Get('anchors') async anchors(@Query('regionId') regionId?:string) { if(!regionId?.trim())throw new BadRequestException('regionId가 필요합니다.');return{results:await this.nearby.representativeAnchors(regionId.trim())}; }

  @Post('reverse-geocode') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP') async reverseGeocode(@Body() body:{latitude:number;longitude:number;regionId?:string;accuracy?:number}){if(!body.regionId?.trim())throw new BadRequestException('regionId가 필요합니다.');const{lat,lng}=this.validateSearch(String(body.latitude),String(body.longitude));const accuracy=Number(body.accuracy);if(!Number.isFinite(accuracy)||accuracy<0||accuracy>500)throw new BadRequestException('위치 정확도는 0m 이상 500m 이하여야 합니다.');this.ensureConfigured();try{return await this.nearby.reverseGeocode(lat,lng,body.regionId.trim(),accuracy)}catch(error){this.rethrow(error)}}
  @Post('location-search') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP') async locationSearch(@Body() body:{query:string;regionId?:string;experienceRegionId?:string;searchRegionId?:string|null;coordinateSearch?:boolean;origin?:{latitude:number;longitude:number}}){const query=(body.query||'').trim();if(query.length<2||query.length>80)throw new BadRequestException('장소명은 2자 이상 80자 이하로 입력해 주세요.');this.ensureConfigured();let origin:typeof body.origin;if(body.origin){const valid=this.validateSearch(String(body.origin.latitude),String(body.origin.longitude));origin={latitude:valid.lat,longitude:valid.lng}}const searchRegionId=body.coordinateSearch?body.searchRegionId||undefined:body.searchRegionId||body.regionId;try{return{experienceRegionId:body.experienceRegionId||body.regionId,searchRegionId:searchRegionId||null,results:await this.nearby.searchByKeyword(query,searchRegionId,origin)}}catch(error){this.rethrow(error)}}

  @Post('discovery') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP')
  async discovery(@Body() body:{category:string;latitude:number;longitude:number;radius?:number;weather?:string;useDistance?:boolean;transportMode?:'car'|'foot';regionId?:string;experienceRegionId?:string;searchRegionId?:string|null;coordinateSearch?:boolean;regionMembership?:'INSIDE'|'OUTSIDE'|'UNCERTAIN'}) {
    const {category:categoryValue,weather,transportMode}=body,useDistanceValue=body.useDistance!==false,experienceRegionId=(body.experienceRegionId||body.regionId)?.trim(),searchRegionId=body.coordinateSearch?body.searchRegionId?.trim()||undefined:body.searchRegionId?.trim()||body.regionId?.trim();
    if (!experienceRegionId) throw new BadRequestException('experienceRegionId가 필요합니다.');
    if (!CATEGORIES.includes(categoryValue as NearbyCategory)) throw new BadRequestException('지원하지 않는 주변 장소 종류입니다.');
    const { lat, lng, radius } = this.validateSearch(String(body.latitude), String(body.longitude), body.radius==null?undefined:String(body.radius),false);
    try {
      const search = await this.nearby.searchProgressively(categoryValue as NearbyCategory, lat, lng, { weather, useDistance: useDistanceValue, transportMode: transportMode === 'car' ? 'car' : 'foot' }, searchRegionId, radius as NearbyRadius|undefined,experienceRegionId,body.regionMembership),results=search.results;
      return { searchedAt:new Date().toISOString(),timeZone:'Asia/Seoul',distanceTrusted:useDistanceValue,experienceRegionId,searchRegionId:searchRegionId||null,regionMembership:body.regionMembership||'UNCERTAIN',category:categoryValue,radius:search.radius,initialRadius:search.initialRadius,nextRadius:search.nextRadius,minimumCandidates:search.minimumCandidates,expanded:search.expanded,coverageStatus:search.coverageStatus,providerCalls:search.providerCalls,diagnostics:search.diagnostics,distanceBands:search.distanceBands,total:results.length,resultStatus:results.length?'AVAILABLE':'EMPTY',results:results.slice(0,30) };
    } catch (error) { this.rethrow(error); }
  }
  @Post('restaurants') @UseGuards(PublicWriteRateLimitGuard) @PublicWriteLimit('NEARBY_LOOKUP')
  async restaurants(@Body() body:{latitude:number;longitude:number;radius?:number;regionId?:string}) {
    if(!body.regionId?.trim())throw new BadRequestException('regionId가 필요합니다.');
    const { lat, lng, radius } = this.validateSearch(String(body.latitude),String(body.longitude),body.radius==null?undefined:String(body.radius)); this.ensureConfigured();
    try {
      const results = await this.nearby.search('FOOD',lat,lng,radius,{},body.regionId.trim()); const groups: Record<string, typeof results> = {};
      for (const row of results) (groups[row.categoryGroup || '맛집'] ||= []).push(row);
      return { radius, total: results.length, resultStatus: results.length ? 'AVAILABLE' : 'EMPTY', groups, results };
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
  private validateSearch(latValue: string, lngValue: string, radiusValue?: string,defaultRadius=true) {
    const lat = Number(latValue), lng = Number(lngValue), inputRadius = radiusValue ? Number(radiusValue) : defaultRadius?1000:undefined;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new BadRequestException('올바른 lat, lng 값이 필요합니다.');
    const validRadii:readonly number[]=[...NEARBY_RADIUS_STEPS,...SELECTABLE_NEARBY_RADII];
    if (inputRadius!=null&&!validRadii.includes(inputRadius)) throw new BadRequestException('radius는 1000, 3000, 5000, 10000, 20000, 30000, 40000, 50000 중 하나여야 합니다.');
    return { lat, lng, radius:inputRadius };
  }
  private rethrow(error: unknown): never {
    if (error instanceof NearbyServiceError) {
      if (error.code === 'INVALID_REQUEST')
        throw new BadRequestException({
          code: error.code,
          message: error.message,
        });
      if (error.code === 'UPSTREAM_TIMEOUT') throw new GatewayTimeoutException({ code: error.code, message: error.message });
      if (error.code === 'NOT_CONFIGURED') throw new ServiceUnavailableException({ code: error.code, message: error.message });
      throw new BadGatewayException({ code: error.code, message: error.message });
    }
    throw error;
  }
}
