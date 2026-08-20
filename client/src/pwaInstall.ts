import type { RegionId } from './regionConfig.ts';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
export type InstallPlatform = 'ios-safari'|'samsung-internet'|'android-browser'|'other';
let capturedPrompt: BeforeInstallPromptEvent|null=null;
const promptListeners=new Set<(event:BeforeInstallPromptEvent)=>void>();
let captureStarted=false;
export function initializeInstallPromptCapture(target:Pick<Window,'addEventListener'>=window){if(captureStarted)return;captureStarted=true;target.addEventListener('beforeinstallprompt',(event:Event)=>{event.preventDefault();capturedPrompt=event as BeforeInstallPromptEvent;promptListeners.forEach(listener=>listener(capturedPrompt!))})}
export function currentInstallPrompt(){return capturedPrompt}
export function clearInstallPrompt(){capturedPrompt=null}
export function subscribeToInstallPrompt(listener:(event:BeforeInstallPromptEvent)=>void){promptListeners.add(listener);return()=>{promptListeners.delete(listener)}}
export function isStandalone(media: Pick<Window, 'matchMedia'> = window, nav: Navigator = navigator) {
  return media.matchMedia('(display-mode: standalone)').matches || Boolean((nav as Navigator & { standalone?: boolean }).standalone);
}
export function isIosSafari(userAgent: string, vendor = '') {
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
  return ios && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent) && /Apple/i.test(vendor || 'Apple');
}
export function installPlatform(userAgent:string,vendor=''):InstallPlatform{if(isIosSafari(userAgent,vendor))return'ios-safari';if(/SamsungBrowser/i.test(userAgent))return'samsung-internet';if(/Android/i.test(userAgent))return'android-browser';return'other'}
export function installExperienceMode({usefulResult,dismissed,standalone,platform,promptAvailable}:{usefulResult:boolean;dismissed:boolean;standalone:boolean;platform:InstallPlatform;promptAvailable:boolean}){if(!usefulResult||dismissed||standalone)return'hidden' as const;if(promptAvailable)return'native' as const;if(platform==='ios-safari')return'ios-guide' as const;if(platform==='android-browser'||platform==='samsung-internet')return'android-guide' as const;return'hidden' as const}
export const manifestHref = (regionId: RegionId) => `/manifest-${regionId}.webmanifest`;
export const installDismissalKey = (regionId: RegionId) => `regional-concierge-install-dismissed:${regionId}`;
