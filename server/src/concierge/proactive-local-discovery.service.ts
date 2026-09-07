import { Injectable, Optional } from '@nestjs/common';
import { RegionalDataService } from '../regional-data/regional-data.service';
import { LiveRuntimeHydrationService } from '../context/live-runtime-hydration.service';
import { requireRegionId } from '../region/regional-isolation';
import { selectLocalDiscovery, reviewCurrentStop } from './proactive-local-discovery';

@Injectable()
export class ProactiveLocalDiscoveryService {
  constructor(private readonly live: LiveRuntimeHydrationService, @Optional() private readonly data?: RegionalDataService) {}
  async discover(input: any) {
    const regionId = requireRegionId(input?.regionId, 'local discovery');
    if (!this.data) return { offers: [] };
    const [dataset, published] = await Promise.all([this.data.effectiveDataset(regionId), this.data.networkResources(regionId)]);
    const ids = new Set(published.map(r=>r.id));
    const records = (dataset?.records || []).filter(r=>ids.has(r.entityUri));
    // No raw conversation, client supplied operating state, or personal linkage enters hydration or the response.
    const base = {regionId,latitude:input.latitude,longitude:input.longitude,locationAccuracy:input.locationAccuracy,
      locationStatus:input.locationStatus,locationObservedAt:input.locationObservedAt,transportMode:input.transportMode,
      walkingLevel:input.walkingLevel,companionConstraints:Array.isArray(input.companionConstraints)?input.companionConstraints:[],
      companions:Array.isArray(input.companions)?input.companions:[],activityPreferences:Array.isArray(input.activityPreferences)?input.activityPreferences:[],
      stayUntil:input.stayUntil,firstVisit:input.firstVisit===true,
      accommodationIntents:Array.isArray(input.accommodationIntents)?input.accommodationIntents.filter((p:any)=>typeof p?.entityId==='string').map((p:any)=>({entityId:p.entityId})):[]};
    const live = await this.live.hydrateLiveRuntimeContext(base);
    const list=(value:unknown)=>Array.isArray(value)?value.filter(v=>typeof v==='string').slice(0,500):[];
    const trip=input.tripContext||{};
    const context={...live.context,excludedEntityIds:list(input.excludedEntityIds),tripContext:{
      currentEntityId:typeof trip.currentEntityId==='string'?trip.currentEntityId:undefined,
      nextEntityId:typeof trip.nextEntityId==='string'?trip.nextEntityId:undefined,
      excludedEntityIds:list(trip.excludedEntityIds),completedEntityIds:list(trip.completedEntityIds),skippedEntityIds:list(trip.skippedEntityIds),itineraryEntityIds:list(trip.itineraryEntityIds),
    }};
    return {...selectLocalDiscovery(records,context),review:reviewCurrentStop(records,context)};
  }
}
