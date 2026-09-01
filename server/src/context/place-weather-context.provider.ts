import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {LiveRuntimeHydrationService} from './live-runtime-hydration.service';
import {LiveWeatherProviderService} from './live-weather-provider.service';
import type {NormalizedWeatherObservation} from './runtime-context.types';

type CachedObservation={expiresAt:number;observation:NormalizedWeatherObservation};

@Injectable()
export class PlaceWeatherContextProvider{
  private readonly cache=new Map<string,CachedObservation>();
  constructor(private readonly weather:LiveWeatherProviderService,private readonly hydration:LiveRuntimeHydrationService,private readonly config:ConfigService){}

  async contextsForRecords(regionId:string,records:readonly any[],baseContext:any={},now=new Date()){
    const result=new Map<string,any>(),pending=new Map<string,Promise<NormalizedWeatherObservation|undefined>>(),assignments:Array<{entityUri:string;request:Promise<NormalizedWeatherObservation|undefined>;latitude:number;longitude:number}>=[],limit=this.positiveInteger('PLACE_WEATHER_MAX_CALLS_PER_REQUEST',3),ttlMs=this.positiveInteger('PLACE_WEATHER_CACHE_TTL_MS',300000),cacheLimit=this.positiveInteger('PLACE_WEATHER_CACHE_MAX_ENTRIES',512),timeoutMs=this.positiveInteger('PLACE_WEATHER_TIMEOUT_MS',1200);
    let externalCalls=0;
    for(const record of records){
      if(!this.needsWeather(record)||!Number.isFinite(record.latitude)||!Number.isFinite(record.longitude))continue;
      const key=this.coordinateKey(regionId,record.latitude,record.longitude),cached=this.cache.get(key);
      if(cached&&cached.expiresAt>now.getTime()){result.set(record.entityUri,this.hydrate(regionId,record.latitude,record.longitude,baseContext,cached.observation,now,timeoutMs));continue;}
      let request=pending.get(key);
      if(!request){
        if(externalCalls>=limit)continue;
        externalCalls+=1;
        request=this.load(regionId,record.latitude,record.longitude,now,timeoutMs,ttlMs,cacheLimit,key);
        pending.set(key,request);
      }
      assignments.push({entityUri:record.entityUri,request,latitude:record.latitude,longitude:record.longitude});
    }
    await Promise.all(assignments.map(async item=>{const observation=await item.request;if(observation)result.set(item.entityUri,this.hydrate(regionId,item.latitude,item.longitude,baseContext,observation,now,timeoutMs));}));
    return result;
  }

  private async load(regionId:string,latitude:number,longitude:number,now:Date,timeoutMs:number,ttlMs:number,cacheLimit:number,key:string){
    try{
      const request={regionId,latitude,longitude,accuracy:0,gpsAllowed:true,timeoutMs},observation=await this.weather.getCurrent(request);
      if(observation.status!=='LIVE'||observation.stale||observation.source!=='OPEN_METEO')return undefined;
      for(const[cachedKey,cached]of this.cache)if(cached.expiresAt<=now.getTime())this.cache.delete(cachedKey);
      while(this.cache.size>=cacheLimit)this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key,{expiresAt:now.getTime()+ttlMs,observation});
      return observation;
    }catch{return undefined;}
  }

  private hydrate(regionId:string,latitude:number,longitude:number,baseContext:any,observation:NormalizedWeatherObservation,now:Date,timeoutMs:number){return this.hydration.hydrate(baseContext,observation,now,{regionId,latitude,longitude,accuracy:0,gpsAllowed:true,timeoutMs}).context;}

  private needsWeather(record:any){return(record.operationalTips||[]).some((tip:any)=>tip.realtimeRequired&&Boolean(tip.trigger?.weather||tip.trigger?.temperatureAtMost!==undefined||tip.trigger?.temperatureAtLeast!==undefined||tip.trigger?.windSpeedAtLeast!==undefined));}
  private coordinateKey(regionId:string,latitude:number,longitude:number){return`${regionId}:${Number(latitude).toFixed(4)}:${Number(longitude).toFixed(4)}`;}
  private positiveInteger(key:string,fallback:number){const value=Number(this.config.get(key));return Number.isInteger(value)&&value>0?value:fallback;}
}
