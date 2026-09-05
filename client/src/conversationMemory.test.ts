import test from 'node:test';
import assert from 'node:assert/strict';
import { readConversation, saveConversation, shouldAutoSubmitEntry } from './conversationMemory.ts';
import { createTripSession } from './tripSession.ts';
import { localizedRegionalPath } from './visitorRouting.ts';
test('confirmed conversation survives navigation for all regions and NOW/PLAN without changing TripSession',()=>{
  const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>{data.set(k,v);}};
  for(const region of ['gajo','okcheon','muan','gyeryong','hapcheon','daejeon-junggu'] as const){
    const trip=createTripSession(region),before=JSON.stringify(trip);
    for(const mode of ['NOW','PLAN']){
      const snapshot={messages:[{role:'user',text:'합천 카페'},{role:'ai',text:'A verified café'}],conversationAnchor:{regionId:region,entityId:'place:1'},discoveryContext:{regionId:region},explicitJourney:{destinations:['place:1']},excludedDiscoveryIds:['place:2']};
      saveConversation(storage,region,trip.id,mode,snapshot);
      assert.deepEqual(readConversation(storage,region,trip.id,mode),snapshot);
      assert.equal(readConversation(storage,'unknown',trip.id,mode),undefined);
      assert.equal(readConversation(storage,region,'new-trip',mode),undefined);
      for(const path of ['/nearby-discovery','/map','/itinerary','/concierge?mode='+mode.toLowerCase()]){
        assert.equal(new URL(localizedRegionalPath(path,region,true,'en'),'https://example.test').searchParams.get('lang'),'en');
      }
    }
    assert.equal(JSON.stringify(trip),before);
  }
});
test('expired corrupt and unavailable storage safely starts a conversation',()=>{
  const storage={getItem:()=>'{bad',setItem:()=>{throw new Error('disabled');}};
  assert.equal(readConversation(storage,'gajo','trip','NOW'),undefined);
  assert.doesNotThrow(()=>saveConversation(storage,'gajo','trip','NOW',{}));
  assert.equal(readConversation({getItem:()=>JSON.stringify({regionId:'gajo',tripId:'trip',mode:'NOW',savedAt:0,value:{}}),setItem:()=>{}},'gajo','trip','NOW',86400001),undefined);
});

test('returning from home does not submit the same completed request again',()=>{
  const request='앞서 선택한 여행 조건과 확인된 지금 상황으로 여정을 만들어 주세요.';
  assert.equal(shouldAutoSubmitEntry(request,undefined),true);
  assert.equal(shouldAutoSubmitEntry(request,[{role:'user',text:request}]),true);
  assert.equal(shouldAutoSubmitEntry(request,[{role:'user',text:`  ${request}  `},{role:'ai',text:'완료',result:{recommendation:{}}}]),false);
  assert.equal(shouldAutoSubmitEntry('다른 요청',[{role:'user',text:request},{role:'ai',text:'완료',result:{}}]),true);
});
