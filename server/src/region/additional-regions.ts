import type {RegionConfig} from './region-config.service';

// Deployment data, not administrator input. Existing regions cannot be overridden.
export function withAdditionalRegions(builtins:Record<string,RegionConfig>):Record<string,RegionConfig>{
  const registry={...builtins};
  const raw=process.env.ADDITIONAL_REGION_CONFIG_JSON;
  if(!raw)return registry;
  let entries:any;
  try{entries=JSON.parse(raw);}catch{throw new Error('Invalid additional region configuration');}
  if(!Array.isArray(entries))throw new Error('Invalid additional region configuration');
  for(const entry of entries){
    if(!entry||typeof entry.id!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(entry.id)||registry[entry.id]||
      typeof entry.regionName!=='string'||!entry.regionName.trim()||typeof entry.ontologyNamespace!=='string'||
      !/^https?:\/\//.test(entry.ontologyNamespace))throw new Error('Invalid additional region configuration');
    registry[entry.id]={id:entry.id,regionName:entry.regionName,serviceName:entry.serviceName||entry.regionName,
      ontologyNamespace:entry.ontologyNamespace,serviceAreaMessage:'',knownPlaces:[],externalDestinations:[],
      supportedCategories:[],center:entry.center,bounds:entry.bounds};
  }
  return registry;
}
