import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { verifiedExkoRegionUrl, VERIFIED_EXKO_REGION_URLS } from './exkoLinks.ts';

const component=readFileSync(new URL('./components/ExkoRegionKnowledgeLink.tsx',import.meta.url),'utf8');
const home=readFileSync(new URL('./pages/HomePage.tsx',import.meta.url),'utf8');
const nearby=readFileSync(new URL('./pages/NearbyRestaurantsPage.tsx',import.meta.url),'utf8');

test('only the three verified regions resolve fixed EXKO resources',()=>{
  assert.deepEqual(Object.keys(VERIFIED_EXKO_REGION_URLS),['hapcheon','geochang','okcheon']);
  assert.equal(verifiedExkoRegionUrl('hapcheon'),'https://exko.kr/resource/%ED%95%A9%EC%B2%9C%EA%B5%B0');
  assert.equal(verifiedExkoRegionUrl('geochang'),'https://exko.kr/resource/%EA%B1%B0%EC%B0%BD%EA%B5%B0');
  assert.equal(verifiedExkoRegionUrl('okcheon'),'https://exko.kr/resource/%EC%98%A5%EC%B2%9C%EA%B5%B0');
  for(const regionId of ['gajo','unknown','HAPCHEON','hapcheon/nearby','hapcheon?x=1','../hapcheon','https://evil.example'])assert.equal(verifiedExkoRegionUrl(regionId),undefined);
});

test('verified URL contains no visitor location query or trip identity',()=>{
  for(const url of Object.values(VERIFIED_EXKO_REGION_URLS)){
    assert.equal(new URL(url).search,'');
    for(const sensitive of ['lat','lng','latitude','longitude','tripSession','anonymousTripId','query','search'])assert.doesNotMatch(url,new RegExp(sensitive,'i'));
  }
});

test('Portal keeps regional AI primary actions separate from verified EXKO links',()=>{
  const portal=readFileSync(new URL('./pages/PlatformPortalPage.tsx',import.meta.url),'utf8');
  for(const [name,id,to] of [['합천 AI','hapcheon','/hapcheon'],['거창 AI','geochang','https://gajo.odex.kr/'],['옥천 AI','okcheon','/okcheon']]){
    assert.match(portal,new RegExp(`name: '${name}'[^\\n]*to: '${to.replaceAll('/','\\/')}'[^\\n]*exkoRegionId:'${id}'`));
  }
  assert.doesNotMatch(portal,/지역 AI 여행안내: 준비 중/);
  assert.match(portal,/className="platform-region-primary"/);
  assert.equal((portal.match(/compact\/>/g)||[]).length,1);
  assert.match(component,/외부 지역지식 서비스/);
  assert.match(component,/EXKO에서 \{name\}군 지역지식 보기/);
});

test('Hapcheon home and nearby use one safe passive external-link component',()=>{
  assert.match(home,/ExkoRegionKnowledgeLink regionId=\{region\.id\}/);
  assert.match(nearby,/ExkoRegionKnowledgeLink regionId=\{region\.id\}/);
  assert.match(component,/target="_blank"/);
  assert.match(component,/rel="noopener noreferrer"/);
  assert.doesNotMatch(component,/ensureTripSession|createTripSession|saveTripSession|localStorage|sessionStorage/);
  assert.doesNotMatch(home,/exko\.kr\/resource/);
  assert.doesNotMatch(nearby,/exko\.kr\/resource/);
});

test('render lookup is a pure read and cannot create or change TripSession storage',()=>{
  const storage=new Map([['regional-concierge-trip-session-v1:hapcheon','existing-session']]);
  const before=[...storage.entries()];
  assert.ok(verifiedExkoRegionUrl('hapcheon'));
  assert.deepEqual([...storage.entries()],before);
});
