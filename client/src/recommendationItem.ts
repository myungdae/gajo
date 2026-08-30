import{publicEntityActions}from'./entityActionPolicy.ts';
export type OperationalActionKey='detail'|'reserve'|'call'|'website'|'navigate';
export interface RecommendationItem{entityId?:string;entityUri?:string;uri?:string;canonicalEntityUri?:string;programUri?:string;facilityUri?:string;programLabel?:string;facilityLabel?:string;label?:string;name?:string;canonicalLabel?:string;requestedLabel?:string;regionId?:string;entityType?:string;address?:string;telephone?:string;website?:string;reservationUrl?:string;publicInformationUrl?:string;latitude?:number;longitude?:number;actions?:Record<string,unknown>}
export function canonicalEntityId(item:RecommendationItem){const id=item.entityId||item.entityUri||item.uri||item.canonicalEntityUri||item.programUri||item.facilityUri;return id&&id!=='unknown'?id:undefined}
export function recommendationItemLabel(item:RecommendationItem){return item.requestedLabel||item.programLabel||item.facilityLabel||item.canonicalLabel||item.label||item.name||'일정 항목'}
export function isInteractiveRecommendationItem(item:RecommendationItem){return Boolean(canonicalEntityId(item))}
export function navigationActionLabel(item:RecommendationItem){return (item.actions as any)?.navigate?.evidenceMode==='OFFICIAL_PREVIEW'?'길찾기(공식 위치)':'길찾기'}
export function supportedActionKeys(item:RecommendationItem):OperationalActionKey[]{const actions=publicEntityActions(item.actions);return(['detail','reserve','call','website','navigate']as OperationalActionKey[]).filter(key=>Boolean(actions[key]))}
export function itemBelongsToRegion(item:RecommendationItem,regionId:string){const id=canonicalEntityId(item);return !id||regionId==='gajo'?!id||id.includes('gajo-wellness'):id.includes(`${regionId}.example`)||item.regionId===regionId}
