import { AnalyticsService } from './analytics.service';
describe('AnalyticsService', () => {
  it('rejects raw free language text instead of storing it', async () => {
    const create = jest.fn();
    const service = new AnalyticsService({ create } as any);
    await service.record({
      eventType: 'FREE_LANGUAGE_REQUEST',
      sessionId: 's1',
      regionId: 'okcheon',
      metadata: { rawMessage: '비밀 문장', text: '원문', mode: 'NOW' },
    });
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects unknown events', async () => {
    const create = jest.fn();
    const service = new AnalyticsService({ create } as any);
    expect(
      await service.record({ eventType: 'RAW_TEXT', sessionId: 's1' }),
    ).toEqual({ accepted: false });
    expect(create).not.toHaveBeenCalled();
  });
  it('accepts canonical interest coverage events without raw text', async () => {
    const create = jest.fn();
    const service = new AnalyticsService({ create } as any);
    await service.record({eventType:'INTEREST_UNCOVERED',sessionId:'s2',regionId:'hapcheon',metadata:{interestId:'GOLF'}});
    expect(create).toHaveBeenCalledWith(expect.objectContaining({eventType:'INTEREST_UNCOVERED',sessionId:'s2',regionId:'hapcheon',metadata:{interestId:'GOLF',regionId:'hapcheon'},expiresAt:expect.any(Date)}));
  });
  it('accepts canonical journey execution events without visitor text',async()=>{const create=jest.fn(),service=new AnalyticsService({create}as any);await service.record({eventType:'JOURNEY_START_ACTION',sessionId:'s3',regionId:'hapcheon',metadata:{entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',provider:'KAKAO'}});expect(create).toHaveBeenCalledWith(expect.objectContaining({eventType:'JOURNEY_START_ACTION',sessionId:'s3',regionId:'hapcheon',metadata:{entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',provider:'KAKAO',regionId:'hapcheon'},expiresAt:expect.any(Date)}))});
  it.each([
    ['unknown event',{eventType:'RAW_TEXT',sessionId:'s1',regionId:'gajo'}],
    ['unknown source',{eventType:'ENTRY_SOURCE',sessionId:'s1',regionId:'gajo',metadata:{source:'attacker-label'}}],
    ['unknown intent',{eventType:'QUICK_INTENT_SELECTED',sessionId:'s1',regionId:'gajo',metadata:{intent:'attacker-label'}}],
    ['blank value',{eventType:'ENTRY_SOURCE',sessionId:'s1',regionId:'gajo',metadata:{source:' '}}],
    ['long value',{eventType:'ENTRY_SOURCE',sessionId:'s1',regionId:'gajo',metadata:{source:'x'.repeat(513)}}],
    ['nested value',{eventType:'ENTRY_SOURCE',sessionId:'s1',regionId:'gajo',metadata:{source:{value:'recommendation'}}}],
    ['array value',{eventType:'ENTRY_SOURCE',sessionId:'s1',regionId:'gajo',metadata:{source:['recommendation']}}],
    ['prototype key',{eventType:'ENTRY_SOURCE',sessionId:'s1',regionId:'gajo',metadata:{prototype:'x'}}],
    ['constructor key',{eventType:'ENTRY_SOURCE',sessionId:'s1',regionId:'gajo',metadata:{constructor:'x'}}],
    ['raw message',{eventType:'FREE_LANGUAGE_REQUEST',sessionId:'s1',regionId:'gajo',metadata:{message:'private'}}],
    ['prompt',{eventType:'FREE_LANGUAGE_REQUEST',sessionId:'s1',regionId:'gajo',metadata:{prompt:'private'}}],
    ['query',{eventType:'FREE_LANGUAGE_REQUEST',sessionId:'s1',regionId:'gajo',metadata:{query:'private'}}],
    ['text',{eventType:'FREE_LANGUAGE_REQUEST',sessionId:'s1',regionId:'gajo',metadata:{text:'private'}}],
    ['coordinates',{eventType:'RUNTIME_HYDRATED',sessionId:'s1',regionId:'gajo',metadata:{latitude:35.1}}],
    ['trip id',{eventType:'NEW_TRIP_STARTED',sessionId:'s1',regionId:'gajo',metadata:{anonymousTripId:'trip'}}],
  ])('rejects %s without a database write',async(_label,input)=>{const create=jest.fn(),service=new AnalyticsService({create}as any);expect(await service.record(input as any)).toEqual({accepted:false});expect(create).not.toHaveBeenCalled()});
  it('rejects an own __proto__ key and strips an unknown harmless key',async()=>{const create=jest.fn(),service=new AnalyticsService({create}as any),polluted=JSON.parse('{"__proto__":"x"}');expect(await service.record({eventType:'ENTRY_SOURCE',sessionId:'s1',regionId:'gajo',metadata:polluted})).toEqual({accepted:false});expect(await service.record({eventType:'ENTRY_SOURCE',sessionId:'s1',regionId:'gajo',metadata:{source:'recommendation',unexpected:'drop'}})).toEqual({accepted:true});expect(create).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledWith(expect.objectContaining({metadata:{source:'recommendation',regionId:'gajo'}}))});
  it('counts one valid event once without returning event records or identifiers',async()=>{const rows:any[]=[],model={create:jest.fn(async(value:any)=>void rows.push(value)),find:()=>({lean:async()=>rows})},service=new AnalyticsService(model as any);expect(await service.record({eventType:'QUICK_INTENT_SELECTED',sessionId:'s1',regionId:'hapcheon',metadata:{intent:'nearby-lodging'}})).toEqual({accepted:true});const summary=await service.summary();expect(model.create).toHaveBeenCalledTimes(1);expect(summary.mostUsedQuickIntents).toEqual([{label:'nearby-lodging',total:1}]);expect(summary.totalTripSessions).toBe(1);expect(JSON.stringify(summary)).not.toMatch(/s1|sessionId|anonymousTripId|latitude|longitude|rawMessage|createdAt|events/)});
});
