import { BusinessRegistrationService } from './business-registration.service';
import { businessFacts, businessInput, businessScope } from './business-registration.policy';
import { RegionalDataService } from './regional-data.service';
import { ActionChannelService } from '../action-channels/action-channel.service';
import { RegionalDataRecordSchema } from './regional-data.schema';
const principal={actorId:'FIELD_MANAGER',allowedRegionIds:['hapcheon']};
const input=()=>({displayName:'47C 테스트 업소',businessType:'PENSION',address:'합천군 테스트길 9999',phone:'055-999-8765',websiteUrl:'https://test-business.example.com/',sourceUrl:'https://test-business.example.com/about',shortDescription:'현장 등록 검증용 업소',verifiedOn:'2026-09-01'});
function harness() {
  const rows:any[]=[];
  const match=(r:any,q:any)=>Object.entries(q).every(([k,v])=>k==='registration.revision'?r.registration?.revision===v:r[k]===v);
  const model:any={find:(q:any)=>({lean:async()=>structuredClone(rows.filter(r=>match(r,q))),sort(){return this;}}),findOne:(q:any)=>({lean:async()=>structuredClone(rows.find(r=>match(r,q)))}),create:jest.fn(async(r:any)=>{rows.push(structuredClone(r));return structuredClone(r)}),findOneAndUpdate:(q:any,u:any)=>({lean:async()=>{const r=rows.find(r=>match(r,q));if(!r)return null;Object.assign(r,structuredClone(u.$set));r.auditTrail.push(structuredClone(u.$push.auditTrail));return structuredClone(r);}})};
  return {rows,model,service:new BusinessRegistrationService(model),regional:new RegionalDataService(model)};
}
describe('manager business registration',()=>{
  it('generates identity and requires distinct review and publish before public dataset/channel access',async()=>{
    const {service,regional,model}=harness();const row:any=await service.create(principal,'hapcheon',input());
    expect(row.canonicalEntityId).toMatch(/^urn:regional-business:hapcheon-business-/);expect(row.lifecycleStatus).toBe('NEW_CANDIDATE');
    expect((await regional.effectiveDataset('hapcheon'))!.records.some(r=>r.entityUri===row.canonicalEntityId)).toBe(false);
    const channels=new ActionChannelService({} as any,regional);
    await expect(channels.place('hapcheon',row.canonicalEntityId)).rejects.toThrow();
    await expect(service.change(principal,'hapcheon',row.id,'PUBLISH',{revision:1})).rejects.toThrow();
    await expect(service.change(principal,'hapcheon',row.id,'VERIFY',{revision:1})).rejects.toThrow();
    const verified:any=await service.change(principal,'hapcheon',row.id,'VERIFY',{revision:1,confirmed:true});
    expect(verified.lifecycleStatus).toBe('APPROVED');await expect(channels.place('hapcheon',row.canonicalEntityId)).rejects.toThrow();
    await service.change(principal,'hapcheon',row.id,'PUBLISH',{revision:2});
    expect(await channels.place('hapcheon',row.canonicalEntityId)).toBe(row.canonicalEntityId);
    const publicRow:any=(await regional.effectiveDataset('hapcheon'))!.records.find(r=>r.entityUri===row.canonicalEntityId);
    expect(publicRow.actions.call).toBeUndefined();expect(publicRow.actions.navigate).toBeUndefined();expect(publicRow.actions.website).toBeUndefined();
    expect(model.create).toHaveBeenCalledTimes(1);
    await service.change(principal,'hapcheon',row.id,'EDIT',{revision:3,input:{...input(),shortDescription:'새 소개'}});
    await expect(channels.place('hapcheon',row.canonicalEntityId)).rejects.toThrow();
  });
  it('blocks duplicates without changing existing Smile Pension and rejects region forgery',async()=>{
    const {service,model}=harness();
    await expect(service.create(principal,'gajo',input())).rejects.toThrow();
    await expect(service.create({actorId:'other',allowedRegionIds:['gajo']},'hapcheon',input())).rejects.toThrow();
    const smile={...input(),displayName:'합천호 스마일펜션',phone:'055-931-1638'};
    expect((await service.duplicates(principal,'hapcheon',smile)).length).toBeGreaterThan(0);
    await expect(service.create(principal,'hapcheon',smile)).rejects.toThrow();expect(model.create).not.toHaveBeenCalled();
    await service.create(principal,'hapcheon',input());
    await expect(service.create(principal,'hapcheon',{...input(),displayName:'다른 이름'})).rejects.toThrow();
  });
  it('rejects a stale revision and preserves audited server actor',async()=>{
    const {service}=harness();const row:any=await service.create(principal,'hapcheon',input());
    const verified:any=await service.change(principal,'hapcheon',row.id,'VERIFY',{revision:1,confirmed:true});
    expect(verified.auditTrail.at(-1).actorId).toBe(principal.actorId);
    await expect(service.change(principal,'hapcheon',row.id,'STOP',{revision:1})).rejects.toThrow();
    await service.change(principal,'hapcheon',row.id,'STOP',{revision:2});
    await expect(service.change(principal,'hapcheon',row.id,'PUBLISH',{revision:3})).rejects.toThrow();
  });
  it.each(['http://example.com','https://localhost','https://127.0.0.1','https://rev.yapen.co.kr/','https://m.booking.naver.com/booking/13/bizes/1569104'])('rejects unsafe or shared URL %s',url=>{expect(()=>businessInput({...input(),websiteUrl:url})).toThrow();});
  it('requires valid evidence and never trusts client identity, phone or coordinates by default',()=>{
    expect(()=>businessScope(principal,'gajo')).toThrow();
    expect(()=>businessInput({...input(),canonicalEntityId:'fake'})).toThrow();
    expect(()=>businessInput({...input(),mapConfirmed:true})).toThrow();
    expect(()=>businessInput({...input(),sourceUrl:''})).toThrow();
    const safe=businessFacts(businessInput({...input(),latitude:35.5,longitude:128}));expect(safe.latitude).toBeUndefined();expect(safe.phone).toBeUndefined();
    expect(businessFacts(businessInput({...input(),latitude:35.5,longitude:128,mapConfirmed:true})).latitude).toBe(35.5);
    expect(RegionalDataRecordSchema.indexes()).toContainEqual([{registrationKeys:1},expect.objectContaining({unique:true,sparse:true})]);
  });
});
