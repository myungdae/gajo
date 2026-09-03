import { regionalPath } from './regionRouting.ts';
import type { RegionId } from './regionConfig.ts';
import { localePath, resolveVisitorLocale, type VisitorLocale } from './visitorLocaleContract.ts';

export function currentVisitorLocale(): VisitorLocale {
  if (typeof window === 'undefined') return 'ko';
  let saved: string | null = null;
  try { saved = window.localStorage.getItem('regional-home-language-v1'); } catch { /* Storage may be disabled. */ }
  return resolveVisitorLocale(window.location.search, saved);
}

/** Build the final URL before navigation, sharing or opening a new tab. */
export function localizedRegionalPath(path: string, regionId: RegionId, explicitGajo?: boolean, locale = currentVisitorLocale()) {
  return localePath(regionalPath(path, regionId, explicitGajo), locale);
}
