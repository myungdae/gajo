import { Injectable, Optional } from '@nestjs/common';
import { RegionalDataService } from '../regional-data/regional-data.service';
import type { DiscoveryCategory } from './intent-routing';
import {
  recordAccommodationType,
  requestedAccommodationType,
} from './accommodation-taxonomy';
import { ExkoSemanticAdapter } from '../exko-semantic/exko-semantic.service';
import { NearbyService, NearbyServiceError } from '../nearby/nearby.service';
import { CopilotService } from '../copilot/copilot.service';
import { DISCOVERY_CATEGORY_MATCH } from './discovery-eligibility';
import { RegionConfigService } from '../region/region-config.service';
import { authoritativeSafetyEvidence, safeEssentialActions, ESSENTIAL_SERVICE_TYPES } from './essential-services';

const CATEGORY_MATCH = DISCOVERY_CATEGORY_MATCH;

@Injectable()
export class PlaceDiscoveryService {
  constructor(
    @Optional() private readonly regionalData?: RegionalDataService,
    @Optional() private readonly exko?: ExkoSemanticAdapter,
    @Optional() private readonly nearby?: NearbyService,
    @Optional() private readonly copilot?: CopilotService,
    @Optional() private readonly regionConfig?: RegionConfigService,
  ) {}

  async discover(
    regionId: string,
    category: DiscoveryCategory,
    message: string,
    context: any,
  ) {
    const dataset = await this.regionalData?.effectiveDataset(regionId);
    if (!dataset) return { regionId, category, entities: [] };
    const config = this.regionConfig?.get(regionId);

    const requested = new Set<string>(context.activityPreferences || []);
    const excludedEntityIds = new Set<string>(context.excludedEntityIds || []);
    for(const preference of config?.discoveryPreferences||[])
      if(preference.pattern.test(message))requested.add(preference.tag);
    if (/쉬|휴식|편안|부모님/.test(message)) requested.add('REST');
    requested.add(category);

    const explicitMatch =
      this.resolveExplicitAnchor(dataset.records, message) ||
      this.resolveConceptAnchor(config, dataset.records, message, category);
    const explicitTarget =
      explicitMatch && !/주변|근처|가까|인근|기준/.test(message)
        ? explicitMatch
        : undefined;
    const explicitAnchor = explicitTarget ? undefined : explicitMatch;
    const contextualReference =
      /거기|그곳|그중|그\s*(?:근처|주변|카페|식당|숙소)/.test(message);
    const supplied = context.conversationalAnchor;
    const datasetAnchor =
      contextualReference && supplied?.regionId === regionId
        ? dataset.records.find(
            (record) => record.entityUri === supplied.entityId,
          )
        : undefined;
    const candidateAnchor =
      contextualReference &&
      supplied?.regionId === regionId &&
      supplied?.source === 'SEARCH' &&
      Number.isFinite(supplied.latitude) &&
      Number.isFinite(supplied.longitude)
        ? {
            entityUri: supplied.entityId,
            canonicalLabelKo: supplied.label,
            entityType: supplied.entityType,
            category: supplied.category,
            latitude: supplied.latitude,
            longitude: supplied.longitude,
          }
        : undefined;
    const priorDiscovery =
      context.discoveryContext?.regionId === regionId
        ? context.discoveryContext
        : undefined;
    const priorAnchor =
      context.discoveryAlternative && priorDiscovery
        ? dataset.records.find(
            (record) => record.entityUri === priorDiscovery.anchor?.entityId,
          ) ||
          (priorDiscovery.anchor?.source === 'SEARCH' &&
          Number.isFinite(priorDiscovery.anchor.latitude) &&
          Number.isFinite(priorDiscovery.anchor.longitude)
            ? {
                entityUri: priorDiscovery.anchor.entityId,
                canonicalLabelKo: priorDiscovery.anchor.label,
                latitude: priorDiscovery.anchor.latitude,
                longitude: priorDiscovery.anchor.longitude,
              }
            : undefined)
        : undefined;
    const contextualAnchor = datasetAnchor || candidateAnchor || priorAnchor;
    const anchor = explicitAnchor || contextualAnchor;
    // A place named in the current utterance owns the origin. If it has no
    // verified point, stale session/runtime coordinates must not replace it.
    const origin = anchor
      ? this.coordinates(anchor)
      : this.contextOrigin(context);
    const semantic =
      anchor && this.exko
        ? this.exko.semanticCandidates(regionId, anchor.entityUri)
        : {
            resolved: false,
            alignmentStatus: 'UNRESOLVED',
            neighborCount: 0,
            regionalEntityIds: [],
            evidence: [],
          };
    const semanticIds = new Set(semantic.regionalEntityIds);
    const accommodationType =
      category === 'LODGING' ? requestedAccommodationType(message) : undefined;
    const preferredAvailable = dataset.records.some(CATEGORY_MATCH[category]);
    const martFallback =
      category === 'CONVENIENCE_STORE' && !preferredAvailable;
    const eligibility = martFallback
      ? CATEGORY_MATCH.MART_SUPERMARKET
      : CATEGORY_MATCH[category];
    const ranked = dataset.records
      .filter(eligibility)
      .filter(record=>category!=='HEAT_SHELTER'||authoritativeSafetyEvidence(record))
      .filter((record) => record.runtimeDataStatus !== 'UNKNOWN')
      .filter((record) => !anchor || record.entityUri !== anchor.entityUri)
      .filter((record) => !excludedEntityIds.has(record.entityUri))
      .filter(
        (record) =>
          !context.discoveryAlternative ||
          !priorDiscovery?.shownEntityIds?.includes(record.entityUri),
      )
      .filter(
        (record) =>
          !accommodationType ||
          recordAccommodationType(record) === accommodationType,
      )
      .map((record) => {
        const matched = (record.tags || []).filter((tag: string) =>
          requested.has(tag),
        );
        const distanceMeters = this.distance(origin, this.coordinates(record));
        const score =
          (explicitTarget?.entityUri === record.entityUri ? 10000 : 100) +
          matched.length * 20 +
          (semanticIds.has(record.entityUri) ? 15 : 0) +
          (Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
            ? 1
            : 0) +
          (distanceMeters === undefined
            ? 0
            : Math.max(0, 30 - distanceMeters / 1000));
        return { record, matched, distanceMeters, score };
      })
      .sort(
        (a, b) =>
          Number(b.record.entityUri === explicitTarget?.entityUri) -
            Number(a.record.entityUri === explicitTarget?.entityUri) ||
          (context.preferCloser
            ? (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
            : b.score - a.score) ||
          (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) ||
          a.record.entityUri.localeCompare(b.record.entityUri),
      );

    let searchFallbackCategory: DiscoveryCategory = category;
    let searchCandidates =
      category !== 'HEAT_SHELTER' && ranked.length === 0 && origin && this.nearby
        ? await this.searchFallback(
            regionId,
            category,
            origin,
            dataset.records,
            context.discoveryAlternative
              ? priorDiscovery?.shownEntityIds || []
              : [],
          )
        : [];
    if (
      category === 'CONVENIENCE_STORE' &&
      ranked.length === 0 &&
      searchCandidates.length === 0 &&
      origin &&
      this.nearby
    ) {
      searchFallbackCategory = 'MART_SUPERMARKET';
      searchCandidates = await this.searchFallback(
        regionId,
        searchFallbackCategory,
        origin,
        dataset.records,
        context.discoveryAlternative
          ? priorDiscovery?.shownEntityIds || []
          : [],
      );
    }
    const usedShoppingAlternative =
      martFallback || searchFallbackCategory === 'MART_SUPERMARKET';
    for (const entity of searchCandidates.filter(
      (item: any) => item.operationalEvidence?.source === 'SEARCH',
    ))
      await this.copilot
        ?.ingestSearchCandidate({
          regionId,
          displayName: entity.programLabel,
          category: entity.category,
          entityType: entity.category,
          address: entity.candidateEvidence?.observedAddress,
          phone: entity.candidateEvidence?.observedPhone,
          latitude: entity.latitude,
          longitude: entity.longitude,
          evidence: {
            sourceType: entity.candidateEvidence?.sourceType,
            sourceUrl: entity.candidateEvidence?.sourceUrl,
            providerCategory: entity.candidateEvidence?.providerCategory,
            discoveredAt: new Date().toISOString(),
          },
        })
        .catch(() => undefined);

    return {
      regionId,
      category,
      anchorEntityId: anchor?.entityUri,
      anchorLabel: anchor?.canonicalLabelKo,
      anchorLatitude: anchor?.latitude,
      anchorLongitude: anchor?.longitude,
      relation: anchor ? 'NEARBY' : 'REGIONAL',
      targetCategory: category,
      safetyDataStatus: category === 'HEAT_SHELTER' && ranked.length === 0 ? 'DATA_INSUFFICIENT' : undefined,
      visitorMessage: category === 'HEAT_SHELTER' && ranked.length === 0
        ? '현재 이 지역에는 공식·승인된 무더위쉼터 데이터가 충분하지 않아 시설이나 길찾기를 임의로 안내하지 않습니다.'
        : undefined,
      categoryFallbackNotice: usedShoppingAlternative
        ? '가까운 편의점 결과가 부족해 주변 마트·슈퍼마켓도 함께 보여드렸습니다.'
        : undefined,
      referenceResolution: {
        mode: explicitAnchor
          ? 'EXPLICIT_ENTITY'
          : explicitTarget
            ? 'EXPLICIT_ENTITY_TARGET'
          : priorAnchor
            ? 'DISCOVERY_CONTEXT'
            : contextualAnchor
              ? 'CONVERSATIONAL_REFERENCE'
              : 'NONE',
        sourceTurnId: priorAnchor
          ? priorDiscovery.sourceTurnId
          : contextualAnchor
            ? supplied.sourceTurnId
            : undefined,
        currentTurnId: context.turnId,
        resolvedEntityId: anchor?.entityUri,
      },
      semanticDiagnostics: {
        enabled: Boolean(this.exko?.enabled(regionId)),
        entityResolved: semantic.resolved,
        alignmentStatus: semantic.alignmentStatus,
        neighborCandidates: semantic.neighborCount,
        retainedOperationalCandidates: ranked.filter((item) =>
          semanticIds.has(item.record.entityUri),
        ).length,
        affectedCandidateDiscovery: ranked.some((item) =>
          semanticIds.has(item.record.entityUri),
        ),
      },
      semanticEvidence: semantic.evidence.map((edge: any) => ({
        subject: edge.subject,
        predicate: edge.predicate,
        object: edge.object,
        source: 'EXKO',
      })),
      searchFallback: searchCandidates.length
        ? {
            used: true,
            source: 'KAKAO_LOCAL',
            evidenceRetention: 'REGIONAL_CANDIDATE',
          }
        : undefined,
      entities: this.deduplicateEntities([
        ...ranked
          .slice(context.selectionIndex ?? 0)
          .map(({ record, matched, distanceMeters, score }, index) => {
            const actions = (ESSENTIAL_SERVICE_TYPES as readonly string[]).includes(category) ? safeEssentialActions(record,config?.bounds) : record.actions;
            return ({
            entityId: record.entityUri,
            regionId,
            order: index + 1,
            programUri: record.entityUri,
            programLabel: record.canonicalLabelKo,
            facilityUri: record.entityUri,
            facilityLabel: record.canonicalLabelKo,
            entityType: record.entityType,
            category: record.category,
            accommodationType: recordAccommodationType(record),
            areaLabel: record.areaLabel,
            description: record.description,
            address: record.address,
            telephone: record.telephone,
            website: record.website,
            reservationUrl: record.reservationUrl,
            latitude: record.latitude,
            longitude: record.longitude,
            actions,
            source: record.source,
            lastVerifiedAt: record.lastVerifiedAt,
            distanceMeters,
            reasons: [
              ...(explicitTarget?.entityUri === record.entityUri
                ? ['요청한 장소명과 정확히 일치']
                : []),
              ...matched.map((tag: string) =>
                tag === 'HAPCHEON_LAKE'
                  ? '합천호 관련 맥락'
                  : tag === 'REST'
                    ? '휴식 맥락'
                    : tag === category
                      ? '요청한 장소 유형'
                      : tag,
              ),
              ...(distanceMeters !== undefined
                ? [
                    `${anchor?.canonicalLabelKo || '현재 위치'} 기준 ${distanceMeters}m`,
                  ]
                : []),
            ],
            score,
            operationalEvidence: {
              source: 'RDM',
              verificationStatus: record.runtimeDataStatus,
              runtimeDistanceCalculated: distanceMeters !== undefined,
              navigationAvailable: Boolean(actions?.navigate),
              navigationMode: (actions as any)?.navigate?.evidenceMode,
              tripEligible: true,
            },
          });}),
        ...searchCandidates,
      ]),
    };
  }

  private deduplicateEntities(entities: any[]) {
    const seen = new Set<string>();
    return entities.filter((entity) => {
      const id = entity.entityId || entity.programUri || entity.facilityUri;
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  private async searchFallback(
    regionId: string,
    category: DiscoveryCategory,
    origin: { latitude: number; longitude: number },
    records: readonly any[],
    excludedEntityIds: readonly string[] = [],
  ) {
    try {
      const found = await this.nearby!.search(
        category as any,
        origin.latitude,
        origin.longitude,
        2500,
        {},
        regionId,
      );
      return found
        .filter((place) =>
          CATEGORY_MATCH[category]({
            entityType: place.category,
            category: place.category,
            canonicalLabelKo: place.name,
          }),
        )
        .slice(0, 5)
        .flatMap<any>((place, index) => {
          const canonical = records.find(
            (record) =>
              record.entityUri === place.canonicalEntityUri ||
              this.normalize(record.canonicalLabelKo) ===
                this.normalize(place.name),
          );
          if (canonical && CATEGORY_MATCH[category](canonical))
            return [
              {
                entityId: canonical.entityUri,
                regionId,
                order: index + 1,
                programUri: canonical.entityUri,
                programLabel: canonical.canonicalLabelKo,
                facilityUri: canonical.entityUri,
                facilityLabel: canonical.canonicalLabelKo,
                entityType: canonical.entityType,
                category: canonical.category,
                description: canonical.description,
                address: canonical.address,
                telephone: canonical.telephone,
                website: canonical.website,
                reservationUrl: canonical.reservationUrl,
                latitude: canonical.latitude,
                longitude: canonical.longitude,
                actions: canonical.actions,
                source: canonical.source,
                lastVerifiedAt: canonical.lastVerifiedAt,
                distanceMeters: place.distanceMeters,
                reasons: [
                  '외부 검색 후보를 검증된 지역 엔티티와 일치시켰습니다.',
                ],
                operationalEvidence: {
                  source: 'RDM',
                  discoverySource: 'SEARCH',
                  verificationStatus: canonical.runtimeDataStatus,
                  navigationAvailable: Boolean(canonical.actions?.navigate),
                  tripEligible: true,
                },
              },
            ];
          if (canonical) return [];
          return [
            {
              entityId: `search:${regionId}:${place.id}`,
              regionId,
              order: index + 1,
              programLabel: place.name,
              facilityLabel: place.name,
              entityType: 'SEARCH_CANDIDATE',
              category: place.category,
              address: place.roadAddress || place.address || undefined,
              latitude: place.lat,
              longitude: place.lng,
              distanceMeters: place.distanceMeters,
              reasons: [
                '지역 데이터에 없는 검색 후보입니다. 운영 정보는 방문 전에 확인해 주세요.',
              ],
              actions: {},
              operationalEvidence: {
                source: 'SEARCH',
                verificationStatus: 'UNVERIFIED',
                navigationAvailable: false,
                tripEligible: false,
              },
              candidateEvidence: {
                sourceType: 'KAKAO_LOCAL',
                sourceUrl: place.placeUrl || undefined,
                providerCategory: place.providerCategoryName,
                observedPhone: place.phone || undefined,
                observedAddress:
                  place.roadAddress || place.address || undefined,
              },
            },
          ];
        })
        .filter((entity: any) => !excludedEntityIds.includes(entity.entityId));
    } catch (error) {
      if (error instanceof NearbyServiceError) return [];
      throw error;
    }
  }

  private resolveExplicitAnchor(records: readonly any[], message: string) {
    const normalizedMessage = this.normalize(message);
    const matches = records.flatMap((record) =>
      [record.canonicalLabelKo, ...(record.alternateLabels || [])]
        .map((label: string, index: number) => ({record,label:this.normalize(label),official:index===0}))
        .filter(
          ({ label }) => label.length > 0 && normalizedMessage.includes(label),
        ),
    );
    if(!matches.length)return undefined;
    const longest=Math.max(...matches.map(match=>match.label.length));
    const longestMatches=matches.filter(match=>match.label.length===longest);
    const officialMatches=longestMatches.filter(match=>match.official);
    const preferred=officialMatches.length?officialMatches:longestMatches;
    const entities=new Map(preferred.map(match=>[match.record.entityUri,match.record]));
    return entities.size===1?[...entities.values()][0]:undefined;
  }

  private exactCanonicalMatch(records:readonly any[],requestedName:string){
    const normalized=this.normalize(requestedName);
    const matching=(official:boolean)=>[...new Map(records.filter(record=>(official?[record.canonicalLabelKo]:record.alternateLabels||[]).some((label:string)=>this.normalize(label)===normalized)).map(record=>[record.entityUri,record])).values()];
    const official=matching(true);
    if(official.length===1)return{status:'RESOLVED' as const,record:official[0]};
    if(official.length>1)return{status:'AMBIGUOUS' as const,records:official};
    const aliases=matching(false);
    if(aliases.length===1)return{status:'RESOLVED' as const,record:aliases[0]};
    if(aliases.length>1)return{status:'AMBIGUOUS' as const,records:aliases};
    return undefined;
  }

  private resolveConceptAnchor(config:any,records:readonly any[],message:string,category:DiscoveryCategory){
    const normalized=this.normalize(message);
    const concept=config?.placeConcepts?.find((item:any)=>[item.label,...(item.aliases||[])].some((label:string)=>normalized.includes(this.normalize(label))));
    const relation=concept?.relations?.find((item:any)=>item.categories.includes(category));
    return relation?records.find(record=>record.entityUri===relation.entityId):undefined;
  }

  async resolveReference(regionId: string, message: string, category?:DiscoveryCategory) {
    const dataset = await this.regionalData?.effectiveDataset(regionId);
    const record =
      dataset && (this.resolveExplicitAnchor(dataset.records, message) ||
        (category?this.resolveConceptAnchor(this.regionConfig?.get(regionId),dataset.records,message,category):undefined));
    return record
      ? {
          entityId: record.entityUri,
          regionId,
          label: record.canonicalLabelKo,
          entityType: record.entityType,
          category: record.category,
          latitude: record.latitude,
          longitude: record.longitude,
        }
      : undefined;
  }

  async resolveExactPlaceIntent(regionId: string, message: string) {
    if (/주변|근처|가까|인근|기준/.test(message)) return undefined;
    const requestedName = message
      .replace(/(?:을|를|에)?\s*(?:찾아\s*줘|찾아줘|알려\s*줘|알려줘|보여\s*줘|보여줘|어디(?:야|예요|에요|인가요)?)[.!?\s]*$/u, '')
      .trim();
    if (!requestedName) return undefined;
    const dataset = await this.regionalData?.effectiveDataset(regionId);
    const match=dataset&&this.exactCanonicalMatch(dataset.records,requestedName);
    if(!match)return undefined;
    if(match.status==='AMBIGUOUS')return{status:'AMBIGUOUS' as const,candidates:match.records.map(record=>({entityId:record.entityUri,label:record.canonicalLabelKo}))};
    const record=match.record;
    const category = (Object.keys(CATEGORY_MATCH) as DiscoveryCategory[]).find(
      (candidate) => CATEGORY_MATCH[candidate](record),
    );
    return category
      ? {
          status: 'RESOLVED' as const,
          category,
          entityId: record.entityUri,
          label: record.canonicalLabelKo,
        }
      : undefined;
  }

  async resolveRequestedDestinations(regionId:string,labels:string[],context:any={}){
    const dataset=await this.regionalData?.effectiveDataset(regionId),config=this.regionConfig?.get(regionId),bounds=config?.bounds;
    const inside=(place:any)=>Boolean(bounds&&place.lat<=bounds.north&&place.lat>=bounds.south&&place.lng<=bounds.east&&place.lng>=bounds.west);
    const result=[] as any[];
    for(const label of labels){
      const concept=config?.placeConcepts?.find(item=>[item.label,...(item.aliases||[])].some(name=>this.normalize(name)===this.normalize(label)));
      if(concept){result.push({entityId:concept.entityId,label:concept.label,requestedLabel:label,resolved:false,requested:true,source:'SEMANTIC',category:concept.category,entityType:concept.entityType,verificationStatus:'UNVERIFIED',semanticRelations:concept.relations});continue}
      const canonicalMatch=dataset&&this.exactCanonicalMatch(dataset.records,label);
      if(canonicalMatch?.status==='AMBIGUOUS'){result.push({label,requestedLabel:label,resolved:false,requested:true,source:'SEMANTIC',verificationStatus:'UNVERIFIED',ambiguity:{candidateEntityIds:canonicalMatch.records.map(record=>record.entityUri)}});continue}
      const canonical=canonicalMatch?.status==='RESOLVED'?canonicalMatch.record:undefined;
      if(canonical){result.push({entityId:canonical.entityUri,label:canonical.canonicalLabelKo,requestedLabel:label,resolved:true,requested:true,source:'RDM',category:canonical.category,entityType:canonical.entityType,latitude:canonical.latitude,longitude:canonical.longitude,verificationStatus:canonical.runtimeDataStatus});continue}
      let searched:any;
      try{const found=await (this.nearby as any)?.searchByKeyword?.(label,regionId,this.contextOrigin(context));searched=found?.find((place:any)=>inside(place)&&(this.normalize(place.name).includes(this.normalize(label))||this.normalize(label).includes(this.normalize(place.name))))}catch(error){if(!(error instanceof NearbyServiceError))throw error}
      if(searched){const destination={entityId:`search:${regionId}:${searched.id}`,label:searched.name,requestedLabel:label,resolved:false,requested:true,source:'SEARCH',category:searched.category==='OTHER'?'TOURISM_NATURE':searched.category,entityType:'SEARCH_CANDIDATE',latitude:searched.lat,longitude:searched.lng,verificationStatus:'UNVERIFIED',evidence:{sourceType:'KAKAO_LOCAL',sourceUrl:searched.placeUrl,providerCategory:searched.providerCategoryName,demandSignal:'EXPLICIT_DESTINATION_REQUEST'}};result.push(destination);await this.copilot?.ingestSearchCandidate({regionId,displayName:searched.name,category:destination.category,entityType:destination.entityType,address:searched.roadAddress||searched.address,phone:searched.phone,latitude:searched.lat,longitude:searched.lng,evidence:{...destination.evidence,discoveredAt:new Date().toISOString()}}).catch(()=>undefined);continue}
      const semantic=config?.semanticDestinations?.find(item=>[item.label,...(item.aliases||[])].some(name=>this.normalize(name)===this.normalize(label)));
      result.push(semantic?{entityId:semantic.entityId,label:semantic.label,requestedLabel:label,resolved:false,requested:true,source:'SEMANTIC',category:semantic.category,entityType:semantic.entityType,verificationStatus:'UNVERIFIED'}:{label,requestedLabel:label,resolved:false,requested:true,source:'SEMANTIC',verificationStatus:'UNVERIFIED'});
    }
    return result;
  }

  async distanceInfo(regionId: string, context: any) {
    const discovery = context.discoveryContext;
    if (!discovery || discovery.regionId !== regionId)
      return {
        status: 'NEEDS_CLARIFICATION',
        message: '어느 장소까지의 거리를 확인할까요?',
      };
    const dataset = await this.regionalData?.effectiveDataset(regionId),
      records = dataset?.records || [];
    const resolve = (value: any) => {
      const canonical = records.find(
        (record: any) => record.entityUri === value?.entityId,
      );
      return (
        canonical ||
        (value?.source === 'SEARCH' &&
        Number.isFinite(value.latitude) &&
        Number.isFinite(value.longitude)
          ? {
              entityUri: value.entityId,
              canonicalLabelKo: value.label,
              latitude: value.latitude,
              longitude: value.longitude,
            }
          : undefined)
      );
    };
    const from = resolve(discovery.anchor),
      to = resolve(discovery.currentResult),
      distanceMeters = this.distance(
        this.coordinates(from),
        this.coordinates(to),
      );
    if (!from || !to || distanceMeters === undefined)
      return {
        status: 'NEEDS_CLARIFICATION',
        message:
          '출발 장소가 분명하지 않아 거리를 계산하지 못했습니다. 어디에서 출발하는지 알려주세요.',
      };
    return {
      status: 'RESOLVED',
      regionId,
      fromEntityId: from.entityUri,
      fromLabel: from.canonicalLabelKo,
      toEntityId: to.entityUri,
      toLabel: to.canonicalLabelKo,
      distanceMeters,
      calculation: 'RUNTIME_HAVERSINE',
    };
  }

  private normalize(value: string) {
    return value.replace(/\s/g, '').toLocaleLowerCase('ko-KR');
  }

  private contextOrigin(context: any) {
    return Number.isFinite(context.latitude) &&
      Number.isFinite(context.longitude)
      ? { latitude: context.latitude, longitude: context.longitude }
      : undefined;
  }

  private coordinates(record: any) {
    return Number.isFinite(record?.latitude) &&
      Number.isFinite(record?.longitude)
      ? { latitude: record.latitude, longitude: record.longitude }
      : undefined;
  }

  private distance(
    a?: { latitude: number; longitude: number },
    b?: { latitude: number; longitude: number },
  ) {
    if (!a || !b) return undefined;
    const rad = (value: number) => (value * Math.PI) / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLng = rad(b.longitude - a.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.latitude)) *
        Math.cos(rad(b.latitude)) *
        Math.sin(dLng / 2) ** 2;
    return Math.round(6371000 * 2 * Math.asin(Math.sqrt(h)));
  }
}
