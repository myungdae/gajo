import test from 'node:test';
import assert from 'node:assert/strict';
import { captureExplicitJourney, explicitJourneyPayload } from './explicitJourneyContext.ts';

const destinations = [
  { entityId:'https://gajo-wellness.kr/semantic#gajoHotSpringArea', label:'가조온천', requestedLabel:'가조온천', resolved:false, requested:true, source:'SEMANTIC' as const, entityType:'PLACE_CONCEPT' },
  { entityId:'https://gajo-wellness.kr/ontology#suseungdae', label:'수승대', requestedLabel:'수승대', resolved:false, requested:true, source:'SEMANTIC' as const },
];

test('real two-turn journey keeps the rendered and transmitted destination constraint',()=>{
  const turn1:any={intentRoute:'JOURNEY_PLAN',requestedDestinations:destinations,recommendation:{itinerary:{steps:destinations.map(x=>({programLabel:x.label,requestedLabel:x.requestedLabel,actions:{}}))}}};
  const journey=captureExplicitJourney(turn1,'turn-1');
  assert.deepEqual(turn1.recommendation.itinerary.steps.map((x:any)=>x.requestedLabel),['가조온천','수승대']);
  const payload=explicitJourneyPayload(journey);
  assert.deepEqual(payload.mustVisitPlaces,destinations);
  assert.deepEqual(payload.explicitJourney,{requestedDestinations:destinations,multiDestination:true,sourceTurnId:'turn-1'});
  const turn2:any={intentRoute:'REPLAN',requestedDestinations:payload.explicitJourney!.requestedDestinations,recommendation:{itinerary:{steps:payload.mustVisitPlaces!.map(x=>({programLabel:x.label,requestedLabel:x.requestedLabel,actions:{}}))}},visitorMessage:'현재는 두 장소의 검증된 위치정보가 충분하지 않아 정확한 거리순 계산은 어렵습니다.'};
  assert.deepEqual(turn2.recommendation.itinerary.steps.map((x:any)=>x.requestedLabel||x.programLabel),['가조온천','수승대']);
  assert.doesNotMatch(JSON.stringify(turn2),/거창 항노화힐링랜드|백두산천지온천|다온 카페|관광과 체험을 둘러본 뒤/);
});
