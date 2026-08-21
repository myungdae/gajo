import { Injectable, Optional } from '@nestjs/common';
import { RegionalDataService } from '../regional-data/regional-data.service';
import type { DiscoveryCategory } from './intent-routing';
import {
  recordAccommodationType,
  requestedAccommodationType,
} from './accommodation-taxonomy';
import { ExkoSemanticAdapter } from '../exko-semantic/exko-semantic.service';
import { NearbyService, NearbyServiceError } from '../nearby/nearby.service';

const CATEGORY_MATCH: Record<DiscoveryCategory, (record: any) => boolean> = {
  CAFE: (record) => record.entityType === 'CAFE' || record.category === 'CAFE',
  FOOD: (record) =>
    record.entityType === 'RESTAURANT' || record.category === 'FOOD',
  LODGING: (record) =>
    record.entityType === 'ACCOMMODATION' ||
    /LODGING|ACCOMMODATION/.test(record.category),
  ACTIVITY: (record) =>
    /EXPERIENCE|ACTIVITY/.test(`${record.entityType} ${record.category}`),
  TOURISM_NATURE: (record) =>
    /ATTRACTION|TOURISM/.test(`${record.entityType} ${record.category}`),
  CONVENIENCE: (record) =>
    /CONVENIENCE/.test(`${record.entityType} ${record.category}`),
  CONVENIENCE_STORE: (record) =>
    /CONVENIENCE_STORE/.test(`${record.entityType} ${record.category}`) || /편의점|(?:^|\s)(?:CU|GS25)(?:\s|$)|세븐일레븐|이마트24|미니스톱/i.test(record.canonicalLabelKo || ''),
  MART_SUPERMARKET: (record) =>
    /MART|SUPERMARKET|GROCERY/.test(`${record.entityType} ${record.category}`) || /마트|슈퍼마켓|슈퍼(?!맨)|식료품점/.test(record.canonicalLabelKo || ''),
  ESSENTIAL_SHOPPING: (record) =>
    CATEGORY_MATCH.CONVENIENCE_STORE(record) || CATEGORY_MATCH.MART_SUPERMARKET(record),
  HOT_SPRING_WELLNESS: (record) =>
    /HOT_SPRING|WELLNESS|SAUNA|BATH|SPA/.test(`${record.entityType} ${record.category}`),
};

@Injectable()
export class PlaceDiscoveryService {
  constructor(
    @Optional() private readonly regionalData?: RegionalDataService,
    @Optional() private readonly exko?: ExkoSemanticAdapter,
    @Optional() private readonly nearby?: NearbyService,
  ) {}

  async discover(
    regionId: string,
    category: DiscoveryCategory,
    message: string,
    context: any,
  ) {
    const dataset = await this.regionalData?.effectiveDataset(regionId);
    if (!dataset) return { regionId, category, entities: [] };

    const requested = new Set<string>(context.activityPreferences || []);
    if (/합천호|호수|전망|풍경/.test(message)) requested.add('HAPCHEON_LAKE');
    if (/쉬|휴식|편안|부모님/.test(message)) requested.add('REST');
    requested.add(category);

    const explicitAnchor = this.resolveExplicitAnchor(dataset.records, message);
    const contextualReference = /거기|그곳|그중|그\s*(?:근처|주변|카페|식당|숙소)/.test(message);
    const supplied = context.conversationalAnchor;
    const datasetAnchor = contextualReference && supplied?.regionId === regionId
      ? dataset.records.find((record) => record.entityUri === supplied.entityId)
      : undefined;
    const candidateAnchor = contextualReference && supplied?.regionId === regionId &&
      supplied?.source === 'SEARCH' && Number.isFinite(supplied.latitude) && Number.isFinite(supplied.longitude)
      ? { entityUri: supplied.entityId, canonicalLabelKo: supplied.label, entityType: supplied.entityType, category: supplied.category, latitude: supplied.latitude, longitude: supplied.longitude }
      : undefined;
    const priorDiscovery = context.discoveryContext?.regionId === regionId ? context.discoveryContext : undefined;
    const priorAnchor = context.discoveryAlternative && priorDiscovery
      ? dataset.records.find((record) => record.entityUri === priorDiscovery.anchor?.entityId) || (priorDiscovery.anchor?.source === 'SEARCH' && Number.isFinite(priorDiscovery.anchor.latitude) && Number.isFinite(priorDiscovery.anchor.longitude) ? { entityUri: priorDiscovery.anchor.entityId, canonicalLabelKo: priorDiscovery.anchor.label, latitude: priorDiscovery.anchor.latitude, longitude: priorDiscovery.anchor.longitude } : undefined)
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
    const martFallback = category === 'CONVENIENCE_STORE' && !preferredAvailable;
    const eligibility = martFallback ? CATEGORY_MATCH.MART_SUPERMARKET : CATEGORY_MATCH[category];
    const ranked = dataset.records
      .filter(eligibility)
      .filter((record) => !anchor || record.entityUri !== anchor.entityUri)
      .filter((record) => !context.discoveryAlternative || !priorDiscovery?.shownEntityIds?.includes(record.entityUri))
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
          100 +
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
          (context.preferCloser ? (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) : b.score - a.score) ||
          (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) ||
          a.record.entityUri.localeCompare(b.record.entityUri),
      );

    let searchFallbackCategory: DiscoveryCategory = category;
    let searchCandidates = ranked.length === 0 && origin && this.nearby
      ? await this.searchFallback(regionId, category, origin, dataset.records, context.discoveryAlternative ? priorDiscovery?.shownEntityIds || [] : [])
      : [];
    if (category === 'CONVENIENCE_STORE' && ranked.length === 0 && searchCandidates.length === 0 && origin && this.nearby) {
      searchFallbackCategory = 'MART_SUPERMARKET';
      searchCandidates = await this.searchFallback(regionId, searchFallbackCategory, origin, dataset.records, context.discoveryAlternative ? priorDiscovery?.shownEntityIds || [] : []);
    }
    const usedShoppingAlternative = martFallback || searchFallbackCategory === 'MART_SUPERMARKET';

    return {
      regionId,
      category,
      anchorEntityId: anchor?.entityUri,
      anchorLabel: anchor?.canonicalLabelKo,
      anchorLatitude: anchor?.latitude,
      anchorLongitude: anchor?.longitude,
      relation: anchor ? 'NEARBY' : 'REGIONAL',
      targetCategory: category,
      categoryFallbackNotice: usedShoppingAlternative
        ? '가까운 편의점 결과가 부족해 주변 마트·슈퍼마켓도 함께 보여드렸습니다.'
        : undefined,
      referenceResolution: {
        mode: explicitAnchor ? 'EXPLICIT_ENTITY' : priorAnchor ? 'DISCOVERY_CONTEXT' : contextualAnchor ? 'CONVERSATIONAL_REFERENCE' : 'NONE',
        sourceTurnId: priorAnchor ? priorDiscovery.sourceTurnId : contextualAnchor ? supplied.sourceTurnId : undefined,
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
      searchFallback: searchCandidates.length ? {
        used: true,
        source: 'KAKAO_LOCAL',
        evidenceRetention: 'REGIONAL_CANDIDATE',
      } : undefined,
      entities: [...ranked.slice(context.selectionIndex ?? 0).map(
        ({ record, matched, distanceMeters, score }, index) => ({
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
          actions: record.actions,
          source: record.source,
          lastVerifiedAt: record.lastVerifiedAt,
          distanceMeters,
          reasons: [
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
            navigationAvailable: Boolean(record.actions?.navigate),
            tripEligible: true,
          },
        }),
      ), ...searchCandidates],
    };
  }

  private async searchFallback(regionId: string, category: DiscoveryCategory, origin: { latitude: number; longitude: number }, records: readonly any[], excludedEntityIds: readonly string[] = []) {
    try {
      const found = await this.nearby!.search(category as any, origin.latitude, origin.longitude, 2500, {}, regionId);
      return found.filter((place) => CATEGORY_MATCH[category]({ entityType: place.category, category: place.category, canonicalLabelKo: place.name })).slice(0, 5).flatMap<any>((place, index) => {
        const canonical = records.find((record) =>
          record.entityUri === place.canonicalEntityUri || this.normalize(record.canonicalLabelKo) === this.normalize(place.name),
        );
        if (canonical && CATEGORY_MATCH[category](canonical)) return [{
          entityId: canonical.entityUri, regionId, order: index + 1,
          programUri: canonical.entityUri, programLabel: canonical.canonicalLabelKo,
          facilityUri: canonical.entityUri, facilityLabel: canonical.canonicalLabelKo,
          entityType: canonical.entityType, category: canonical.category,
          description: canonical.description, address: canonical.address,
          telephone: canonical.telephone, website: canonical.website,
          reservationUrl: canonical.reservationUrl, latitude: canonical.latitude,
          longitude: canonical.longitude, actions: canonical.actions,
          source: canonical.source, lastVerifiedAt: canonical.lastVerifiedAt,
          distanceMeters: place.distanceMeters,
          reasons: ['외부 검색 후보를 검증된 지역 엔티티와 일치시켰습니다.'],
          operationalEvidence: { source: 'RDM', discoverySource: 'SEARCH', verificationStatus: canonical.runtimeDataStatus, navigationAvailable: Boolean(canonical.actions?.navigate), tripEligible: true },
        }];
        if (canonical) return [];
        return [{
          entityId: `search:${regionId}:${place.id}`, regionId, order: index + 1,
          programLabel: place.name, facilityLabel: place.name,
          entityType: 'SEARCH_CANDIDATE', category: place.category,
          address: place.roadAddress || place.address || undefined,
          latitude: place.lat, longitude: place.lng,
          distanceMeters: place.distanceMeters,
          reasons: ['지역 데이터에 없는 검색 후보입니다. 운영 정보는 방문 전에 확인해 주세요.'],
          actions: {},
          operationalEvidence: { source: 'SEARCH', verificationStatus: 'UNVERIFIED', navigationAvailable: false, tripEligible: false },
          candidateEvidence: { sourceType: 'KAKAO_LOCAL', sourceUrl: place.placeUrl || undefined, providerCategory: place.providerCategoryName, observedPhone: place.phone || undefined, observedAddress: place.roadAddress || place.address || undefined },
        }];
      }).filter((entity: any) => !excludedEntityIds.includes(entity.entityId));
    } catch (error) {
      if (error instanceof NearbyServiceError) return [];
      throw error;
    }
  }

  private resolveExplicitAnchor(records: readonly any[], message: string) {
    const normalizedMessage = this.normalize(message);
    const matches = records.flatMap((record) =>
      [record.canonicalLabelKo, ...(record.alternateLabels || [])]
        .map((label: string) => ({ record, label: this.normalize(label) }))
        .filter(
          ({ label }) => label.length > 0 && normalizedMessage.includes(label),
        ),
    );
    return matches.sort((a, b) => b.label.length - a.label.length)[0]?.record;
  }

  async resolveReference(regionId: string, message: string) {
    const dataset = await this.regionalData?.effectiveDataset(regionId);
    const record = dataset && this.resolveExplicitAnchor(dataset.records, message);
    return record ? { entityId: record.entityUri, regionId, label: record.canonicalLabelKo, entityType: record.entityType, category: record.category, latitude: record.latitude, longitude: record.longitude } : undefined;
  }

  async distanceInfo(regionId: string, context: any) {
    const discovery=context.discoveryContext;
    if(!discovery||discovery.regionId!==regionId)return{status:'NEEDS_CLARIFICATION',message:'어느 장소까지의 거리를 확인할까요?'};
    const dataset=await this.regionalData?.effectiveDataset(regionId),records=dataset?.records||[];
    const resolve=(value:any)=>{const canonical=records.find((record:any)=>record.entityUri===value?.entityId);return canonical||((value?.source==='SEARCH'&&Number.isFinite(value.latitude)&&Number.isFinite(value.longitude))?{entityUri:value.entityId,canonicalLabelKo:value.label,latitude:value.latitude,longitude:value.longitude}:undefined)};
    const from=resolve(discovery.anchor),to=resolve(discovery.currentResult),distanceMeters=this.distance(this.coordinates(from),this.coordinates(to));
    if(!from||!to||distanceMeters===undefined)return{status:'NEEDS_CLARIFICATION',message:'출발 장소가 분명하지 않아 거리를 계산하지 못했습니다. 어디에서 출발하는지 알려주세요.'};
    return{status:'RESOLVED',regionId,fromEntityId:from.entityUri,fromLabel:from.canonicalLabelKo,toEntityId:to.entityUri,toLabel:to.canonicalLabelKo,distanceMeters,calculation:'RUNTIME_HAVERSINE'};
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
