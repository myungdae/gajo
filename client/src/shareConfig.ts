import { getRegionShareConfig, type RegionConfig, type ShareKind } from './regionConfig.ts';
import { localePath, type VisitorLocale } from './visitorLocaleContract.ts';

export function companionSharePayload(
  region: RegionConfig,
  kind: ShareKind = 'REGIONAL_ENTRY',
  locale: VisitorLocale = 'ko',
) {
  if (kind !== 'REGIONAL_ENTRY') {
    throw new Error('TRIP_INVITE requires an opaque, expiring invite token');
  }
  const share = getRegionShareConfig(region);
  return {
    kind,
    url: locale === 'en' ? localePath(`${share.url}?start=ai`, locale) : share.url,
    title: share.title,
    description: share.description,
    buttonLabel: share.buttonLabel,
    image: share.image,
  };
}

export async function fallbackRegionalShare(
  payload: ReturnType<typeof companionSharePayload>,
  browserNavigator: Pick<Navigator, 'share'|'clipboard'>,
) {
  try {
    if (browserNavigator.share) {
      await browserNavigator.share({ title:payload.title, text:payload.description, url:payload.url });
      return 'SHARED' as const;
    }
  } catch {
    // A dismissed or unavailable native share sheet safely falls through to copy.
  }
  await browserNavigator.clipboard.writeText(payload.url);
  return 'COPIED' as const;
}

export function initializeKakaoShare(
  kakao: { isInitialized():boolean; init(key:string):void; Share?:unknown }|undefined,
  key: string,
) {
  try {
    if (!kakao?.isInitialized()) kakao?.init(key);
    return Boolean(kakao?.isInitialized() && kakao.Share);
  } catch {
    return false;
  }
}
