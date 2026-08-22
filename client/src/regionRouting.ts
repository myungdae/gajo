import type{RegionId}from'./regionConfig.ts';
const REGION_IDS:readonly RegionId[]=['gajo','okcheon','muan','gyeryong','hapcheon','daejeon-junggu'];
const HOST_REGIONS:Readonly<Record<string,RegionId>>={'gajo.odex.kr':'gajo','okcheon.odex.kr':'okcheon','muan.odex.kr':'muan','gyeryong.odex.kr':'gyeryong','hapcheon.odex.kr':'hapcheon','daejeon-junggu.odex.kr':'daejeon-junggu'};
const isRegionId=(value:string|null|undefined):value is RegionId=>Boolean(value&&REGION_IDS.includes(value as RegionId));
export function regionFromLocation(pathname:string,search:string,hostname=''):RegionId{const segment=pathname.split('/').filter(Boolean)[0];if(isRegionId(segment))return segment;const query=new URLSearchParams(search).get('region');if(isRegionId(query))return query;return HOST_REGIONS[hostname.toLowerCase()]||'gajo'}
export function regionalPath(path:string,regionId:RegionId,explicitGajo=false){if(regionId!=='gajo')return`/${regionId}${path}`;if(explicitGajo)return`/gajo${path}`;return path}
