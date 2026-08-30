import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const home=source('./pages/HomePage.tsx'),partner=source('./pages/PartnerApplicationPage.tsx'),adoption=source('./pages/RegionAdoptionPage.tsx');

test('traveler identity uses the canonical region display name and existing action routes',()=>{
  assert.match(home,/\{region\.regionName\}에 오셨나요\?/);
  assert.doesNotMatch(home,/pathname.*오셨나요|split\([^)]*pathname/);
  for(const label of['지금 밥 먹고 싶어요','잠깐 쉬고 싶어요','주변을 찾고 싶어요','다음 갈 곳 추천','숙소 찾기'])assert.match(home,new RegExp(label));
  assert.match(home,/findNearby\('FOOD'\)/);
  assert.match(home,/findNearby\('TOURIST_ATTRACTION'\)/);
  assert.match(home,/findNearby\('LODGING'\)/);
  assert.match(home,/\/concierge\?mode=now/);
  assert.doesNotMatch(home,/geolocation|getCurrentPosition|watchPosition/);
});

test('partner pilot example is visibly synthetic and preserves the aggregated trust boundary',()=>{
  for(const copy of['AI 관광 파트너로 참여하세요','화면 구성 예시 · 가상 데이터','실제 합천 운영 데이터가 아닙니다','숙박 A','음식점 B','카페 C','관광·체험 D','최소 5개의 서로 다른 익명 흐름','기준 미달 항목 suppression','인증된 관리 범위'])assert.match(partner,new RegExp(copy));
  for(const forbidden of['방문자 수','순 방문자','실제 도착','GPS 확인 방문','매출 기여','개인 이동경로'])assert.doesNotMatch(partner,new RegExp(forbidden));
  assert.doesNotMatch(partner,/track\(|analytics|application\/ld\+json|og:/);
});

test('municipality consultation stays informational until a real form exists',()=>{
  for(const copy of['우리 지역 AI 도입 상담','왜 지자체가 참여해야 하나요?','공공 주차장 위치','공중화장실 위치','장애인·교통약자를 위한 편의시설','전기차·수소차 충전소','대중교통과 안전·응급 정보','출처·기준 시각·검증 상태','온라인 상담 신청 기능은 준비 중입니다.','합천 실제 서비스 체험하기'])assert.match(adoption,new RegExp(copy.replace(/[?]/g,'\\?')));
  assert.doesNotMatch(adoption,/개인정보·상담 동의|<form|disabled/);
});
