import { Injectable, Optional } from '@nestjs/common';
import {
  RuntimeContextService,
  CreateContextInput,
} from '../context/runtime-context.service';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { GraphTraversalService } from '../context/graph-traversal.service';
import {
  REGION_CONFIGS,
  RegionConfigService,
} from '../region/region-config.service';
import { requireRegionId } from '../region/regional-isolation';
import { routeNaturalLanguageIntent } from './intent-routing';
import { PlaceDiscoveryService } from './place-discovery.service';
import { ExkoSemanticAdapter } from '../exko-semantic/exko-semantic.service';
import { RegionalDataService } from '../regional-data/regional-data.service';
import { GuideService } from '../guide/guide.service';
import { INITIAL_CORE_DESTINATIONS } from '../copilot/core-destination.config';

export function isGuideExplanationQuestion(message = '') {
  if (/지도에서.{0,30}(?:찾아|보여|안내|길)/.test(message)) return false;
  return /(?:Regional\s*(?:Copilot|Manager)|RDM|지역\s*(?:코파일럿|매니저)|ChatGPT|챗(?:GPT|지피티)|Gemini|T맵|티맵|TMAP|지도.{0,12}(?:차이|다른)|지역\s*안전.{0,12}(?:활용|도움)|관광\s*안내\s*말고|정보.{0,12}(?:믿|정확|책임|관리|고치)|틀린\s*정보|민간.{0,12}(?:운영|시작)|지자체.{0,12}(?:없이|꼭|해야)|군청.{0,8}(?:해야|운영)|홈페이지|웹사이트)/i.test(message);
}

/**
 * Very small keyword check: does the visitor's free-text message look like
 * a request for *real-world, location-anchored* nearby dining options
 * ("주변 식당", "건강식 식당 추천해주세요", "밥 먹을 곳" 등)? The domain
 * ontology only knows about Gajo's own registered Program/Facility
 * individuals, so this class of request is answered by a separate,
 * GPS-anchored `/api/nearby/restaurants` lookup (Kakao Local API) rather
 * than graph traversal. We surface a `nearbyRestaurantIntent: true` flag
 * on the chat response so the frontend can prompt for location permission
 * and show the real nearby-restaurant finder UI alongside the ontology
 * based itinerary answer.
 */
function detectNearbyDiscovery(message?: string): {
  intent: boolean;
  category?: string;
} {
  if (!message) return { intent: false };
  const entries: [string, RegExp][] = [
    [
      'LODGING',
      /숙박|숙소|호텔|모텔|펜션|민박|한옥|리조트|글램핑|캠핑|야영|오토\s*캠핑|카라반|자연\s*휴양림/,
    ],
    ['CAFE', /카페|커피|다방/],
    ['GOLF_SCREEN_GOLF', /스크린\s*골프|골프연습장/],
    ['HOT_SPRING_WELLNESS', /온천|사우나|찜질|스파/],
    ['ACTIVITY', /놀거리|체험|레저/],
    ['TOURISM_NATURE', /산책|관광|공원|명소/],
    ['CONVENIENCE_STORE', /편의점/],
    ['MART_SUPERMARKET', /마트|슈퍼마켓|슈퍼(?!맨)|식료품점/],
    ['PUBLIC_TOILET', /공중\s*화장실|화장실/],
    ['HEAT_SHELTER', /무더위\s*쉼터|폭염.{0,8}(?:쉼터|쉬|쉴)|너무\s*더워|더워(?:요|서|하|해)|더위.{0,8}(?:쉬|쉴)|가까운\s*쉼터/],
    ['PARKING', /주차장|주차|차\s*(?:어디|를?)\s*(?:세워|대)/],
    ['GAS_STATION', /주유소|기름\s*(?:넣|부족)/],
    ['EV_CHARGER', /전기차\s*충전|EV\s*충전|충전소/i],
    ['TOURIST_INFORMATION', /관광\s*안내소|관광\s*안내\s*(?:받|할)\s*(?:곳|데)/],
    [
      'ESSENTIAL_SHOPPING',
      /장\s*볼|생필품|물(?:하고|이랑|과)?\s*과자|음료수?\s*살|먹을\s*것\s*(?:좀\s*)?살/,
    ],
    ['CONVENIENCE', /약국|병원/],
    ['FOOD', /식당|맛집|밥\s*(먹|을)|먹을\s*(곳|데)|건강식|약선|음식점|식사/],
  ];
  const category = entries.find(([, pattern]) => pattern.test(message))?.[0];
  return {
    intent:
      !!category && /주변|근처|가까운|인근|갈\s*만한|찾아|추천|어디|있어|가능|먼저|부터/.test(message),
    category,
  };
}

/**
 * Named destinations outside the currently curated Gajo ontology must not be
 * reinterpreted as local places. Keep this deliberately narrow: it is a
 * service-area guard, not a general destination knowledge base.
 */
export function detectOutOfServiceDestination(
  message?: string,
): { destination: string; region: string } | undefined {
  if (!message || message.includes('가조')) return undefined;
  if (
    /해인사/.test(message) &&
    /합천|가고|갈래|놀러|여행|방문|관광/.test(message)
  ) {
    return { destination: '해인사', region: '합천' };
  }
  return undefined;
}

/**
 * ConciergeService: the top-level Orchestrator Agent entry point that
 * implements the full architecture pipeline from the spec:
 *
 *   User Request -> Orchestrator Agent -> Runtime Operational Ontology ->
 *   Semantic Context Generation -> Graph Traversal -> Task Decomposition ->
 *   Agent Selection -> Tool/API Execution -> Recommendation ->
 *   User-facing Concierge Response
 *
 * `chat()` is what POST /api/concierge/chat calls: it takes a raw user
 * message (+ optional structured hints), builds a RuntimeContext, runs the
 * Agent pipeline for the selected Operation, and returns an explainable,
 * user-facing concierge answer (itinerary + reason + risks + used agents +
 * confidence + next action) exactly as required by the demo scenario.
 */
@Injectable()
export class ConciergeService {
  constructor(
    private readonly contextService: RuntimeContextService,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly traversal: GraphTraversalService,
    @Optional() private readonly regionConfig?: RegionConfigService,
    @Optional() private readonly placeDiscovery?: PlaceDiscoveryService,
    @Optional() private readonly exko?: ExkoSemanticAdapter,
    @Optional() private readonly regionalData?: RegionalDataService,
    @Optional() private readonly guide?: GuideService,
  ) {}

  async chat(input: CreateContextInput) {
    const regionId = requireRegionId(input.regionId, 'Concierge chat');
    if (isGuideExplanationQuestion(input.rawMessage) && this.guide) {
      const explanation=this.guide.approvedExplanation({question:input.rawMessage});
      if(explanation)return{intentRoute:'GUIDE_EXPLANATION',guideExplanation:explanation,recommendation:null,visitorMessage:`${explanation.answer}\n\n여행을 계속할까요?`,journeyContinuation:{prompt:'여행을 계속할까요?',preserveJourney:true}};
    }
    const
      route = routeNaturalLanguageIntent(input),
      routeDetails: any = route;
    if(route.intentRoute==='FIRST_TIME_VISITOR'){
      const candidates=(INITIAL_CORE_DESTINATIONS[regionId]||[]).map(item=>({entityId:item.canonicalEntityId,label:item.displayName,category:item.expectedCategory,reason:`${regionId==='hapcheon'?'합천':regionId==='gajo'?'가조·거창':'옥천'}의 기존 Core Destination 후보로 관리되는 대표 방문지입니다.`}));
      const labels=candidates.map(x=>x.label).join(', ');
      return{intentRoute:'FIRST_TIME_VISITOR',firstTimeVisitor:{regionId,candidates,status:candidates.length?'READY':'CORE_DATA_INSUFFICIENT'},requestedDestinations:candidates.map(x=>({...x,resolved:Boolean(x.entityId),requested:true,source:'RDM'})),recommendation:candidates.length?{itinerary:{steps:candidates.map(x=>({programUri:x.entityId,programLabel:x.label,reason:x.reason,category:x.category}))}}:null,visitorMessage:candidates.length?`처음 오셨다면 기존 대표 방문지 후보인 ${labels}부터 살펴보세요. 순위를 강제로 정하지 않고, 남은 시간과 날씨에 맞춰 코스를 조정할 수 있어요.`:'현재 이 지역은 승인된 Core Destination 후보 데이터가 충분하지 않습니다. 임의로 대표 명소를 만들지 않고 지역 정보 검토가 끝난 뒤 안내할게요.'};
    }
    const newlyRequestedDestinations =
      routeDetails.explicitDestinations?.length && this.placeDiscovery
        ? await this.placeDiscovery.resolveRequestedDestinations(
            regionId,
            routeDetails.explicitDestinations,
            { latitude: input.latitude, longitude: input.longitude },
          )
        : undefined;
    const structuredJourneyDestinations = input.explicitJourney
      ?.multiDestination
      ? input.explicitJourney.requestedDestinations
      : undefined;
    const carriedRequestedDestinations =
      route.intentRoute === 'REPLAN'
        ? structuredJourneyDestinations ||
          input.mustVisitPlaces?.filter((item: any) => item.requested)
        : undefined;
    const requestedDestinations =
      newlyRequestedDestinations ||
      (carriedRequestedDestinations?.length
        ? carriedRequestedDestinations
        : undefined);
    const effectiveInput = requestedDestinations
      ? { ...input, mustVisitPlaces: requestedDestinations }
      : input;
    const { context, evidence, firedRules } =
      await this.contextService.createContext(effectiveInput);
    const nearbyDiscovery = detectNearbyDiscovery(input.rawMessage);
    const nearbyRestaurantIntent =
      nearbyDiscovery.intent && nearbyDiscovery.category === 'FOOD';
    const config = this.regionConfig?.get(regionId) || REGION_CONFIGS[regionId];
    if (!config) throw new Error(`Unknown region: ${regionId}`);
    const referenceCategory =
      route.intentRoute === 'PLACE_DISCOVERY' ||
      route.intentRoute === 'IMMEDIATE_NOW'
        ? route.category
        : undefined;
    const explicitReference = await this.placeDiscovery?.resolveReference?.(
      regionId,
      input.rawMessage || '',
      referenceCategory,
    );
    const conversationalReference = explicitReference
      ? {
          ...explicitReference,
          sourceTurnId: input.turnId || '',
          role: 'SUBJECT' as const,
        }
      : undefined;
    const outsideServiceArea =
      this.regionConfig?.detectOutOfRegion(input.rawMessage, regionId) ||
      (regionId === 'gajo'
        ? detectOutOfServiceDestination(input.rawMessage)
        : undefined);

    if (outsideServiceArea) {
      return {
        context,
        evidence,
        firedRules,
        recommendation: null,
        domainResult: {
          status: 'OUT_OF_SERVICE_AREA',
          ...outsideServiceArea,
        },
        visitorMessage: config.serviceAreaMessage,
        nearbyRestaurantIntent: false,
        nearbyDiscoveryIntent: false,
        intentRoute: route.intentRoute,
        conversationalReference,
      };
    }

    const semanticFollowup = (input as any).semanticContext,
      semanticQuery =
        input.regionId === 'okcheon' &&
        (/(정지용|옥천\s*구읍|옥천구읍|옥천다운\s*음식|생선국수|도리뱅뱅)/.test(
          input.rawMessage || '',
        ) ||
          (semanticFollowup &&
            /(관련\s*장소만|음식은\s*빼|다른\s*곳도|시간이\s*(?:한|두)\s*시간)/.test(
              input.rawMessage || '',
            )));
    if (semanticQuery && this.exko && this.regionalData) {
      const raw = input.rawMessage || '',
        followupQuery = semanticFollowup
          ? `${
              (/음식은\s*빼/.test(raw)
                ? semanticFollowup.requestedConcepts
                    ?.filter((x: any) => x.type !== 'FOOD_CONCEPT')
                    .map((x: any) => x.label)
                : semanticFollowup.anchorLabels
              )?.join(' ') || '정지용 옥천구읍'
            } ${/음식은\s*빼/.test(raw) ? '문화 장소' : raw}`
          : raw,
        dataset = await this.regionalData.effectiveDataset('okcheon'),
        semanticResult: any = this.exko.semanticJourney(
          'okcheon',
          followupQuery,
          dataset?.records || [],
          {
            weather: /비/.test(raw) ? '비' : undefined,
            elderly: /70대|어머니|어르신/.test(raw),
            remainingMinutes: /한\s*시간|1\s*시간/.test(raw)
              ? 60
              : /두\s*시간|2\s*시간/.test(raw)
                ? 120
                : undefined,
          },
        );
      return {
        context,
        evidence,
        firedRules,
        intentRoute: 'SEMANTIC_JOURNEY',
        semanticResult,
        semanticContext: {
          regionId: 'okcheon',
          anchorLabels: semanticResult.concepts.map((x: any) => x.label),
          requestedConcepts: semanticResult.concepts,
        },
        recommendation: { itinerary: { steps: semanticResult.itinerary } },
        visitorMessage: semanticResult.visitorExplanation,
        nearbyRestaurantIntent: false,
        nearbyDiscoveryIntent: false,
      };
    }

    if (route.intentRoute === 'DISTANCE_INFO' && this.placeDiscovery) {
      const distanceInfo = await this.placeDiscovery.distanceInfo(
        regionId,
        {
          ...context,
          tripContext: input.tripContext,
          excludedEntityIds: input.tripContext?.excludedEntityIds,
          ...(semanticFollowup ? { semanticContext: semanticFollowup } : {}),
        },
      );
      return {
        context,
        evidence,
        firedRules,
        recommendation: null,
        distanceInfo,
        intentRoute: route.intentRoute,
        nearbyRestaurantIntent: false,
        nearbyDiscoveryIntent: false,
        ...(semanticFollowup ? { semanticContext: semanticFollowup } : {}),
      };
    }

    if (
      route.intentRoute === 'REPLAN' &&
      route.category === 'LODGING' &&
      !input.accommodationIntents?.length
    ) {
      return {
        context,
        evidence,
        firedRules,
        recommendation: null,
        intentRoute: route.intentRoute,
        visitorMessage:
          '현재 여행에 확인된 숙소가 없습니다. 돌아갈 숙소 이름을 알려주시면 검증된 장소인지 확인해 드릴게요.',
        nearbyRestaurantIntent: false,
        nearbyDiscoveryIntent: false,
      };
    }

    if (
      (route.intentRoute === 'PLACE_DISCOVERY' ||
        route.intentRoute === 'IMMEDIATE_NOW') &&
      route.category &&
      this.placeDiscovery
    ) {
      const followup: any = route;
      const discovery = await this.placeDiscovery.discover(
        regionId,
        route.category,
        input.rawMessage || '',
        {
          ...context,
          ...(semanticFollowup ? { semanticContext: semanticFollowup } : {}),
          discoveryAlternative: followup.alternative,
          preferCloser: followup.preferCloser,
          selectionIndex: followup.selectionIndex,
        },
      );
      return {
        context,
        evidence,
        firedRules,
        recommendation: null,
        discovery,
        intentRoute: route.intentRoute,
        nearbyRestaurantIntent: false,
        nearbyDiscoveryIntent: false,
        nearbyCategory: route.category,
        ...(semanticFollowup ? { semanticContext: semanticFollowup } : {}),
      };
    }

    if (!context.operationUri) {
      return {
        context,
        evidence,
        firedRules,
        nearbyRestaurantIntent,
        nearbyDiscoveryIntent: nearbyDiscovery.intent,
        nearbyCategory: nearbyDiscovery.category,
        intentRoute: route.intentRoute,
        message:
          '적용 가능한 컨시어지 운영(Operation)을 찾지 못했습니다. 온톨로지에 gajo:ConciergeOperation을 확인해주세요.',
      };
    }

    const runResult = await this.orchestrator.run(
      context.contextNo,
      context.operationUri,
      context,
    );

    const usedAgents = Array.from(
      new Set(runResult.tasks.map((t) => t.assignedAgentUri).filter(Boolean)),
    ) as string[];

    return {
      context,
      evidence,
      firedRules,
      operation: {
        uri: context.operationUri,
        label: this.traversal.label(context.operationUri),
      },
      tasks: runResult.tasks,
      executionLog: runResult.executionLog,
      recommendation: runResult.recommendation,
      reservationCheck: runResult.reservationCheck,
      usedAgents,
      usedAgentLabels: usedAgents.map((a) => ({
        uri: a,
        label: this.traversal.label(a),
      })),
      risks: context.risks || [],
      riskLabels: (context.risks || []).map((r: string) => ({
        uri: r,
        label: this.traversal.label(r),
      })),
      confidenceScore: runResult.recommendation?.confidenceScore || 0,
      nextAction: runResult.recommendation?.nextAction || null,
      nearbyRestaurantIntent,
      nearbyDiscoveryIntent: nearbyDiscovery.intent,
      nearbyCategory: nearbyDiscovery.category,
      intentRoute: route.intentRoute,
      conversationalReference,
      ...(semanticFollowup ? { semanticContext: semanticFollowup } : {}),
      ...(requestedDestinations
        ? {
            requestedDestinations,
            visitorMessage: newlyRequestedDestinations
              ? `${requestedDestinations.map((item) => item.requestedLabel || item.label).join('과 ')}를 함께 둘러보시려는군요.`
              : this.orderingMessage(requestedDestinations),
          }
        : {}),
    };
  }

  private orderingMessage(destinations: any[]) {
    const labels = destinations
      .map((item) => item.requestedLabel || item.label)
      .join('과 ');
    const operational = destinations.every(
      (item) =>
        item.resolved &&
        Number.isFinite(item.latitude) &&
        Number.isFinite(item.longitude),
    );
    return operational
      ? `${labels} 안에서 이동 순서를 살펴봤어요.`
      : `${labels}은 그대로 유지할게요. 일부 장소의 정확한 위치가 아직 확인되지 않아 거리순 계산은 어렵습니다. 우선 말씀하신 순서대로 둘까요?`;
  }
}
