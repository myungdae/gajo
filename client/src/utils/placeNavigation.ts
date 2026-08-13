export type NavigationProvider='kakao'|'naver'|'tmap';
export interface NavigationDestination{name:string;latitude:number;longitude:number}
export interface NavigationOrigin{latitude:number;longitude:number}
export interface NavigationTarget{provider:NavigationProvider;native:string;fallback:string;fallbackKind:'web-navigation'|'web-destination'|'provider-home'}

const PLACEHOLDER_COORDINATES=[[0,0]] as const;
const coordinate=(value:number,min:number,max:number)=>Number.isFinite(value)&&value>=min&&value<=max;

export function navigationDestination(place:{name?:string;canonicalLabel?:string;lat?:number;lng?:number}):NavigationDestination|null{
  const name=String(place.canonicalLabel||place.name||'').trim(); const latitude=Number(place.lat),longitude=Number(place.lng);
  if(!name||!coordinate(latitude,-90,90)||!coordinate(longitude,-180,180))return null;
  if(PLACEHOLDER_COORDINATES.some(([lat,lng])=>latitude===lat&&longitude===lng))return null;
  return{name,latitude,longitude};
}

export function navigationTarget(provider:NavigationProvider,destination:NavigationDestination,origin?:NavigationOrigin|null):NavigationTarget{
  const name=encodeURIComponent(destination.name),lat=destination.latitude,lng=destination.longitude;
  if(provider==='kakao'){const start=origin?`sp=${origin.latitude},${origin.longitude}&`:'';const fallback=origin?`https://map.kakao.com/link/from/${encodeURIComponent('현재 위치')},${origin.latitude},${origin.longitude}/to/${name},${lat},${lng}`:`https://map.kakao.com/link/to/${name},${lat},${lng}`;return{provider,native:`kakaomap://route?${start}ep=${lat},${lng}&epName=${name}&by=car`,fallback,fallbackKind:'web-navigation'}}
  if(provider==='naver'){const appName=typeof location==='undefined'?'https://gajo.local':location.origin;const start=origin?`&slat=${origin.latitude}&slng=${origin.longitude}&sname=${encodeURIComponent('현재 위치')}`:'';return{provider,native:`nmap://navigation?dlat=${lat}&dlng=${lng}&dname=${name}${start}&appname=${encodeURIComponent(appName)}`,fallback:`https://map.naver.com/p/directions/-/${name},${lng},${lat},PLACE_POI/-/car?c=${lng},${lat},15,0,0,0,dh`,fallbackKind:'web-navigation'}}
  return{provider,native:`tmap://route?rGoName=${name}&rGoX=${lng}&rGoY=${lat}`,fallback:'https://www.tmap.co.kr/',fallbackKind:'provider-home'};
}

export function isMobileNavigation(userAgent:string){return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)}

export function launchNavigation(target:NavigationTarget,environment:{mobile?:boolean;open?:(url:string)=>void;assign?:(url:string)=>void;visible?:()=>boolean;defer?:(callback:()=>void,delay:number)=>unknown}={}):void{
  const open=environment.open||(url=>window.open(url,'_blank','noopener,noreferrer'));
  if(!environment.mobile){open(target.fallback);return}
  const assign=environment.assign||(url=>window.location.assign(url)); const visible=environment.visible||(()=>document.visibilityState==='visible'); const defer=environment.defer||setTimeout;
  assign(target.native); defer(()=>{if(visible())assign(target.fallback)},1200);
}
