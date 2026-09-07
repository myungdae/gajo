import { RegionalDataService } from './regional-data.service';
it('projects only DB facts with read-only public lifecycle filters', async () => {
  const base={canonicalEntityId:'a',displayName:'Place',category:'FOOD',verificationStatus:'VERIFIED',lifecycleStatus:'ACTIVE',source:{sourceName:'Official'},latitude:35.5,longitude:128};
  const find=jest.fn().mockReturnValue({sort:()=>({lean:async()=>[base,
    {...base,canonicalEntityId:'b',verificationStatus:'PARTIAL',lastVerifiedAt:'2026-01-01',detectedChanges:[{unsafe:true}]},
    {...base,canonicalEntityId:'c',verificationStatus:'UNVERIFIED'}]})});
  const result=await new RegionalDataService({find} as any).networkResources('hapcheon');
  expect(find).toHaveBeenCalledWith({regionId:'hapcheon',lifecycleStatus:{$in:['ACTIVE','CHANGE_DETECTED']}});
  expect(result).toHaveLength(2);
  expect(result[0].latitude).toBe(35.5);
  expect(result[1].latitude).toBeUndefined();
});
