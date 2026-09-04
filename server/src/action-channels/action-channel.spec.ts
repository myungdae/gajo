import { randomUUID } from 'node:crypto';
import { ActionChannelService } from './action-channel.service';
import { ChannelOutboundService, bookingEventId } from './channel-outbound.service';
import { channelHttps, channelInput, channelVisible } from './channel-policy';
import { ActionChannelSchema } from './action-channel.schema';
import { validateVisitorEvent } from '../analytics/visitor-contract';
import { buildVisitorReport, visitorPeriod } from '../analytics/visitor-report';
import { DecisionPipelineService } from '../recommendation/decision-pipeline.service';
const principal={actorId:'regional-reviewer',allowedRegionIds:['hapcheon']};
const place='https://hapcheon.example/ontology#hapcheonLakeSmilePension';
const fields=()=>({kind:'DIRECT_BOOKING',labelKo:'실시간 예약하기',labelEn:'Book Now',target:'https://rev.yapen.co.kr/external?ypIdx=24507',sourceUrl:'https://www.lakesmile.com/',reviewDueAt:new Date(Date.now()+86400000*90).toISOString()});
function fixture(){
  const rows=new Map<string,any>();
  const match=(r:any,q:any)=>Object.entries(q).every(([k,v]:any)=>v?.$gt?r[k]>v.$gt:r[k]===v);
  const model={
    create:jest.fn(async(r:any)=>{rows.set(r._id,r);return r}),
    find:(q:any)=>({lean:async()=>[...rows.values()].filter(r=>match(r,q))}),
    findOne:(q:any)=>({lean:async()=>[...rows.values()].find(r=>match(r,q))}),
    findOneAndUpdate:(q:any,u:any)=>({lean:async()=>{const r=[...rows.values()].find(r=>match(r,q));if(!r)return null;Object.assign(r,u.$set);r.revision++;r.audit.push(u.$push.audit);return r}}),
  };
  const regional={effectiveDataset:async(region:string)=>region==='hapcheon'?{records:[{entityUri:place,canonicalId:'hapcheon-lake-smile-pension'}]}:{records:[]}};
  const service=new ActionChannelService(model as any,regional as any);
  return {service,rows,model};
}
describe('verified channel contract',()=>{
  it.each(['http://example.com','javascript:alert(1)','https://user:pass@example.com','https://127.0.0.1','https://localhost','https://example.com:8443','https://rev.yapen.co.kr/','https://example.com/%0d%0aLocation:evil','https://m.booking.naver.com/booking/13/bizes/'+1569104])('rejects unsafe or unsupported target %s',url=>expect(()=>channelHttps(url)).toThrow());
  it('accepts only exact business-specific Yapen links and bilingual labels',()=>{
    expect(channelInput(fields()).target).toBe('https://rev.yapen.co.kr/external?ypIdx=24507');
    expect(()=>channelInput({...fields(),reviewedBy:'fake'})).toThrow();
    expect(()=>channelInput({...fields(),labelEn:''})).toThrow();
    expect(()=>channelInput({...fields(),kind:'PHONE',target:'055-931-1638;123'})).toThrow();
  });
  it.each(['DRAFT','REVIEW_REQUIRED','SUSPENDED'])('never exposes %s',verificationStatus=>expect(channelVisible({...fields(),verificationStatus,published:true})).toBe(false));
  it('expires verification and declares indexes without automatic DB writes',()=>{
    expect(channelVisible({...fields(),verificationStatus:'VERIFIED',published:true,reviewDueAt:new Date(0)})).toBe(false);
    expect(ActionChannelSchema.get('autoIndex')).toBe(false);
    expect(ActionChannelSchema.get('autoCreate')).toBe(false);
    expect(ActionChannelSchema.indexes()).toContainEqual([{channelId:1},{unique:true}]);
  });
});
describe('regional manager golden scenario',()=>{
  it('creates multiple channels on an existing place, reviews, publishes, then safely dispatches',async()=>{
    const {service}=fixture();
    const row=await service.create(principal,'hapcheon',place,fields());
    await service.create(principal,'hapcheon',place,{...fields(),kind:'PHONE',target:'055-931-1638'});
    expect(await service.publicList('hapcheon',place)).toEqual([]);
    await service.change(principal,'hapcheon',place,row.channelId,'VERIFY',{revision:1,confirmed:true});
    expect(await service.publicList('hapcheon',place)).toEqual([]);
    await service.change(principal,'hapcheon',place,row.channelId,'PUBLISH',{revision:2});
    const publicRows=await service.publicList('hapcheon',place);
    expect(publicRows).toHaveLength(1);expect(publicRows[0]).not.toHaveProperty('target');
    const analytics={record:jest.fn().mockResolvedValue({accepted:true})};
    const outbound=new ChannelOutboundService(service,analytics as any);
    const event={schemaVersion:2,eventId:randomUUID(),eventType:'BOOKING_CLICKED',regionId:'hapcheon',anonymousTripId:randomUUID(),visitSessionId:randomUUID(),pageViewId:randomUUID(),screen:'CONCIERGE',uiLocale:'en',occurredAt:new Date().toISOString(),actionId:randomUUID(),channelId:row.channelId,placeKey:place};
    expect(await outbound.dispatch('hapcheon',place,row.channelId,{revision:3,event})).toMatchObject({href:fields().target});
    await outbound.dispatch('hapcheon',place,row.channelId,{revision:3,event});
    expect(analytics.record.mock.calls.map(c=>c[0].eventType)).toEqual(['BOOKING_CLICKED','BOOKING_OUTBOUND_DISPATCHED','BOOKING_CLICKED','BOOKING_OUTBOUND_DISPATCHED']);
    expect(analytics.record.mock.calls[0][0].eventId).toBe(analytics.record.mock.calls[2][0].eventId);
    expect(analytics.record.mock.calls[0][0].eventId).not.toBe(analytics.record.mock.calls[1][0].eventId);
    expect(analytics.record.mock.calls.every(c=>!('target'in c[0])&&!('sourceUrl'in c[0]))).toBe(true);
    expect(row.audit.map((a:any)=>a.action)).toEqual(['CREATE','VERIFY','PUBLISH']);
    await service.change(principal,'hapcheon',place,row.channelId,'SUSPEND',{revision:3});
    expect(await service.publicList('hapcheon',place)).toEqual([]);
    await expect(outbound.dispatch('hapcheon',place,row.channelId,{revision:4,event})).rejects.toThrow();
    expect(analytics.record).toHaveBeenCalledTimes(4);
  });
  it('blocks cross-region read/write, unknown places, stale edits, direct publication and unconfirmed review',async()=>{
    const {service,model}=fixture(),wrong={...principal,allowedRegionIds:['okcheon']};
    await expect(service.list(wrong,'hapcheon',place)).rejects.toThrow();
    await expect(service.create(wrong,'hapcheon',place,fields())).rejects.toThrow();
    await expect(service.create(principal,'hapcheon','unknown',fields())).rejects.toThrow();
    expect(model.create).not.toHaveBeenCalled();
    const row=await service.create(principal,'hapcheon',place,fields());
    await expect(service.change(wrong,'hapcheon',place,row.channelId,'SUSPEND',{revision:1})).rejects.toThrow();
    await expect(service.change(principal,'hapcheon',place,row.channelId,'PUBLISH',{revision:1})).rejects.toThrow();
    await expect(service.change(principal,'hapcheon',place,row.channelId,'VERIFY',{revision:1})).rejects.toThrow();
    await expect(service.change(principal,'hapcheon',place,row.channelId,'EDIT',{revision:2,fields:fields()})).rejects.toThrow();
  });
  it('editing invalidates review and stored URL tampering cannot bypass the reviewed fingerprint',async()=>{
    const {service}=fixture();const row=await service.create(principal,'hapcheon',place,fields());
    await service.change(principal,'hapcheon',place,row.channelId,'VERIFY',{revision:1,confirmed:true});
    await service.change(principal,'hapcheon',place,row.channelId,'PUBLISH',{revision:2});
    row.target='https://evil.example.org/';
    await expect(service.approved('hapcheon',place,row.channelId,3)).rejects.toThrow();
    await service.change(principal,'hapcheon',place,row.channelId,'EDIT',{revision:3,fields:fields()});
    expect(row.verificationStatus).toBe('REVIEW_REQUIRED');expect(row.published).toBe(false);
  });
  it('rejects supplied redirect URLs; telemetry failure does not block approved navigation',async()=>{
    const channels={approved:jest.fn().mockResolvedValue({channelId:randomUUID(),placeKey:place,kind:'DIRECT_BOOKING',target:fields().target,revision:1})};
    const outbound=new ChannelOutboundService(channels as any,{record:jest.fn().mockRejectedValue(new Error('DB unavailable'))} as any);
    await expect(outbound.dispatch('hapcheon',place,'x',{revision:1,url:'https://evil.example.org'})).rejects.toThrow();
    expect(await outbound.dispatch('hapcheon',place,'x',{revision:1,event:{gps:'forbidden'}})).toMatchObject({href:fields().target});
    expect(bookingEventId('one','BOOKING_CLICKED')).toBe(bookingEventId('one','BOOKING_CLICKED'));
    expect(()=>validateVisitorEvent({eventType:'BOOKING_CONFIRMED'})).toThrow();
  });
  it('records a click without inventing dispatch or completion when only the click endpoint arrives',async()=>{
    const id=randomUUID(), channels={approved:jest.fn().mockResolvedValue({channelId:id,placeKey:place,kind:'DIRECT_BOOKING',target:fields().target,revision:1})},analytics={record:jest.fn().mockResolvedValue({accepted:true})};
    const event={schemaVersion:2,eventId:randomUUID(),eventType:'BOOKING_CLICKED',regionId:'hapcheon',anonymousTripId:randomUUID(),visitSessionId:randomUUID(),pageViewId:randomUUID(),screen:'CONCIERGE',uiLocale:'ko',occurredAt:new Date().toISOString(),actionId:randomUUID(),channelId:id,placeKey:place};
    const result=await new ChannelOutboundService(channels as any,analytics as any).dispatch('hapcheon',place,id,{revision:1,event},undefined,true);
    expect(result).toEqual({accepted:true});expect(analytics.record).toHaveBeenCalledTimes(1);expect(analytics.record.mock.calls[0][0].eventType).toBe('BOOKING_CLICKED');
  });
  it('booking channels never change context-based ranking',()=>{
    const engine=new DecisionPipelineService();
    const base={programUri:'place-a',matchedOn:[],mitigatesRisk:[],requiredMobility:[],score:0};
    const context={environmentConditions:[],expandedConditions:[]};
    const before=engine.suitability([base] as any,context as any);
    const after=engine.suitability([{...base,actionChannels:[{kind:'DIRECT_BOOKING',published:true}],reservationUrl:fields().target,partnerPaid:true}] as any,context as any);
    expect(after[0].score).toBe(before[0].score);
  });
  it('booking events preserve internal exclusion, five-session protection and inclusion subtraction protection',()=>{
    const now=new Date(), make=(visit:string,trafficClass='GENERAL_VISIT')=>({eventType:'BOOKING_CLICKED',visitSessionId:visit,anonymousTripId:visit,receivedAt:now,occurredAt:now,trafficClass,screen:'CONCIERGE',uiLocale:'ko'});
    const publicRows=Array.from({length:5},(_,i)=>make(String(i))), rows=[...publicRows,make('internal','INTERNAL_TEST'),make('auto','AUTOMATED_CHECK')];
    const report=buildVisitorReport(rows,visitorPeriod({},now),false,now);
    expect(report.totals.events.value).toBe(5);
    expect(report.events.find(r=>r.label==='BOOKING_CLICKED')?.events).toBe(5);
    const hidden=buildVisitorReport(rows,visitorPeriod({},now),true,now);
    expect(hidden.totals.events.value).toBeNull();expect(hidden.events.every(r=>r.events===null)).toBe(true);
    const small=buildVisitorReport(Array.from({length:8},()=>make('one')),visitorPeriod({},now),false,now);
    expect(small.events[0].events).toBeNull();
  });
});
