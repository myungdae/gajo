export type VerifiedExkoRegionalResource = {
  label: string;
  href: string;
  relation: 'CURRENT' | 'HISTORICAL_STABLE';
};

const resource = (label:string, href:string, relation:VerifiedExkoRegionalResource['relation']='CURRENT'):VerifiedExkoRegionalResource => ({label,href,relation});

export const VERIFIED_EXKO_SUBREGION_RESOURCES: Readonly<Record<string, VerifiedExkoRegionalResource>> = Object.freeze({
  'seoul:중구':resource('중구(서울특별시)','https://exko.kr/resource/%EC%A4%91%EA%B5%AC%28%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C%29'),
  'busan:중구':resource('중구(부산광역시)','https://exko.kr/resource/%EC%A4%91%EA%B5%AC%28%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'daegu:중구':resource('중구(대구광역시)','https://exko.kr/resource/%EC%A4%91%EA%B5%AC%28%EB%8C%80%EA%B5%AC%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'daejeon:중구':resource('중구(대전광역시)','https://exko.kr/resource/%EC%A4%91%EA%B5%AC%28%EB%8C%80%EC%A0%84%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'ulsan:중구':resource('중구(울산광역시)','https://exko.kr/resource/%EC%A4%91%EA%B5%AC%28%EC%9A%B8%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'seoul:강서구':resource('강서구','https://exko.kr/resource/%EA%B0%95%EC%84%9C%EA%B5%AC'),
  'busan:강서구':resource('강서구(부산광역시)','https://exko.kr/resource/%EA%B0%95%EC%84%9C%EA%B5%AC%28%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'busan:서구':resource('서구(부산광역시)','https://exko.kr/resource/%EC%84%9C%EA%B5%AC%28%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'daegu:서구':resource('서구(대구광역시)','https://exko.kr/resource/%EC%84%9C%EA%B5%AC%28%EB%8C%80%EA%B5%AC%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'daejeon:서구':resource('서구(대전광역시)','https://exko.kr/resource/%EC%84%9C%EA%B5%AC%28%EB%8C%80%EC%A0%84%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'gwangju-jeonnam:서구':resource('서구(광주광역시)','https://exko.kr/resource/%EC%84%9C%EA%B5%AC%28%EA%B4%91%EC%A3%BC%EA%B4%91%EC%97%AD%EC%8B%9C%29','HISTORICAL_STABLE'),
  'busan:동구':resource('동구(부산광역시)','https://exko.kr/resource/%EB%8F%99%EA%B5%AC%28%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'daegu:동구':resource('동구(대구광역시)','https://exko.kr/resource/%EB%8F%99%EA%B5%AC%28%EB%8C%80%EA%B5%AC%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'daejeon:동구':resource('동구(대전광역시)','https://exko.kr/resource/%EB%8F%99%EA%B5%AC%28%EB%8C%80%EC%A0%84%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'ulsan:동구':resource('동구(울산광역시)','https://exko.kr/resource/%EB%8F%99%EA%B5%AC%28%EC%9A%B8%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'gwangju-jeonnam:동구':resource('동구(광주광역시)','https://exko.kr/resource/%EB%8F%99%EA%B5%AC%28%EA%B4%91%EC%A3%BC%EA%B4%91%EC%97%AD%EC%8B%9C%29','HISTORICAL_STABLE'),
  'busan:남구':resource('남구(부산광역시)','https://exko.kr/resource/%EB%82%A8%EA%B5%AC%28%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'daegu:남구':resource('남구(대구광역시)','https://exko.kr/resource/%EB%82%A8%EA%B5%AC%28%EB%8C%80%EA%B5%AC%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'ulsan:남구':resource('남구(울산광역시)','https://exko.kr/resource/%EB%82%A8%EA%B5%AC%28%EC%9A%B8%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'gwangju-jeonnam:남구':resource('남구(광주광역시)','https://exko.kr/resource/%EB%82%A8%EA%B5%AC%28%EA%B4%91%EC%A3%BC%EA%B4%91%EC%97%AD%EC%8B%9C%29','HISTORICAL_STABLE'),
  'busan:북구':resource('북구(부산광역시)','https://exko.kr/resource/%EB%B6%81%EA%B5%AC%28%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'daegu:북구':resource('북구(대구광역시)','https://exko.kr/resource/%EB%B6%81%EA%B5%AC%28%EB%8C%80%EA%B5%AC%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'ulsan:북구':resource('북구(울산광역시)','https://exko.kr/resource/%EB%B6%81%EA%B5%AC%28%EC%9A%B8%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C%29'),
  'gwangju-jeonnam:북구':resource('북구(광주광역시)','https://exko.kr/resource/%EB%B6%81%EA%B5%AC%28%EA%B4%91%EC%A3%BC%EA%B4%91%EC%97%AD%EC%8B%9C%29','HISTORICAL_STABLE'),
  'gangwon:고성군':resource('고성군(강원)','https://exko.kr/resource/%EA%B3%A0%EC%84%B1%EA%B5%B0%28%EA%B0%95%EC%9B%90%29','HISTORICAL_STABLE'),
  'gyeongnam:고성군':resource('고성군(경남)','https://exko.kr/resource/%EA%B3%A0%EC%84%B1%EA%B5%B0%28%EA%B2%BD%EB%82%A8%29','HISTORICAL_STABLE'),
});

export const verifiedExkoSubregionResource = (parentId:string,name:string) => VERIFIED_EXKO_SUBREGION_RESOURCES[`${parentId}:${name}`];
