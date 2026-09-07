import { createHash } from 'crypto';
import { RegionalReportService } from './regional-report.service';
import { contextNetwork } from './context-network';
const row = (id: string, extra = {}) => ({ id, label: id, category: 'FOOD', status: 'VERIFIED', area: 'hapcheon', sourceName: 'test', ...extra });
describe('DB-only network', () => {
  it('never invents relationships and deduplicates entities', () => {
    expect(contextNetwork([row('a'),row('b')]).edges).toEqual([]);
    expect(contextNetwork([row('a'),row('a')]).nodes).toHaveLength(1);
    expect(contextNetwork([row('a',{category:'UNKNOWN'})]).nodes).toEqual([]);
  });
  it('uses only valid coordinates within 1km', () => {
    const graph=contextNetwork([row('a',{latitude:35.5,longitude:128}),row('b',{latitude:35.501,longitude:128}),row('c',{latitude:36,longitude:128}),row('d',{latitude:NaN,longitude:128})]);
    expect(graph.edges).toEqual([expect.objectContaining({source:'a',target:'b',relation:'NEARBY'})]);
  });
  it('has no static fallback or cross-region projection', async () => {
    const networkResources=jest.fn().mockResolvedValue([]);
    const service=new RegionalReportService({} as any,{} as any,{} as any,{networkResources} as any);
    expect(await service.ecosystem('hapcheon')).toMatchObject({nodes:[],edges:[],generatedFrom:'REGIONAL_DATA_RECORD'});
    await service.ecosystem('okcheon');
    expect(networkResources).toHaveBeenCalledTimes(1);
    expect(networkResources).toHaveBeenCalledWith('hapcheon');
  });
  it('uses only suppressed verified-use evidence and stable registered identities',async()=>{
    const hash=(id:string)=>`node-${createHash('sha256').update(`regional-report:${id}`).digest('hex').slice(0,20)}`;
    const e={sourceNodeId:hash('p1'),targetNodeId:hash('p2'),total:5, anonymousTripId:'private-flow',sessionId:'private-session'};
    const latestPublicRolling=async()=>({minimumCellSize:5,released:{edges:[
      {...e,stage:'BENEFIT_USE_CONFIRMED'}, {...e,stage:'QR_VISIT_CONFIRMED'}, {...e,stage:'INTEREST'},
      {...e,stage:'MOVEMENT_INTENT'}, {...e,stage:'BENEFIT_USE_CONFIRMED',total:4},
      {...e,stage:'BENEFIT_USE_CONFIRMED',targetNodeId:'unknown'}]}});
    const partners={find:()=>({select:()=>({lean:async()=>[{partnerId:'p1',canonicalEntityId:'a'},{partnerId:'p2',canonicalEntityId:'b'}]})})};
    const service=new RegionalReportService({} as any,{} as any,partners as any,{networkResources:async()=>[row('a'),row('b')]} as any,{latestPublicRolling} as any);
    const result=await service.ecosystem('hapcheon');
    expect(result.edges).toEqual([
      expect.objectContaining({source:'a',target:'b',relation:'ACTUAL_USAGE',evidenceLevel:'VERIFIED_USE',total:5}),
      expect.objectContaining({relation:'INTEREST',evidenceLevel:'INTEREST',total:5}),
      expect.objectContaining({relation:'MOVEMENT_INTENT',evidenceLevel:'MOVEMENT_INTENT',total:5}),
    ]);
    expect(JSON.stringify(result)).not.toMatch(/partnerId|sessionId|anonymousTripId|private-flow|private-session/);
  });
  it.each(['INTEREST','MOVEMENT_INTENT','QR_VISIT_CONFIRMED'])('never promotes %s to verified use',async(stage)=>{
    const hash=(id:string)=>`node-${createHash('sha256').update(`regional-report:${id}`).digest('hex').slice(0,20)}`;
    const partners={find:()=>({select:()=>({lean:async()=>[{partnerId:'p1',canonicalEntityId:'a'},{partnerId:'p2',canonicalEntityId:'b'}]})})};
    const service=new RegionalReportService({} as any,{} as any,partners as any,{networkResources:async()=>[row('a'),row('b')]} as any,
      {latestPublicRolling:async()=>({minimumCellSize:5,released:{edges:[{sourceNodeId:hash('p1'),targetNodeId:hash('p2'),stage,total:5}]}})} as any);
    const result=await service.ecosystem('hapcheon');
    expect(result.edges.filter(e=>e.evidenceLevel==='VERIFIED_USE')).toEqual([]);
    expect(result.usage.status).toBe('PREPARING');
    expect(result.edges).toHaveLength(stage==='QR_VISIT_CONFIRMED'?0:1);
  });
  it.each(['INTEREST','MOVEMENT_INTENT','BENEFIT_USE_CONFIRMED'])('suppresses invalid or absent %s evidence',async(stage)=>{
    const hash=(id:string)=>`node-${createHash('sha256').update(`regional-report:${id}`).digest('hex').slice(0,20)}`;
    const partners={find:()=>({select:()=>({lean:async()=>[{partnerId:'p1',canonicalEntityId:'a'},{partnerId:'p2',canonicalEntityId:'b'}]})})};
    const edge={sourceNodeId:hash('p1'),targetNodeId:hash('p2'),stage,total:5};
    for(const edges of [[],[0,1,4,5.5,NaN].map(total=>({...edge,total})),
      [{...edge,targetNodeId:'unpublished'}],[{...edge,targetNodeId:edge.sourceNodeId}]]){
      const service=new RegionalReportService({} as any,{} as any,partners as any,{networkResources:async()=>[row('a'),row('b')]} as any,
        {latestPublicRolling:async()=>({minimumCellSize:5,released:{edges}})} as any);
      expect((await service.ecosystem('hapcheon')).edges).toEqual([]);
    }
  });
});
