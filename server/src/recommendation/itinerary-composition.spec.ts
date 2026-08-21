import { composeItinerary, itineraryRole } from './itinerary-composition';
import type { DecisionCandidate } from './decision-pipeline.service';

const candidate=(name:string,entityType:string,extra:Partial<DecisionCandidate>={}):DecisionCandidate=>({programUri:`urn:${name}`,programLabel:name,facilityUri:`urn:${name}`,matchedOn:[],matchedLabels:[],mitigatesRisk:[],mitigationLabels:[],requiredMobility:[],affectedByEnvironment:[],requiresReservation:false,entityType,score:10,...extra});
const context=(extra:any={})=>({environmentConditions:[],expandedConditions:[],selectedInterests:['TOURISM_NATURE','FOOD','CAFE','ACCOMMODATION'],duration:'1N2D',...extra});

describe('shared itinerary composition',()=>{
  const anchor=candidate('호수','ATTRACTION',{isMustVisit:true,tags:['TOURISM_NATURE'],actions:{detail:{url:'https://example.test'}}});
  const activity=candidate('체험','EXPERIENCE',{tags:['TOURISM_NATURE','ACTIVITY']});
  const meal=candidate('식당','RESTAURANT',{category:'FOOD',tags:['FOOD']});
  const cafe=candidate('카페','CAFE',{tags:['CAFE']});
  const stay=candidate('숙소','ACCOMMODATION',{tags:['ACCOMMODATION'],actions:{reserve:{url:'https://book.test'},navigate:{latitude:35,longitude:128}}});
  const ranked=[anchor,stay,cafe,activity,meal];

  it('separates relevance order from diverse temporal composition and preserves actions',()=>{const result=composeItinerary(ranked,context());expect(result.items.map(x=>x.programLabel)).toEqual(['호수','체험','식당','카페','숙소']);expect(result.items[0].itineraryRole).toBe('ANCHOR');expect(result.items.at(-1)).toMatchObject({itineraryRole:'ACCOMMODATION',actions:stay.actions});expect(result.coverage.uncovered).toEqual([])});
  it('lets explicit accommodation-first input override the overnight default',()=>{expect(composeItinerary(ranked,context({rawMessage:'많이 피곤해서 펜션으로 먼저 가고 싶어요.'})).items[0].programLabel).toBe('숙소')});
  it('records an unavailable interest without fabricating a candidate',()=>{const result=composeItinerary([anchor],context({selectedInterests:['GOLF']}));expect(result.items).toEqual([expect.objectContaining({programLabel:'호수'})]);expect(result.coverage).toEqual({selected:['GOLF'],covered:[],uncovered:['GOLF']})});
  it('allows a fixed event to override generic role order',()=>{const event=candidate('정시 행사','EVENT',{scheduledTime:'10:00'});expect(composeItinerary([anchor,event],context({selectedInterests:['FESTIVAL_EVENT']})).items[0].programLabel).toBe('정시 행사')});
  it('uses reusable semantic roles',()=>{expect(itineraryRole(meal)).toBe('MEAL');expect(itineraryRole(cafe)).toBe('CAFE_BREAK');expect(itineraryRole(stay)).toBe('ACCOMMODATION')});
  it('preserves every explicit destination before optional recommendations',()=>{const hot=candidate('백두산천지온천','ATTRACTION',{programUri:'gajo:hot',isMustVisit:true}),suseungdae=candidate('수승대','ATTRACTION',{programUri:'gajo:suseungdae',isMustVisit:true,actions:{},accessStatus:'NEEDS_VERIFICATION'}),unrelated=candidate('온천먹거리','MEAL',{programUri:'gajo:unrelated'}),result=composeItinerary([unrelated,hot,suseungdae],context());expect(result.items.slice(0,2).map(x=>x.programUri)).toEqual(expect.arrayContaining(['gajo:hot','gajo:suseungdae']));expect(result.items.find(x=>x.programUri==='gajo:suseungdae')).toMatchObject({actions:{},accessStatus:'NEEDS_VERIFICATION'})});
  it('restricts an explicit journey follow-up to its requested set and preserves requested order',()=>{const first=candidate('가조온천','PLACE_CONCEPT',{programUri:'gajo:area',isMustVisit:true,requestedOrder:0,actions:{},accessStatus:'NEEDS_VERIFICATION'}),second=candidate('수승대','ATTRACTION',{programUri:'gajo:suseungdae',isMustVisit:true,requestedOrder:1,actions:{},accessStatus:'NEEDS_VERIFICATION'}),unrelated=candidate('다온 카페','CAFE',{programUri:'gajo:cafe'}),result=composeItinerary([unrelated,second,first],context({explicitRequestedJourney:true}));expect(result.items.map(x=>x.programUri)).toEqual(['gajo:area','gajo:suseungdae']);expect(JSON.stringify(result)).not.toContain('다온 카페')});
});
