import {REGION_CONFIGS,RegionConfigService} from './region-config.service';
import {withAdditionalRegions} from './additional-regions';
import {AdminRegionsController} from '../regional-data/admin-regions.controller';
describe('data-configured additional administrative regions',()=>{
 const saved=process.env.ADDITIONAL_REGION_CONFIG_JSON;
 afterEach(()=>{if(saved===undefined)delete process.env.ADDITIONAL_REGION_CONFIG_JSON;else process.env.ADDITIONAL_REGION_CONFIG_JSON=saved;});
 it('adds a region without changing source registry or granting permission',()=>{
  process.env.ADDITIONAL_REGION_CONFIG_JSON=JSON.stringify([{id:'new-county',regionName:'신규 군',ontologyNamespace:'https://new.example/#'}]);
  expect(new RegionConfigService().get('new-county').regionName).toBe('신규 군');
  expect(REGION_CONFIGS['new-county']).toBeUndefined();
  const controller=new AdminRegionsController();
  expect(controller.list({adminPrincipal:{allowedRegionIds:['new-county']}})).toEqual([{id:'new-county',regionName:'신규 군',serviceName:'신규 군'}]);
  expect(controller.list({adminPrincipal:{allowedRegionIds:[]}})).toEqual([]);
 });
 it.each(['{','{}','[{"id":"hapcheon"}]'])('fails closed for invalid configuration %s',raw=>{
  process.env.ADDITIONAL_REGION_CONFIG_JSON=raw;
  expect(()=>withAdditionalRegions(REGION_CONFIGS)).toThrow('Invalid additional region configuration');
 });
});
