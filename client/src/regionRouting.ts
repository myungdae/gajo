import type{RegionId}from'./regionConfig.ts';
const REGION_IDS:readonly RegionId[]=['gajo','okcheon','muan','gyeryong','hapcheon','daejeon-junggu'];
const HOST_REGIONS:Readonly<Record<string,RegionId>>={'gajo.odex.kr':'gajo','okcheon.odex.kr':'okcheon','muan.odex.kr':'muan','gyeryong.odex.kr':'gyeryong','hapcheon.odex.kr':'hapcheon','daejeon-junggu.odex.kr':'daejeon-junggu'};
export const isExkoviaHost=(hostname:string)=>{const host=hostname.toLowerCase().split(':')[0];return host==='exkovia.com'||host.endsWith('.exkovia.com')};
export const isPlatformPreview=(hostname:string,search='')=>isExkoviaHost(hostname)||new URLSearchParams(search).get('platform')==='exkovia';
const isRegionId=(value:string|null|undefined):value is RegionId=>Boolean(value&&REGION_IDS.includes(value as RegionId));
const normalizeHost=(hostname:string)=>hostname.toLowerCase().split(':')[0];
const isLocalDevelopmentHost=(hostname:string)=>['','localhost','127.0.0.1','127.0.0.2','::1'].includes(normalizeHost(hostname));
export function regionFromLocation(pathname:string,search:string,hostname=''):RegionId|undefined{const segment=pathname.split('/').filter(Boolean)[0];if(isRegionId(segment))return segment;const query=new URLSearchParams(search).get('region');if(isRegionId(query))return query;const host=normalizeHost(hostname);return HOST_REGIONS[host]||(isLocalDevelopmentHost(host)?'gajo':undefined)}
export function appSurface(pathname:string,search:string,hostname:string):'PLATFORM'|'REGION'|'PUBLIC_PARTNER'|'UNSUPPORTED'{if(isPlatformPreview(hostname,search)&&['/','/regions','/partner/apply','/partner/console','/region/apply'].includes(pathname))return'PLATFORM';if(pathname.startsWith('/go/')||pathname.startsWith('/visit/'))return'PUBLIC_PARTNER';return regionFromLocation(pathname,search,hostname)?'REGION':'UNSUPPORTED'}
export const shouldRegisterVisitorPwa=(pathname:string,search:string,hostname:string)=>appSurface(pathname,search,hostname)==='REGION';
export function regionalPath(path:string,regionId:RegionId,explicitGajo=false){if(regionId!=='gajo')return`/${regionId}${path}`;if(explicitGajo)return`/gajo${path}`;return path}
