import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('Hapcheon manager has a single business form with search, review, publish and existing channels',()=>{
  const ui=source('./components/BusinessRegistrationManager.tsx');
  for(const label of ['등록된 업소 관리','새 업소 등록','업소명 검색','중복 업소 확인','검증 대기로 등록','검수 완료','장소 공개','운영 중지','업소별 이용 통계'])assert.ok(ui.includes(label),label);
  assert.match(ui,/regionId=hapcheon/);assert.match(ui,/lifecycleStatus==='ACTIVE'&&selected.verificationStatus==='VERIFIED'/);
  assert.match(ui,/duplicates===null\|\|duplicates.length>0/);
  assert.doesNotMatch(ui,/type="file"|JSON\.parse|canonicalEntityId.*onChange/);
  assert.match(ui,/<ActionChannelManager/);assert.match(ui,/<VisitorAnalyticsDashboard token=\{token\}/);
});
test('new business form exposes evidence and explicit uncertainty with accessible mobile controls',()=>{
  const ui=source('./components/BusinessRegistrationManager.tsx');
  for(const field of ['englishName','businessType','address','phone','websiteUrl','naverPlaceUrl','kakaoPlaceUrl','latitude','longitude','sourceUrl','verifiedOn','mapConfirmed','phoneConfirmed'])assert.ok(ui.includes(field),field);
  assert.match(ui,/영어 이름 미확인/);assert.match(ui,/미확인 시 길찾기는 비공개/);assert.match(ui,/role="status"/);
  assert.match(source('./components/business-registration.css'),/min-height:44px/);
});
test('channel telemetry covers nonbooking actions without changing approval-based destination handling',()=>{
  const ui=source('./components/VerifiedChannelActions.tsx');
  assert.match(ui,/bookingActionContext/);assert.match(ui,/popup.location.replace\(data.href\)/);
  assert.doesNotMatch(ui,/if\(channel.kind==='DIRECT_BOOKING'\)try/);
  assert.match(source('./components/RecommendationExposure.tsx'),/IntersectionObserver/);
  assert.match(source('./components/RecommendationExposure.tsx'),/PLACE_RECOMMENDATION_SHOWN/);
});
