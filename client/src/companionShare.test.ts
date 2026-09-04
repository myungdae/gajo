import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companionSharePayload, fallbackRegionalShare, initializeKakaoShare } from './shareConfig.ts';
import { HAPCHEON_CONFIG } from './regionConfig.ts';

test('regional entry sharing contains only the official regional URL and no trip state',()=>{
  const payload=companionSharePayload(HAPCHEON_CONFIG);
  assert.deepEqual(payload,{kind:'REGIONAL_ENTRY',url:'https://exkovia.com/hapcheon',title:'합천 여행, 같이 해요!',description:'함께 여행하며 필요한 곳을 찾고 일정을 만들어 보세요.',buttonLabel:'합천 여행도우미 시작하기',image:'https://exkovia.com/branding/hapcheon-ai-autumn-social-1200x630-v3.png'});
  assert.doesNotMatch(JSON.stringify(payload),/TripSession|anonymousTripId|latitude|longitude|savedPlaces|itinerary/);
});
test('future trip invites fail closed until an opaque expiring token flow exists',()=>assert.throws(()=>companionSharePayload(HAPCHEON_CONFIG,'TRIP_INVITE'),/opaque, expiring invite token/));
test('uses Web Share when available',async()=>{let shared:any,copied='';const result=await fallbackRegionalShare(companionSharePayload(HAPCHEON_CONFIG),{share:async value=>{shared=value},clipboard:{writeText:async value=>{copied=value}}}as any);assert.equal(result,'SHARED');assert.equal(shared.url,'https://exkovia.com/hapcheon');assert.equal(copied,'')});
test('copies the official URL when Web Share is unavailable',async()=>{let copied='';const result=await fallbackRegionalShare(companionSharePayload(HAPCHEON_CONFIG),{clipboard:{writeText:async value=>{copied=value}}}as any);assert.equal(result,'COPIED');assert.equal(copied,'https://exkovia.com/hapcheon')});
test('a rejected Web Share safely falls back to copy',async()=>{let copied='';const result=await fallbackRegionalShare(companionSharePayload(HAPCHEON_CONFIG),{share:async()=>{throw new Error('not allowed')},clipboard:{writeText:async value=>{copied=value}}}as any);assert.equal(result,'COPIED');assert.equal(copied,'https://exkovia.com/hapcheon')});
test('Kakao initialization failure is contained',()=>{const kakao={isInitialized:()=>false,init:()=>{throw new Error('invalid domain')},Share:{}};assert.equal(initializeKakaoShare(kakao,'public-key'),false)});
test('Kakao sharing exists only on the landing and remains optional behind readiness state',()=>{const landingShare=readFileSync(new URL('./components/RegionalLandingShare.tsx',import.meta.url),'utf8'),layout=readFileSync(new URL('./components/Layout.tsx',import.meta.url),'utf8');assert.match(landingShare,/VITE_KAKAO_JAVASCRIPT_KEY/);assert.match(landingShare,/\(kakaoKey\|\|posterOverlay\)&&<button/);assert.match(landingShare,/disabled=\{!kakaoKey\|\|kakaoState!==['"]READY['"]\}/);assert.match(landingShare,/Kakao\.Share\.sendDefault/);assert.match(landingShare,/script\.onerror/);assert.match(landingShare,/initializeKakaoShare/);assert.match(landingShare,/entry-qr/);assert.doesNotMatch(layout,/CompanionShare|동행자 초대|공유 모달/)});
test('Hapcheon opens the regional home directly without a landing completion flag',()=>{const app=readFileSync(new URL('./App.tsx',import.meta.url),'utf8'),layout=readFileSync(new URL('./components/Layout.tsx',import.meta.url),'utf8');assert.match(app,/path="\/hapcheon" element=\{<HomePage \/>\}/);assert.doesNotMatch(app,/hapcheon-landing-complete|HapcheonEntry/);assert.doesNotMatch(layout,/hapcheon-landing-complete|\/hapcheon\?start=ai/)});
