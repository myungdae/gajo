export type PublicActionSet={detail?:{url?:string};reserve?:{url?:string;evidenceMode?:string};call?:{phone?:string;evidenceMode?:string};navigate?:{latitude?:number;longitude?:number;evidenceMode?:'VERIFIED'|'OFFICIAL_PREVIEW'};website?:{url?:string}};

export function safeHttpsUrl(value?:unknown){
  if(typeof value!=='string')return undefined;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname?url.href:undefined}catch{return undefined}
}

export function publicEntityActions(value:unknown):PublicActionSet{
  const source=(value&&typeof value==='object'?value:{})as PublicActionSet,website=safeHttpsUrl(source.website?.url),detail=safeHttpsUrl(source.detail?.url),candidate=safeHttpsUrl(source.reserve?.url),reserve=candidate&&source.reserve?.evidenceMode==='VERIFIED_DIRECT'&&candidate!==website?candidate:undefined,phone=typeof source.call?.phone==='string'&&/^\+?[0-9 ()-]{7,24}$/.test(source.call.phone)?source.call.phone:undefined,latitude=Number(source.navigate?.latitude),longitude=Number(source.navigate?.longitude);
  return{...(detail?{detail:{url:detail}}:{}),...(reserve?{reserve:{url:reserve,evidenceMode:'VERIFIED_DIRECT'}}:{}),...(phone?{call:{phone,...(source.call?.evidenceMode==='VERIFIED_PHONE_BOOKING'?{evidenceMode:'VERIFIED_PHONE_BOOKING'}:{})}}:{}),...(website?{website:{url:website}}:{}),...(Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180?{navigate:{latitude,longitude,...(source.navigate?.evidenceMode?{evidenceMode:source.navigate.evidenceMode}:{})}}:{})};
}

export function isAccommodationEntity(entity:any){return /ACCOMMODATION|LODGING|숙박|펜션|호텔|모텔/.test(`${entity?.entityType||''} ${entity?.category||''} ${entity?.literalProps?.category||''}`)}
export function phoneActionLabel(entity:any,actions:PublicActionSet){return isAccommodationEntity(entity)&&actions.call?.evidenceMode==='VERIFIED_PHONE_BOOKING'?'예약 문의 전화':'전화하기'}
