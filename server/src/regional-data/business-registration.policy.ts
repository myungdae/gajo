import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { channelHttps } from '../action-channels/channel-policy';
import type { AdminPrincipal } from './admin-token.guard';

export const BUSINESS_TYPES = ['ACCOMMODATION','PENSION','GLAMPING','CAMPING','CAFE','RESTAURANT','ATTRACTION','EXPERIENCE'] as const;
export function businessScope(principal: AdminPrincipal, regionId: unknown) {
  if (regionId !== 'hapcheon' || !principal?.allowedRegionIds?.includes('hapcheon')) throw new ForbiddenException('합천 지역 관리 권한이 필요합니다.');
}
const normalized = (v: unknown) => typeof v === 'string' ? v.normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g, '') : '';
export function businessIdentity(input: any) {
  return [ ['name',input.displayName], ['address',input.address], ['phone',input.phone || input.telephone], ['website',input.websiteUrl || input.website] ]
    .filter(([,v]) => normalized(v)).map(([k,v]) => `hapcheon:${k}:${createHash('sha256').update(normalized(v)).digest('hex')}`);
}
export function businessInput(input: any) {
  const allowed = ['displayName','englishName','businessType','address','phone','websiteUrl','naverPlaceUrl','kakaoPlaceUrl','latitude','longitude','mapConfirmed','phoneConfirmed','shortDescription','sourceUrl','verifiedOn'];
  if (!input || Object.keys(input).some(k => !allowed.includes(k))) throw new BadRequestException('지원하지 않는 입력 항목입니다.');
  const value: any = {};
  for (const k of allowed.filter(k => !['latitude','longitude','mapConfirmed','phoneConfirmed'].includes(k))) {
    if (input[k] !== undefined && typeof input[k] !== 'string') throw new BadRequestException('문자 입력을 확인해 주세요.');
    value[k] = (input[k] || '').trim();
    if (value[k].length > 1000) throw new BadRequestException('입력이 너무 깁니다.');
  }
  if (!value.displayName || !value.address || !value.shortDescription || !BUSINESS_TYPES.includes(value.businessType)) throw new BadRequestException('업소명·업종·주소·소개를 입력해 주세요.');
  channelHttps(value.sourceUrl);
  for (const k of ['websiteUrl','naverPlaceUrl','kakaoPlaceUrl']) if (value[k]) channelHttps(value[k]);
  if (value.naverPlaceUrl && !['map.naver.com','m.place.naver.com','pcmap.place.naver.com'].includes(new URL(value.naverPlaceUrl).hostname)) throw new BadRequestException('네이버 플레이스 주소를 확인해 주세요.');
  if (value.kakaoPlaceUrl && new URL(value.kakaoPlaceUrl).hostname !== 'place.map.kakao.com') throw new BadRequestException('카카오 플레이스 주소를 확인해 주세요.');
  if (value.phone && !/^\+?[0-9][0-9-]{6,19}$/.test(value.phone)) throw new BadRequestException('전화번호 형식을 확인해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.verifiedOn) || !Number.isFinite(Date.parse(value.verifiedOn)) || value.verifiedOn > new Date().toISOString().slice(0,10)) throw new BadRequestException('정보 확인일을 확인해 주세요.');
  const hasLat = input.latitude !== undefined && input.latitude !== '', hasLng = input.longitude !== undefined && input.longitude !== '';
  if (hasLat !== hasLng || (hasLat && (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || input.latitude < 33 || input.latitude > 39 || input.longitude < 124 || input.longitude > 132))) throw new BadRequestException('위도와 경도를 함께 확인해 주세요.');
  value.latitude = hasLat ? input.latitude : undefined; value.longitude = hasLng ? input.longitude : undefined;
  value.mapConfirmed = input.mapConfirmed === true; value.phoneConfirmed = input.phoneConfirmed === true;
  if (value.mapConfirmed && !hasLat) throw new BadRequestException('지도 확인에는 좌표가 필요합니다.');
  if (value.phoneConfirmed && !value.phone) throw new BadRequestException('확인할 전화번호를 입력해 주세요.');
  return value;
}
export function businessFacts(input: any) {
  const lodging = ['ACCOMMODATION','PENSION','GLAMPING','CAMPING'].includes(input.businessType);
  return { displayName: input.displayName, visitorContent: input.englishName ? { reviewedEnglishName: input.englishName } : {},
    entityType: lodging ? 'ACCOMMODATION' : input.businessType, category: lodging ? 'ACCOMMODATION' : input.businessType,
    tags: [input.businessType], address: input.address, shortDescription: input.shortDescription,
    latitude: input.mapConfirmed ? input.latitude : undefined, longitude: input.mapConfirmed ? input.longitude : undefined,
    // Contact URLs and phone numbers are published only through reviewed Action Channels.
    phone: undefined, websiteUrl: undefined, reservationUrl: undefined };
}
