import type { TripSession } from './tripSession.ts';
import { canonicalEntityId } from './recommendationItem.ts';
export type DiscoveryMemory = { shown: string[]; declined: string[]; lastShownAt?: number; paused?: boolean };
export const discoveryKey = (trip: TripSession) => `exkovia:discovery:${trip.regionId}:${trip.anonymousTripId}`;
const memoryFallback = new Map<string, DiscoveryMemory>();
export function readDiscovery(key: string, storage: Pick<Storage,'getItem'>): DiscoveryMemory {
  try { const m=JSON.parse(storage.getItem(key)||'null'); return m && Array.isArray(m.shown) && Array.isArray(m.declined) ? m : memoryFallback.get(key)||{shown:[],declined:[]}; }
  catch { return memoryFallback.get(key)||{shown:[],declined:[]}; }
}
export function rememberDiscovery(key:string,memory:DiscoveryMemory,storage:Pick<Storage,'setItem'>) {
  memoryFallback.set(key,memory); try { storage.setItem(key,JSON.stringify(memory)); } catch { /* In-memory deduplication remains active. */ }
}
export function canOfferDiscovery(memory:DiscoveryMemory,id:string,now=Date.now(),requested=false) {
  return !memory.shown.includes(id) && !memory.declined.includes(id) &&
    (requested || (!memory.paused && (!memory.lastShownAt || now-memory.lastShownAt>=20*60000)));
}
export function nextTripAction(trip:TripSession) {
  const steps=Array.isArray((trip.itinerary as any)?.steps)?(trip.itinerary as any).steps:[];
  return steps.find((s:any)=>!['COMPLETED','SKIPPED'].includes(trip.execution?.statusByEntityId?.[canonicalEntityId(s)||'']||s.status));
}
