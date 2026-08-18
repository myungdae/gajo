import type { LiveRuntimeResponse } from './api/client.ts';
export function runtimeContextForRegion<T extends {regionId?:string}|undefined|null>(context:T,regionId:string):T|undefined{return context?.regionId===regionId?context:undefined}
export function liveRuntimeForRegion(live:LiveRuntimeResponse|undefined|null,regionId:string):LiveRuntimeResponse|undefined{if(!live||live.metadata?.regionId!==regionId||live.context?.regionId!==regionId)return undefined;const observationRegion=live.context?.weatherObservation?.regionId;if(observationRegion&&observationRegion!==regionId)return undefined;return live}
export const regionalRuntimeStatusLabel=(regionName:string)=>`지금 ${regionName}`;
