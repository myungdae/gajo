import { DecisionPipelineService, type DecisionCandidate } from '../recommendation/decision-pipeline.service';
import { EntityLocationService } from '../context/entity-location.service';
import type { RegionalCandidateRecord } from '../regions/regional-candidate.registry';

const minutes = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d/.test(value) ? Number(value.slice(0,2))*60+Number(value.slice(3,5)) : undefined;
// Accept only the existing structured master-data hours contract. Free text is not parsed into an opening claim.
function opening(record: RegionalCandidateRecord, context: any) {
  if (!Array.isArray(record.operatingHours)) return undefined;
  const month = Number(context.currentDate?.slice(5,7));
  const periods = record.operatingHours.filter(p => Array.isArray(p.days) && p.days.includes(String(context.dayOfWeek).toUpperCase()) &&
    (!p.validMonths || p.validMonths.includes(month)));
  const now = minutes(context.currentTime);
  return periods.find(p => now !== undefined && minutes(p.openTime) !== undefined && minutes(p.closeTime) !== undefined && now >= minutes(p.openTime)! && now < minutes(p.closeTime)!);
}
export function reviewCurrentStop(records: readonly RegionalCandidateRecord[], context:any) {
  const id=context.tripContext?.currentEntityId || context.tripContext?.nextEntityId;
  const record=records.find(r=>r.entityUri===id);
  if(!record)return undefined;
  if(Array.isArray(record.operatingHours)&&record.operatingHours.length&&!opening(record,context))return '등록된 운영시간과 맞지 않을 수 있어 다음 장소를 다시 살펴보세요.';
  if(context.weatherObservation?.status==='LIVE'&&!context.weatherObservation?.stale&&/RAIN|SNOW|THUNDER/.test(context.weatherState||'')&&record.tags.includes('TOURISM_NATURE')&&!record.tags.includes('INDOOR'))return '비나 눈이 있어 야외 일정 대신 실내 경험을 살펴볼 수 있어요.';
  return undefined;
}
export function selectLocalDiscovery(records: readonly RegionalCandidateRecord[], context: any, now = new Date()) {
  const empty = { offers: [] as any[] };
  const observed = Date.parse(context.locationObservedAt || '');
  if (context.locationStatus !== 'AVAILABLE' || !Number.isFinite(context.latitude) || !Number.isFinite(context.longitude) ||
    Math.abs(context.latitude)>90 || Math.abs(context.longitude)>180 || !Number.isFinite(context.locationAccuracy) || context.locationAccuracy>200 ||
    !Number.isFinite(observed) || now.getTime()-observed>30*60000 || observed>now.getTime()+60000 ||
    !['WALK','CAR'].includes(context.transportMode) || minutes(context.stayUntil) === undefined) return empty;
  const excluded = new Set([...(context.tripContext?.excludedEntityIds || []), ...(context.tripContext?.completedEntityIds || []),
    ...(context.tripContext?.skippedEntityIds || []), ...(context.tripContext?.itineraryEntityIds || []), ...(context.excludedEntityIds || [])]);
  const requested = new Set(context.activityPreferences || []);
  const anchorIds = new Set([...(context.tripContext?.itineraryEntityIds || []), ...(context.accommodationIntents || []).map((p:any)=>p.entityId)]);
  const genericTags = new Set(['FOOD','CAFE','ACCOMMODATION','ACTIVITY','REST','INDOOR','TOURISM_NATURE','FAMILY_TRIP','MUST_EXPERIENCE']);
  const anchorThemes = new Set(records.filter(r=>anchorIds.has(r.entityUri)).flatMap(r=>r.tags.filter(t=>!genericTags.has(t))));
  const representative = (r:RegionalCandidateRecord) => r.representativeAnchor === true || r.tags.includes('MUST_EXPERIENCE');
  const locations = new EntityLocationService({} as any);
  const origin = { latitude: context.latitude, longitude: context.longitude };
  const rainy = /RAIN|SNOW|THUNDER/.test(context.weatherState || '');
  const weatherKnown = context.weatherObservation?.status === 'LIVE' && !context.weatherObservation?.stale;
  const limited = context.walkingLevel === 'LOW' || (context.companionConstraints || []).some((c:string)=>/limitedMobility|shortWalking|wheelchair/.test(c));
  const withChildren = (context.companions || []).some((c:any)=>c.relationship==='child');
  const next = records.find(r=>r.entityUri===context.tripContext?.nextEntityId);
  const candidates: DecisionCandidate[] = [];
  const originals = new Map(records.map(r=>[r.entityUri,r]));
  for (const r of records) {
    if (excluded.has(r.entityUri) || r.runtimeDataStatus!=='VERIFIED' || r.accessStatus==='NEEDS_VERIFICATION' ||
      !r.actions?.navigate || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude) ||
      /FESTIVAL|EXHIBITION/.test(r.category) || r.reservationUrl || (r.closureDays && (!Array.isArray(r.closureDays) || r.closureDays.length))) continue;
    const tags = r.tags || [], indoor = tags.includes('INDOOR');
    if ((!weatherKnown || rainy) && !indoor) continue;
    const access = r.accessibility as any, walking = r.walkingAccess as any;
    if (limited && access?.wheelchairAccessible !== true && walking?.shortWalkingDistance !== true) continue;
    if (withChildren && !tags.includes('FAMILY_TRIP') && !tags.includes('FAMILY_EXPERIENCE')) continue;
    const duration = walking?.durationMinutes;
    if (!Number.isFinite(duration) || duration<=0) continue;
    const period = opening(r, context);
    if (!period) continue;
    const distance = locations.distance(origin, {latitude:r.latitude!,longitude:r.longitude!});
    if (distance.distanceMeters! > (context.transportMode==='WALK'?1500:8000)) continue;
    // Conservative straight-line proxy for screening; never advertised as a routed travel time.
    const travel = locations.estimateTravelMinutes(distance.distanceMeters! * 2, context.transportMode)! + 10;
    if (next && Number.isFinite(next.latitude) && Number.isFinite(next.longitude)) {
      const detour = distance.distanceMeters! + locations.distance({latitude:r.latitude!,longitude:r.longitude!},{latitude:next.latitude!,longitude:next.longitude!}).distanceMeters! -
        locations.distance(origin,{latitude:next.latitude!,longitude:next.longitude!}).distanceMeters!;
      if (detour>(context.transportMode==='WALK'?800:3000)) continue;
    }
    const matches = tags.filter(tag=>requested.has(tag));
    const valuable = (context.firstVisit===true && representative(r)) || (rainy && indoor) || matches.length>0 || tags.some(t=>anchorThemes.has(t));
    if (!valuable) continue;
    candidates.push({programUri:r.entityUri,programLabel:r.canonicalLabelKo,regionId:context.regionId,
      matchedOn:matches,matchedLabels:[],mitigatesRisk:[],mitigationLabels:[],requiredMobility:[],affectedByEnvironment:[],
      durationMinutes:duration,requiresReservation:false,isIndoor:indoor,isAccessible:access?.wheelchairAccessible===true,
      ...distance,estimatedTravelMinutes:travel,runtime:{entityUri:r.entityUri,operatingState:'OPEN',closingTime:period.closeTime}});
  }
  const decision = new DecisionPipelineService().run(candidates, {currentTime:context.currentTime,stayUntil:context.stayUntil,
    environmentConditions:rainy?['rainyWeather']:[],expandedConditions:context.companionConstraints||[],walkingLevel:context.walkingLevel,
    latitude:context.latitude,longitude:context.longitude,transportMode:context.transportMode});
  const ranked = decision.ranked.sort((a,b)=> {
    const priority=(c:DecisionCandidate)=>(c.score||0)+(context.firstVisit===true&&representative(originals.get(c.programUri)!)?5:0);
    return priority(b)-priority(a);
  });
  return { offers: ranked.slice(0,3).map(c=>{
    const r=originals.get(c.programUri)!;
    return { entityId:r.entityUri,regionId:context.regionId,label:r.canonicalLabelKo,category:r.category,
      latitude:r.latitude,longitude:r.longitude,actions:r.actions,
      reason: rainy?'비나 눈이 오는 지금, 실내에서 즐길 수 있는 경험도 살펴봤어요.':context.firstVisit===true&&representative(r)?'첫 방문에 살펴볼 만한 지역 대표 경험을 찾았어요.':r.tags.some(t=>anchorThemes.has(t))?'예정된 장소와 같은 지역 테마를 가진 경험도 가까이 있어요.':'말씀하신 관심사와 가까운 곳에서 함께 즐길 경험을 찾았어요.',
      detail:`직선거리 약 ${c.distanceMeters}m · 등록된 관람 시간과 운영시간을 기준으로 검토했어요. 실제 이동 경로와 당일 운영은 출발 전에 확인해 주세요.`,
    };
  }) };
}
