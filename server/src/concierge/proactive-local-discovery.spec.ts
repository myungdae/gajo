import { selectLocalDiscovery, reviewCurrentStop } from './proactive-local-discovery';
import { ProactiveLocalDiscoveryService } from './proactive-local-discovery.service';
import { HAPCHEON_MASTER_DATA } from '../regions/hapcheon/master-data';
const now=new Date('2026-09-07T03:00:00Z');
const context:any={regionId:'hapcheon',currentTime:'12:00',currentDate:'2026-09-07',dayOfWeek:'Monday',stayUntil:'15:00',
  locationStatus:'AVAILABLE',latitude:35.5,longitude:128,locationAccuracy:15,locationObservedAt:now.toISOString(),
  transportMode:'WALK',activityPreferences:['INDOOR'],weatherState:'RAIN',weatherObservation:{status:'LIVE',stale:false}};
// Synthetic operational facts are restricted to this test; never inserted or shipped as regional data.
const place:any={entityUri:'fixture:a',canonicalLabelKo:'테스트 경험',category:'ACTIVITY',tags:['INDOOR','FAMILY_TRIP'],runtimeDataStatus:'VERIFIED',
  latitude:35.501,longitude:128,actions:{navigate:{latitude:35.501,longitude:128}},walkingAccess:{durationMinutes:30,shortWalkingDistance:true},
  operatingHours:[{days:['MONDAY'],openTime:'09:00',closeTime:'17:00'}],representativeAnchor:true};
describe('proactive local discovery feasibility before curation',()=>{
  it('only returns evidence from the supplied registered resources',()=>{
    expect(selectLocalDiscovery([],context,now).offers).toEqual([]);
    expect(selectLocalDiscovery([place],context,now).offers[0]).toMatchObject({entityId:place.entityUri,regionId:'hapcheon'});
    expect(selectLocalDiscovery(HAPCHEON_MASTER_DATA,context,now).offers).toEqual([]);
  });
  it.each([
    {runtimeDataStatus:'PARTIAL'}, {actions:{}}, {walkingAccess:{}}, {latitude:37},
    {operatingHours:[{days:['MONDAY'],openTime:'09:00',closeTime:'11:00'}]},
    {operatingHours:[{days:['MONDAY'],openTime:'09:00',closeTime:'12:10'}]},
    {operatingHours:'09:00~17:00'}, {tags:['TOURISM_NATURE']}, {reservationUrl:'https://example.com'},
    {closureDays:['MONDAY']},
  ])('does not let representative priority bypass unsuitable or unknown facts: %j',override=>{
    expect(selectLocalDiscovery([{...place,...override}],{...context,firstVisit:true},now).offers).toEqual([]);
  });
  it.each([{stayUntil:'12:10'},{locationObservedAt:'2026-09-06T03:00:00Z'},{locationAccuracy:1000},
    {transportMode:'UNKNOWN'},{stayUntil:undefined},{companions:[{relationship:'child'}],activityPreferences:['INDOOR']}])('respects runtime constraints %j',override=>{
    const row='companions' in override?{...place,tags:['INDOOR']}:place;
    expect(selectLocalDiscovery([row],{...context,...override},now).offers).toEqual([]);
  });
  it('excludes completed, skipped, planned, shown and declined entity identifiers',()=>{
    for(const key of ['completedEntityIds','skippedEntityIds','itineraryEntityIds','excludedEntityIds'])
      expect(selectLocalDiscovery([place],{...context,tripContext:{[key]:[place.entityUri]}},now).offers).toEqual([]);
    expect(selectLocalDiscovery([place],{...context,excludedEntityIds:[place.entityUri]},now).offers).toEqual([]);
  });
  it('rejects inaccessible suggestions even for first visits',()=>{
    expect(selectLocalDiscovery([{...place,walkingAccess:{durationMinutes:30}}],{...context,walkingLevel:'LOW',firstVisit:true},now).offers).toEqual([]);
  });
  it('discovers a related regional theme beyond the requested category without inventing a relationship',()=>{
    const theme='HAPCHEON_LAKE',stay={...place,entityUri:'fixture:stay',tags:[theme,'ACCOMMODATION']};
    const other={...place,tags:[theme,'INDOOR']};
    const result=selectLocalDiscovery([stay,other],{...context,weatherState:'CLEAR',activityPreferences:['ACCOMMODATION'],tripContext:{itineraryEntityIds:[stay.entityUri]}},now);
    expect(result.offers).toHaveLength(1);expect(result.offers[0].reason).toContain('같은 지역 테마');
  });
  it('only makes a next-stop weather claim using live observations',()=>{
    const outdoor={...place,tags:['TOURISM_NATURE']};
    expect(reviewCurrentStop([outdoor],{...context,tripContext:{currentEntityId:place.entityUri}})).toContain('야외');
    expect(reviewCurrentStop([outdoor],{...context,weatherObservation:{status:'STALE'},tripContext:{currentEntityId:place.entityUri}})).toBeUndefined();
  });
  it('service intersects effective data with published DB resources and never returns raw linkage',async()=>{
    const data:any={effectiveDataset:async()=>({records:[place]}),networkResources:async()=>[]};
    const live:any={hydrateLiveRuntimeContext:jest.fn(async()=>({context:{...context,locationObservedAt:new Date().toISOString()}}))};
    const service=new ProactiveLocalDiscoveryService(live,data);
    expect((await service.discover({...context,tripContext:{anonymousTripId:'private-trip'},sessionId:'private-session'})).offers).toEqual([]);
    data.networkResources=async()=>[{id:place.entityUri}];
    const result=await service.discover({...context,tripContext:{anonymousTripId:'private-trip'},runtimeStates:[{operatingState:'OPEN'}]});
    expect(result.offers).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/anonymousTripId|sessionId|private-trip|runtimeStates/);
    expect(live.hydrateLiveRuntimeContext.mock.calls.at(-1)[0]).not.toHaveProperty('runtimeStates');
  });
});
