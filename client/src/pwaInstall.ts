import type { RegionId } from './regionConfig.ts';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
export function isStandalone(media: Pick<Window, 'matchMedia'> = window, nav: Navigator = navigator) {
  return media.matchMedia('(display-mode: standalone)').matches || Boolean((nav as Navigator & { standalone?: boolean }).standalone);
}
export function isIosSafari(userAgent: string, vendor = '') {
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
  return ios && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent) && /Apple/i.test(vendor || 'Apple');
}
export const manifestHref = (regionId: RegionId) => `/manifest-${regionId}.webmanifest`;
export const installDismissalKey = (regionId: RegionId) => `regional-concierge-install-dismissed:${regionId}`;
