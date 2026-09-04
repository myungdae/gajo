import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PilotEvent, PilotEventDocument } from '../schemas/pilot-event.schema';
import { rawLinkExpiresAt } from '../regional-report/retention-policy';
const ALLOWED = new Set([
  'MY_TRIP_OPENED',
  'SAVED_TRIP_LOADED',
  'SAVED_PLACE_REMOVED',
  'FULL_ITINERARY_SAVED',
  'FULL_ITINERARY_RESTORED',
  'FULL_ITINERARY_UPDATED',
  'TRIP_RESTORED',
  'TRIP_CONTINUED',
  'NEW_TRIP_STARTED',
  'TRIP_MANAGEMENT_OPENED',
  'SAVED_PLACES_CLEARED',
  'NATURAL_LANGUAGE_ENTRY_SELECTED',
  'INTEREST_REQUESTED',
  'INTEREST_COVERED',
  'INTEREST_UNCOVERED',
  'SESSION_STARTED',
  'SESSION_RESUMED',
  'PLAN_SESSION_STARTED',
  'PLAN_COMPLETED',
  'PLAN_RESUMED',
  'NOW_SESSION_STARTED',
  'PLAN_NOW_CONTINUED',
  'RUNTIME_HYDRATED',
  'ENTRY_SOURCE',
  'QUICK_INTENT_SELECTED',
  'STRUCTURED_RECOMMENDATION_REQUESTED',
  'FREE_LANGUAGE_REQUEST',
  'INTENT_ROUTED',
  'RECOMMENDATION_SHOWN',
  'AI_RESPONSE_ACTION_SHOWN',
  'AI_NEXT_ACTION_SELECTED',
  'PLACE_DETAIL_OPENED',
  'ENTITY_DETAIL_OPENED',
  'BOOKING_HANDOFF',
  'PHONE_HANDOFF',
  'WEBSITE_HANDOFF',
  'MAP_OPENED',
  'NAVIGATION_HANDOFF',
  'ITINERARY_ADD',
  'ITINERARY_ITEM_ADDED',
  'ITINERARY_VIEWED',
  'JOURNEY_START_ACTION',
  'NEARBY_FROM_ITINERARY',
  'REPLAN_FROM_ITINERARY',
  'REPLAN_REQUESTED',
  'RETRY_ERROR',
  'SEARCH_FALLBACK_USED',
  'SEARCH_ENTITY_RESOLVED',
  'SEARCH_ENTITY_UNVERIFIED',
  'SEARCH_TO_ACTION_CONTINUED',
]);
export const ANALYTICS_EVENT_TYPES = [...ALLOWED];
export const ANALYTICS_METADATA_KEYS = new Set([
  'regionId','administrativeLevel','parentRegionId','mode','source','intent',
  'turnId','actionType','entityId','entityType','itemCount','journeyId','dayCount',
  'hasFullJourney','savedPlaceCount','clearedCount','editScope','category','provider',
  'location','candidateRegionIds','intentRoute','stage','platform','method','reason',
  'interestId',
]);
export const ANALYTICS_SOURCES = new Set([
  'appinstalled','standalone','recommendation','planning-entry','trip-management',
  'local','server','saved-itinerary','demo-weather-change','live-runtime','itinerary-summary',
]);
export const ANALYTICS_INTENTS = new Set([
  'first-time','place-now','food-now','two-hour-course','senior-comfort','rainy-day',
  'events-today','nearby','nearby-lodging','free-talk',
]);
const REGIONS=new Set(['gajo','okcheon','muan','gyeryong','hapcheon','daejeon-junggu']);
const PRIVATE_KEY=/raw|message|prompt|query|text|free.?text|anonymous.?trip|trip.?session|previous.?trip|session.?id|latitude|longitude|coordinates?|\blat\b|\blng\b/i;
const DANGEROUS_KEY=/^(?:__proto__|prototype|constructor)$/i;
const validString=(value:unknown,max=160)=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=max;
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(PilotEvent.name) private model: Model<PilotEventDocument>,
  ) {}
  async record(input: {
    eventType?: string;
    sessionId?: string;
    regionId?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!input||!validString(input.sessionId,128)||!validString(input.regionId,40)||!REGIONS.has(input.regionId!)||!input.eventType||!ALLOWED.has(input.eventType))
      return { accepted: false };
    if(input.metadata===null||input.metadata===undefined)input.metadata={};
    if(typeof input.metadata!=='object'||Array.isArray(input.metadata))return{accepted:false};
    const entries=Object.entries(input.metadata);
    if(entries.some(([key,value])=>DANGEROUS_KEY.test(key)||PRIVATE_KEY.test(key)||value===null||typeof value==='object'||!['string','number','boolean'].includes(typeof value)))return{accepted:false};
    const metadata=Object.fromEntries(entries.filter(([key])=>ANALYTICS_METADATA_KEYS.has(key)))as Record<string,string|number|boolean>;
    if(Object.values(metadata).some(value=>typeof value==='string'&&!validString(value,512)))return{accepted:false};
    if(typeof metadata.source==='string'&&!ANALYTICS_SOURCES.has(metadata.source))return{accepted:false};
    if(typeof metadata.intent==='string'&&!ANALYTICS_INTENTS.has(metadata.intent))return{accepted:false};
    if(metadata.regionId!==undefined&&metadata.regionId!==input.regionId)return{accepted:false};
    const regionId = input.regionId as string;
    metadata.regionId = regionId;
    await this.model.create({
      eventType: input.eventType,
      sessionId: input.sessionId,
      regionId,
      metadata,
      expiresAt: rawLinkExpiresAt(),
    });
    return { accepted: true };
  }
  async summary(allowedRegionIds?:string[]) {
    const rows = await this.model.find(allowedRegionIds?{regionId:{$in:allowedRegionIds}}:{}).lean();
    const count = (type: string) =>
      rows.filter((r) => r.eventType === type).length;
    const sessions = new Set(rows.map((r) => r.sessionId)).size;
    const requests =
      count('STRUCTURED_RECOMMENDATION_REQUESTED') +
      count('FREE_LANGUAGE_REQUEST');
    const recommendations = count('RECOMMENDATION_SHOWN'),
      nav = count('NAVIGATION_HANDOFF');
    const group = (type: string, key: string, all = false) =>
      Object.entries(
        rows
          .filter((r) => all || r.eventType === type)
          .reduce((a: any, r: any) => {
            const value = String(
              key === 'regionId' ? r.regionId : r.metadata?.[key] || 'direct',
            );
            a[value] = (a[value] || 0) + 1;
            return a;
          }, {}),
      ).map(([label, total]) => ({ label, total }));
    const actions =
      count('ENTITY_DETAIL_OPENED') +
      nav +
      count('BOOKING_HANDOFF') +
      count('PHONE_HANDOFF') +
      count('WEBSITE_HANDOFF');
    return {
      totalTripSessions: sessions,
      sessionsByRegion: group('', 'regionId', true),
      planSessionsStarted: count('PLAN_SESSION_STARTED'),
      planCompleted: count('PLAN_COMPLETED'),
      planResumed: count('PLAN_RESUMED'),
      nowSessionsStarted: count('NOW_SESSION_STARTED'),
      planNowContinuations: count('PLAN_NOW_CONTINUED'),
      runtimeHydrations: count('RUNTIME_HYDRATED'),
      sessionsByEntrySource: group('ENTRY_SOURCE', 'source'),
      mostUsedQuickIntents: group('QUICK_INTENT_SELECTED', 'intent'),
      structuredUsage: count('STRUCTURED_RECOMMENDATION_REQUESTED'),
      freeLanguageUsage: count('FREE_LANGUAGE_REQUEST'),
      recommendationCompletionRate: requests ? recommendations / requests : 0,
      navigationHandoffCount: nav,
      navigationHandoffRate: recommendations ? nav / recommendations : 0,
      entityDetailOpenedCount: count('ENTITY_DETAIL_OPENED'),
      bookingHandoffCount: count('BOOKING_HANDOFF'),
      phoneHandoffCount: count('PHONE_HANDOFF'),
      websiteHandoffCount: count('WEBSITE_HANDOFF'),
      recommendationActionConversionRate: recommendations
        ? actions / recommendations
        : 0,
      itineraryAddCount: count('ITINERARY_ADD')+count('ITINERARY_ITEM_ADDED'),
      journeyStartCount: count('JOURNEY_START_ACTION'),
      replanningCount: count('REPLAN_REQUESTED'),
      errorFallbackCount: count('RETRY_ERROR'),
    };
  }
}
