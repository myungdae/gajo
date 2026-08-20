import type { TripSession } from './tripSession.ts';
import { canonicalEntityId, recommendationItemLabel } from './recommendationItem.ts';
import { navigationDestination, type NavigationDestination } from './utils/placeNavigation.ts';
export type ExecutionStatus='PLANNED'|'READY'|'EN_ROUTE';
export function itinerarySteps(itinerary:unknown):any[]{return Array.isArray((itinerary as any)?.steps)?(itinerary as any).steps:[]}
export function verifiedNavigation(item:any):NavigationDestination|null{const navigate=item?.actions?.navigate;if(!navigate)return null;return navigationDestination({name:recommendationItemLabel(item),lat:navigate.latitude,lng:navigate.longitude})}
export function appendItineraryItem(session:TripSession,item:any){const entityId=canonicalEntityId(item);if(!entityId)return{session,added:false};const steps=itinerarySteps(session.itinerary);if(steps.some(step=>canonicalEntityId(step)===entityId))return{session,added:false};const next={...item,entityId,status:'PLANNED',order:steps.length+1};return{added:true,session:{...session,itinerary:{...((session.itinerary as object)||{}),steps:[...steps,next]}}}}
export function executionState(session:TripSession,entityId:string,status:ExecutionStatus){return{...session,execution:{...session.execution,currentEntityId:entityId,statusByEntityId:{...session.execution?.statusByEntityId,[entityId]:status}}}}
export function currentAndNext(steps:any[],currentEntityId?:string){const active=steps.filter(step=>!['COMPLETED','SKIPPED'].includes(step.status));const found=currentEntityId?active.findIndex(step=>canonicalEntityId(step)===currentEntityId):-1,index=found>=0?found:0;return{current:active[index],next:active[index+1]}}
