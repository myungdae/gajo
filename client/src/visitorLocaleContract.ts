export type VisitorLocale = 'ko' | 'en';

export function normalizeLocale(value: unknown): VisitorLocale {
  return value === 'en' ? 'en' : 'ko';
}

/** Explicit URLs take precedence over saved device preferences, including invalid values. */
export function resolveVisitorLocale(search: string, saved?: unknown): VisitorLocale {
  const params = new URLSearchParams(search);
  return normalizeLocale(params.has('lang') ? params.get('lang') : saved);
}

export function localePath(path: string, locale: VisitorLocale): string {
  const hashAt = path.indexOf('#');
  const hash = hashAt < 0 ? '' : path.slice(hashAt);
  const base = hashAt < 0 ? path : path.slice(0, hashAt);
  const queryAt = base.indexOf('?');
  const pathname = queryAt < 0 ? base : base.slice(0, queryAt);
  const params = new URLSearchParams(queryAt < 0 ? '' : base.slice(queryAt + 1));
  if (locale === 'en') params.set('lang', 'en');
  else params.delete('lang');
  return `${pathname}${params.size ? `?${params}` : ''}${hash}`;
}
