import { REGION_PLACE_SUGGESTIONS } from './regionConfig.ts';
export interface RegionalEntityResult{id:string;label:string;aliases?:string[]}
export interface RegionalEntitySearch{search(query:string,limit?:number):Promise<RegionalEntityResult[]>}
export class ConfigRegionalEntitySearch implements RegionalEntitySearch{private entities:RegionalEntityResult[];constructor(entities:RegionalEntityResult[]=REGION_PLACE_SUGGESTIONS){this.entities=entities}async search(query:string,limit=6){const needle=query.trim().replace(/\s/g,'').toLowerCase();if(!needle)return[];return this.entities.filter(entity=>[entity.label,...(entity.aliases||[])].some(value=>value.replace(/\s/g,'').toLowerCase().includes(needle))).slice(0,limit)}}
// Replace this adapter with an HTTP implementation when a region's master data is too large for client configuration.
export const regionalEntitySearch:RegionalEntitySearch=new ConfigRegionalEntitySearch();
