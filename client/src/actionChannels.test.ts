import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHANNEL_LABELS, channelLabel, channelQuery } from './actionChannels.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const ui=read('./components/VerifiedChannelActions.tsx'),manager=read('./components/ActionChannelManager.tsx');
test('all public kinds have bilingual labels and scope is URL encoded',()=>{
  for(const kind of Object.keys(CHANNEL_LABELS.ko) as Array<keyof typeof CHANNEL_LABELS.ko>)assert.ok(CHANNEL_LABELS.en[kind]);
  assert.equal(CHANNEL_LABELS.ko.DIRECT_BOOKING,'실시간 예약하기');
  const params=new URLSearchParams(channelQuery('hapcheon','https://hapcheon.example/#place'));
  assert.equal(params.get('placeKey'),'https://hapcheon.example/#place');
  assert.equal(channelLabel({labelKo:'전화하기',labelEn:'Call'} as any,'en'),'Call');
});
test('visitor cannot navigate from a raw booking URL and preserves other entity actions',()=>{
  const entity=read('./components/EntityActions.tsx');
  assert.match(entity,/VerifiedChannelActions/);assert.doesNotMatch(entity,/href=\{actions.reserve.url\}/);
  for(const preserved of ['PHONE_HANDOFF','WEBSITE_HANDOFF','launchNavigation','addEntityToRegionalItinerary'])assert.ok(entity.includes(preserved));
  assert.match(ui,/pending.current\)return/);assert.match(ui,/previous.event:bookingActionContext/);
  assert.match(ui,/\/outbound/);assert.match(ui,/popup.location.replace\(data.href\)/);
  assert.match(ui,/popup.opener=null/);assert.match(ui,/Analytics storage failure must not block/);
});
test('RDM uses existing place with authenticated headers and explicit review then publication',()=>{
  assert.match(read('./components/RegionalDataManager.tsx'),/placeKey=\{selected.canonicalEntityId\}/);
  assert.match(manager,/'x-admin-token':token/);assert.match(manager,/confirmed/);
  for(const action of ['CREATE','EDIT','VERIFY','PUBLISH','SUSPEND'])assert.ok(manager.includes(action));
  assert.match(manager,/row.verificationStatus!=='VERIFIED'/);assert.match(manager,/관광객 화면 미리보기/);
  assert.match(manager,/rel="noopener noreferrer"/);assert.match(manager,/검수·공개 감사 이력/);
  assert.doesNotMatch(manager,/token=|BOOKING_CONFIRMED/);
});
test('Golden Scenario contains only provided business channels and no generic reservation root',()=>{
  const golden=JSON.parse(read('../../docs/receipt47-2b/smile-channels.json'));
  assert.equal(golden.placeKey,'hapcheon-lake-smile-pension');
  const bookings=golden.channels.filter((c:any)=>c.kind==='DIRECT_BOOKING');
  assert.equal(bookings.length,1);assert.equal(bookings[0].target,'https://rev.yapen.co.kr/external?ypIdx=24507');
  assert.equal(bookings[0].sourceUrl,'https://www.lakesmile.com/');
  assert.ok(golden.channels.every((c:any)=>!c.target.includes('naver')));
  assert.doesNotMatch(read('../../server/src/regions/hapcheon/master-data.ts'),/reservationUrl:'https:\/\/rev.yapen.co.kr\/'/);
});
test('public UI supplies accessible bilingual errors, flexible controls and unsupported completion copy',()=>{
  assert.match(ui,/aria-busy=\{busy\}/);assert.match(ui,/role="status"/);assert.match(ui,/type="button"/);
  assert.match(read('./components/action-channels.css'),/min-height: 44px/);
  assert.match(read('./components/action-channels.css'),/flex-wrap: wrap/);
  const dashboard=read('./components/VisitorAnalyticsDashboard.tsx');
  for(const copy of ['예약 버튼 선택','예약 페이지 이동','예약 완료 측정 미지원'])assert.ok(dashboard.includes(copy));
});
