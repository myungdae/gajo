import assert from 'node:assert/strict';
import test from 'node:test';
import { isFoodCategory, isLodgingCategory, nearbyGroupFor, nearbyUiCategory, NEARBY_GROUPS } from './nearbyTaxonomy.ts';
import { createTripSession, rememberTripAccommodation } from './tripSession.ts';
import { readFileSync } from 'node:fs';

test('nearby taxonomy exposes four approved groups without colored emoji',()=>{
  assert.deepEqual(NEARBY_GROUPS.map(group=>group.label),['관광·체험','음식','숙소','생활편의']);
  assert.deepEqual(NEARBY_GROUPS.find(group=>group.id==='LODGING')?.options.map(option=>option.label),['전체 숙소','호텔·리조트','펜션·민박','캠핑·글램핑','모텔','게스트하우스']);
  assert.equal(NEARBY_GROUPS.some(group=>/\p{Extended_Pictographic}/u.test(JSON.stringify(group))),false);
});

test('saving a lodging reuses the regional trip accommodation memory',()=>{
  const session=createTripSession('hapcheon',new Date('2026-08-29T00:00:00Z'));
  const updated=rememberTripAccommodation(session,{entityId:'provider:123',label:'주변 숙소',resolved:false,regionId:'hapcheon'});
  assert.equal(updated.id,session.id);
  assert.equal(updated.regionId,'hapcheon');
  assert.equal(updated.plannedContext?.accommodationIntents?.[0].entityId,'provider:123');
});

test('legacy route categories map compatibly without changing provider ids',()=>{
  assert.equal(nearbyUiCategory('CAFE'),'CAFE_BAKERY');
  assert.equal(nearbyUiCategory('TOURISM_NATURE'),'TOURIST_ATTRACTION');
  assert.equal(nearbyGroupFor('LODGING_CAMPING_GLAMPING').id,'LODGING');
  assert.equal(isLodgingCategory('LODGING_PENSION_MINBAK'),true);
  assert.equal(isFoodCategory('FOOD_JAPANESE'),true);
});

test('nearby dead ends and selected places can call the assistant with context',()=>{
  const page=readFileSync(new URL('./pages/NearbyRestaurantsPage.tsx',import.meta.url),'utf8');
  assert.match(page,/AI 여행도우미에게 다음 행동 묻기/);
  assert.match(page,/AI 여행도우미에게 다른 선택 요청/);
  assert.match(page,/selected\.name[\s\S]*autoSubmit:true/);
  assert.match(page,/localizedRegionalPath\('\/concierge\?mode=now',region\.id\)/);
});
