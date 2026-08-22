import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTripSession, loadTripSession, saveTripSession, updateTripRuntimeContext } from './tripSession.ts';
import { regionFromLocation } from './regionRouting.ts';

const memory = () => { const data = new Map<string,string>(); return { data, getItem:(key:string)=>data.get(key)||null, setItem:(key:string,value:string)=>data.set(key,value) }; };

test('simultaneous Hapcheon Gajo and Okcheon sessions remain byte-isolated', () => {
  const storage=memory(),regions=['hapcheon','gajo','okcheon'];
  for(const regionId of regions)saveTripSession({...createTripSession(regionId),savedPlaces:[{entityId:`${regionId}:saved`}],itinerary:{steps:[{entityId:`${regionId}:step`}]},execution:{currentEntityId:`${regionId}:step`}},storage as any);
  const before=Object.fromEntries(regions.map(regionId=>[regionId,storage.data.get(`regional-concierge-trip-session-v1:${regionId}`)]));
  updateTripRuntimeContext('okcheon',{regionId:'okcheon',locality:'옥천읍'},storage as any);
  assert.equal(storage.data.get('regional-concierge-trip-session-v1:hapcheon'),before.hapcheon);
  assert.equal(storage.data.get('regional-concierge-trip-session-v1:gajo'),before.gajo);
  assert.equal(loadTripSession(storage as any,'okcheon')?.runtimeContext.locality,'옥천읍');
});

test('storage and PWA implementations have no implicit regional fallback or broad clear',()=>{
  const trip=readFileSync(new URL('./tripSession.ts',import.meta.url),'utf8'),visitorUpdate=readFileSync(new URL('./visitorPwa.ts',import.meta.url),'utf8');
  assert.doesNotMatch(trip,/regionId\s*=\s*["']gajo["']/);
  assert.doesNotMatch(`${trip}\n${visitorUpdate}`,/localStorage\.clear|sessionStorage\.clear/);
});

test('same-origin path reloads read only their own Hapcheon Gajo and Okcheon keys',()=>{const storage=memory(),regions=['hapcheon','gajo','okcheon'] as const;for(const regionId of regions)saveTripSession({...createTripSession(regionId),savedPlaces:[{entityId:`${regionId}:saved`}]},storage as any);const before=new Map(storage.data);for(const regionId of regions){const resolved=regionFromLocation(`/${regionId}`,'','gajo.odex.kr');assert.equal(resolved,regionId);assert.equal(loadTripSession(storage as any,resolved)?.savedPlaces?.[0].entityId,`${regionId}:saved`);for(const other of regions)assert.equal(storage.data.get(`regional-concierge-trip-session-v1:${other}`),before.get(`regional-concierge-trip-session-v1:${other}`))}});
