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
test('Kakao remains optional and isolated behind readiness state',()=>{const source=readFileSync(new URL('./components/CompanionShare.tsx',import.meta.url),'utf8');assert.match(source,/VITE_KAKAO_JAVASCRIPT_KEY/);assert.match(source,/disabled=\{kakaoState!==['"]READY['"]\}/);assert.match(source,/카카오톡 공유 설정 전입니다/);assert.match(source,/script\.onerror/);assert.match(source,/initializeKakaoShare/);assert.match(source,/fallbackRegionalShare/);assert.match(source,/동행자가 QR을 찍으면 바로 시작/)});
