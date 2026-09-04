import { BadRequestException } from '@nestjs/common';
export const CHANNEL_KINDS = ['OFFICIAL_WEBSITE', 'PHONE', 'NAVER_PLACE', 'KAKAO_PLACE', 'DIRECT_BOOKING'] as const;
export type ChannelKind = typeof CHANNEL_KINDS[number];
export function channelHttps(value: unknown): string {
  const fail = () => { throw new BadRequestException('Public HTTPS URL required'); };
  if (typeof value !== 'string' || value.length > 1000 || /[\s\\\u0000-\u001f]/.test(value)) return fail();
  let u: URL; try { u = new URL(value); } catch { return fail(); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash ||
      !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(u.hostname) ||
      /%(?:0[ad]|5c)/i.test(value)) return fail();
  // Shared booking landing pages are not an establishment-specific reservation channel.
  if (u.hostname === 'rev.yapen.co.kr' && (u.pathname !== '/external' || !/^ypIdx=\d+$/.test(u.search.slice(1)))) return fail();
  // Naver booking requires separate provenance review; only place listings are supported here.
  if (u.hostname === 'booking.naver.com' || u.hostname.endsWith('.booking.naver.com')) return fail();
  return value;
}
export function channelInput(input: any) {
  if (!input || Object.keys(input).some(k => !['kind','labelKo','labelEn','target','sourceUrl','reviewDueAt'].includes(k))) throw new BadRequestException('Invalid channel fields');
  if (!CHANNEL_KINDS.includes(input.kind)) throw new BadRequestException('Invalid channel kind');
  for (const key of ['labelKo','labelEn']) if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 80) throw new BadRequestException('Bilingual labels required');
  const target = input.kind === 'PHONE' ? input.target : channelHttps(input.target);
  if (input.kind === 'PHONE' && (typeof target !== 'string' || !/^\+?[0-9][0-9-]{6,19}$/.test(target))) throw new BadRequestException('Invalid phone');
  if (input.kind === 'NAVER_PLACE' && !['map.naver.com','m.place.naver.com','pcmap.place.naver.com'].includes(new URL(target).hostname)) throw new BadRequestException('Naver place URL required');
  if (input.kind === 'KAKAO_PLACE' && new URL(target).hostname !== 'place.map.kakao.com') throw new BadRequestException('Kakao place URL required');
  const due = new Date(input.reviewDueAt);
  if (!Number.isFinite(due.getTime()) || due.getTime() <= Date.now() || due.getTime() > Date.now() + 366 * 86400000) throw new BadRequestException('Review due date must be within one year');
  return { kind: input.kind as ChannelKind, labelKo: input.labelKo.trim(), labelEn: input.labelEn.trim(), target, sourceUrl: channelHttps(input.sourceUrl), reviewDueAt: due };
}
export function channelVisible(channel: any, now = new Date()) {
  return channel.verificationStatus === 'VERIFIED' && channel.published === true && new Date(channel.reviewDueAt) > now;
}
