export const CHANNEL_LABELS = {
  ko: { DIRECT_BOOKING: '실시간 예약하기', OFFICIAL_WEBSITE: '공식 홈페이지', PHONE: '전화하기', NAVER_PLACE: '네이버에서 보기', KAKAO_PLACE: '카카오에서 보기' },
  en: { DIRECT_BOOKING: 'Book Now', OFFICIAL_WEBSITE: 'Official Website', PHONE: 'Call', NAVER_PLACE: 'View on Naver', KAKAO_PLACE: 'View on Kakao' },
} as const;
export type ChannelKind = keyof typeof CHANNEL_LABELS.ko;
export interface PublicChannel { channelId: string; regionId: string; placeKey: string; kind: ChannelKind; labelKo: string; labelEn: string; revision: number }
export const channelQuery = (regionId: string, placeKey: string) => new URLSearchParams({regionId, placeKey}).toString();
export const channelLabel = (channel: PublicChannel, language: 'ko'|'en') => language === 'en' ? channel.labelEn : channel.labelKo;
