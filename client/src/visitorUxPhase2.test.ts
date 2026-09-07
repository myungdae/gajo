import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journeyPreferences, journeyRequest } from './runtimeJourney.ts';
import { createTripSession, sessionContext, mergeTravelContext } from './tripSession.ts';
import { canOfferDiscovery, nextTripAction, readDiscovery, rememberDiscovery } from './localDiscovery.ts';
import { understandVoice, canAutoExecuteTravelSpeech } from './voice/voiceUx.ts';

test('sufficient broad travel speech proceeds without a destination questionnaire',()=>{
  assert.equal(canAutoExecuteTravelSpeech(understandVoice('부모님과 편하게 둘러보고 저녁 먹고 싶어요.')),true);
  assert.equal(canAutoExecuteTravelSpeech(understandVoice('두 시간밖에 없는데 합천에서 갈 만한 곳을 추천해 주세요.')),true);
  assert.equal(canAutoExecuteTravelSpeech(understandVoice('카페 예약해 줘')),false);
  assert.equal(canAutoExecuteTravelSpeech(understandVoice('음 그게')),false);
});

test('known companions, transport, time and walking survive optional changes',()=>{
  const trip={...createTripSession('hapcheon'),runtimeContext:{companions:[{relationship:'parent'}],transportMode:'CAR',walkingLevel:'LOW',stayUntil:'18:00'}};
  const known=sessionContext(trip),choice=journeyRequest({goal:'CAFE'},'ko');
  assert.deepEqual(journeyPreferences(known,new Date('2026-09-07T06:00:00Z')),{companion:'PARENTS',transport:'CAR',walking:'LOW',goal:undefined,duration:'TWO_THREE_HOURS'});
  const merged=mergeTravelContext(known,choice.context);
  assert.equal(merged.stayUntil,'18:00');assert.equal(merged.transportMode,'CAR');assert.equal(merged.walkingLevel,'LOW');
  assert.equal(merged.companions?.[0].relationship,'parent');
  assert.equal(Object.hasOwn(choice.planned,'transportMode'),false);
});
test('time chips become a real runtime deadline without wrapping into tomorrow',()=>{
  assert.equal(journeyRequest({duration:'ONE_HOUR'},'ko',new Date('2026-09-07T03:00:00Z')).context.stayUntil,'13:00');
  assert.equal(journeyRequest({duration:'DAY'},'ko',new Date('2026-09-07T14:00:00Z')).context.stayUntil,'23:59');
  assert.deepEqual(journeyRequest({companion:'ALONE'},'ko').context.companions,[]);
});
test('shown and rejected offers cannot repeat, including explicit another-experience requests',()=>{
  const memory={shown:['a'],declined:['b'],lastShownAt:1000};
  assert.equal(canOfferDiscovery(memory,'a',9999999,true),false);
  assert.equal(canOfferDiscovery(memory,'b',9999999,true),false);
  assert.equal(canOfferDiscovery(memory,'c',2000),false);
  assert.equal(canOfferDiscovery(memory,'c',2000,true),true);
  assert.equal(canOfferDiscovery({...memory,paused:true},'c',9999999),false);
  const storage={getItem:()=>{throw Error()},setItem:()=>{throw Error()}};
  rememberDiscovery('fixture-trip',memory,storage);
  assert.deepEqual(readDiscovery('fixture-trip',storage),memory);
});
test('NOW points to the first remaining action and never restarts completed places',()=>{
  const trip={...createTripSession('hapcheon'),itinerary:{steps:[{entityId:'a'},{entityId:'b'}]},execution:{statusByEntityId:{a:'COMPLETED' as const,b:'PLANNED' as const}}};
  assert.equal(nextTripAction(trip).entityId,'b');
});
