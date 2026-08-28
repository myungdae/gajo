export const VERIFIED_EXKO_REGION_URLS = Object.freeze({
  hapcheon: 'https://exko.kr/resource/%ED%95%A9%EC%B2%9C%EA%B5%B0',
  geochang: 'https://exko.kr/resource/%EA%B1%B0%EC%B0%BD%EA%B5%B0',
  okcheon: 'https://exko.kr/resource/%EC%98%A5%EC%B2%9C%EA%B5%B0',
} as const);

export const VERIFIED_EXKO_REGION_NAMES = Object.freeze({ hapcheon:'합천', geochang:'거창', okcheon:'옥천' } as const);

export function verifiedExkoRegionUrl(regionId: string): string | undefined {
  return VERIFIED_EXKO_REGION_URLS[regionId as keyof typeof VERIFIED_EXKO_REGION_URLS];
}

export function verifiedExkoRegionName(regionId:string):string|undefined {
  return VERIFIED_EXKO_REGION_NAMES[regionId as keyof typeof VERIFIED_EXKO_REGION_NAMES];
}
