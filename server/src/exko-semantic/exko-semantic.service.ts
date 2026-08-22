import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import inventory from './generated/inventory.json';
import hapcheonSubgraph from './generated/hapcheon-subgraph.json';
import okcheonSubgraph from './generated/okcheon-subgraph.json';
import { ENTITY_ALIGNMENTS } from './exko-semantic.mapping';

type Edge = {
  subject: string;
  predicate: string;
  object: string;
  reason?: string;
  provenance?: Record<string, unknown>;
};
type SemanticNode = {
  uri: string;
  label: string;
  aliases?: string[];
  type?: string;
  regionId?: string;
  rdmEntityId?: string;
  operational?: boolean;
  provenance?: Record<string, unknown>;
};

@Injectable()
export class ExkoSemanticAdapter {
  constructor(private readonly config: ConfigService) {}
  enabled(regionId: string) {
    if (regionId === 'hapcheon')
      return this.config.get<string>('EXKO_HAPCHEON_PILOT', 'false') === 'true';
    if (regionId === 'okcheon')
      return this.config.get<string>('EXKO_OKCHEON_PILOT', 'true') === 'true';
    return false;
  }
  inventory() {
    return inventory;
  }
  getRegionalSubgraph(regionId: string): {
    entities: SemanticNode[];
    edges: Edge[];
    size: Record<string, number>;
    seedUris?: string[];
  } {
    if (!this.enabled(regionId))
      return { entities: [], edges: [], size: { entities: 0, edges: 0 } };
    if (regionId === 'hapcheon') return hapcheonSubgraph as any;
    if (regionId === 'okcheon')
      return {
        entities: okcheonSubgraph.nodes,
        edges: okcheonSubgraph.relations,
        size: {
          entities: okcheonSubgraph.size.nodes,
          edges: okcheonSubgraph.size.relations,
        },
      };
    return { entities: [], edges: [], size: { entities: 0, edges: 0 } };
  }
  getHapcheonSubgraph(regionId: string) {
    return regionId === 'hapcheon'
      ? this.getRegionalSubgraph(regionId)
      : {
          seedUris: [],
          entities: [],
          edges: [],
          size: { entities: 0, edges: 0 },
        };
  }
  getAlignment(value: string, regionId: string) {
    return ENTITY_ALIGNMENTS.filter(
      (row) =>
        row.regionId === regionId &&
        (row.exkoUri === value || row.regionalEntityId === value),
    );
  }
  resolveSemanticEntity(value: string, regionId: string) {
    if (!this.enabled(regionId)) return [];
    const normalized = this.normalize(value);
    return this.getRegionalSubgraph(regionId).entities.filter(
      (entity) =>
        entity.uri === value ||
        [entity.label, ...(entity.aliases || [])].some(
          (label) => this.normalize(label) === normalized,
        ),
    );
  }
  getRelatedEntities(uri: string, regionId: string) {
    if (!this.enabled(regionId)) return [];
    return this.getRegionalSubgraph(regionId)
      .edges.filter((edge) => edge.subject === uri || edge.object === uri)
      .map((edge) => ({
        ...edge,
        direction: edge.subject === uri ? 'OUT' : 'IN',
        relatedUri: edge.subject === uri ? edge.object : edge.subject,
      }));
  }
  getRelationalFacets(uri: string, regionId: string) {
    return this.getRelatedEntities(uri, regionId).map((edge) => ({
      property: edge.predicate,
      direction: edge.direction,
      entity: edge.relatedUri,
      reason: edge.reason,
    }));
  }
  getInverseRelations(propertyUri: string) {
    return [
      ...new Set(
        (inventory.objectProperties as any[])
          .filter((item) => item.uri === propertyUri)
          .flatMap((item) => item.inverseOf || []),
      ),
    ];
  }
  getSemanticNeighborhood(uri: string, regionId: string, depth = 1) {
    const graph = this.getRegionalSubgraph(regionId);
    if (!this.enabled(regionId)) return { entities: [], edges: [] };
    let frontier = new Set([uri]),
      visited = new Set([uri]);
    for (let i = 0; i < Math.min(depth, 2); i++) {
      const next = new Set<string>();
      for (const edge of graph.edges)
        if (frontier.has(edge.subject) || frontier.has(edge.object))
          for (const value of [edge.subject, edge.object])
            if (!visited.has(value)) {
              visited.add(value);
              next.add(value);
            }
      frontier = next;
    }
    return {
      entities: graph.entities.filter((entity) => visited.has(entity.uri)),
      edges: graph.edges.filter(
        (edge) => visited.has(edge.subject) && visited.has(edge.object),
      ),
    };
  }
  semanticCandidates(regionId: string, regionalEntityId: string) {
    if (!this.enabled(regionId)) return this.emptyCandidates();
    const source = ENTITY_ALIGNMENTS.find(
      (row) =>
        row.regionId === regionId &&
        row.regionalEntityId === regionalEntityId &&
        ['EXACT', 'HIGH_CONFIDENCE'].includes(row.status),
    );
    if (!source) return this.emptyCandidates();
    const evidence = this.getRelatedEntities(source.exkoUri, regionId) as any[];
    const ids = [
      ...new Set(
        evidence.flatMap((edge) =>
          ENTITY_ALIGNMENTS.filter(
            (row) =>
              row.regionId === regionId &&
              row.exkoUri === edge.relatedUri &&
              ['EXACT', 'HIGH_CONFIDENCE'].includes(row.status),
          ).map((row) => row.regionalEntityId),
        ),
      ),
    ];
    return {
      resolved: true,
      alignmentStatus: source.status,
      neighborCount: evidence.length,
      regionalEntityIds: ids,
      evidence,
    };
  }
  semanticJourney(
    regionId: string,
    query: string,
    operationalRecords: readonly any[],
    context: {
      weather?: string;
      elderly?: boolean;
      remainingMinutes?: number;
    } = {},
  ) {
    const graph = this.getRegionalSubgraph(regionId);
    if (!this.enabled(regionId) || regionId !== 'okcheon')
      return {
        regionId,
        concepts: [],
        relationships: [],
        candidates: [],
        itinerary: [],
      };
    const asksJeong = /정지용|문학/.test(query),
      asksOldTown = /옥천\s*구읍|옥천구읍|구읍/.test(query),
      asksFood = /점심|음식|먹|생선국수|도리뱅뱅|정지용\s*밥상/.test(query),
      foodOnly = asksFood && !asksJeong && !asksOldTown,
      cultureOnly = /문화.*(?:곳|장소)|문화적인/.test(query) && !asksFood;
    const requestedFoodLabels = [
      /생선국수/.test(query) && '생선국수',
      /도리뱅뱅/.test(query) && '도리뱅뱅이',
      /정지용\s*밥상/.test(query) && '정지용밥상',
    ].filter(Boolean) as string[];
    const anchorUris = [
      ...(asksJeong ? ['http://sight.eventpool.kr/resource/정지용'] : []),
      ...(asksOldTown ? ['http://sight.eventpool.kr/resource/옥천구읍'] : []),
      ...(asksFood ? ['http://sight.eventpool.kr/resource/옥천군'] : []),
      ...requestedFoodLabels.map(
        (label) => `http://sight.eventpool.kr/resource/${label}`,
      ),
    ];
    const neighborhoods = anchorUris.map((uri) =>
      this.getSemanticNeighborhood(uri, regionId, 2),
    );
    const relationships = [
      ...new Map(
        neighborhoods
          .flatMap((x) => x.edges)
          .map((edge) => [
            `${edge.subject}|${edge.predicate}|${edge.object}`,
            edge,
          ]),
      ).values(),
    ];
    const reached = new Set(
      neighborhoods.flatMap((x) => x.entities.map((node) => node.uri)),
    );
    const conceptNodes = graph.entities.filter(
      (node) =>
        reached.has(node.uri) &&
        [
          'PERSON',
          'PLACE_CONCEPT',
          'FOOD_CONCEPT',
          'FESTIVAL_CONCEPT',
        ].includes(node.type || ''),
    );
    const jeongUri = 'http://sight.eventpool.kr/resource/정지용';
    const directJeongUris = new Set(
      relationships
        .filter((edge) => edge.subject === jeongUri || edge.object === jeongUri)
        .map((edge) =>
          edge.subject === jeongUri ? edge.object : edge.subject,
        ),
    );
    const semanticPlaces = graph.entities.filter(
      (node) =>
        reached.has(node.uri) &&
        Boolean(node.rdmEntityId) &&
        (!foodOnly || node.type === 'RESTAURANT') &&
        (!asksJeong ||
          asksOldTown ||
          node.type === 'RESTAURANT' ||
          directJeongUris.has(node.uri)),
    );
    const records = new Map(
      operationalRecords.map((row) => [row.entityUri, row]),
    );
    let candidates = semanticPlaces
      .filter(
        (node) =>
          node.type !== 'PLACE_CONCEPT' &&
          (!cultureOnly || node.type !== 'RESTAURANT') &&
          (asksFood || node.type !== 'RESTAURANT'),
      )
      .map((node) => {
        const record = records.get(node.rdmEntityId!);
        const reasons = relationships
          .filter(
            (edge) => edge.subject === node.uri || edge.object === node.uri,
          )
          .map((edge) => edge.reason)
          .filter(Boolean);
        return {
          semanticUri: node.uri,
          rdmEntityId: node.rdmEntityId,
          label: node.label,
          type: node.type,
          reasons: [...new Set(reasons)],
          rdmEligible: Boolean(
            record &&
            record.source &&
            record.category !== 'PLACE_CONCEPT' &&
            record.entityType !== 'AREA',
          ),
          record,
        };
      });
    const rooDecisions: string[] = [];
    if (/rain|비/.test(context.weather || '')) {
      candidates = candidates.filter((item) =>
        item.record?.tags?.includes('INDOOR'),
      );
      rooDecisions.push('비 상황에서는 INDOOR 근거가 있는 후보만 유지');
    }
    if (context.elderly)
      rooDecisions.push(
        '접근성 근거가 없어 쉬운 보행이나 무장애를 보장하지 않음',
      );
    const maxStops = context.remainingMinutes
      ? Math.max(1, Math.min(3, Math.floor(context.remainingMinutes / 40)))
      : 4;
    if (context.remainingMinutes)
      rooDecisions.push(
        `남은 ${context.remainingMinutes}분에 맞춰 후보 수를 제한`,
      );
    const itinerary = candidates
      .filter((item) => item.rdmEligible)
      .slice(0, maxStops)
      .map((item) => ({
        entityId: item.rdmEntityId,
        programLabel: item.label,
        category: item.record.category,
        semanticReasons: item.reasons,
        actions: item.record.actions || {},
        operationalEvidence: {
          source: 'RDM',
          verificationStatus: item.record.runtimeDataStatus,
          navigationAvailable: Boolean(item.record.actions?.navigate),
        },
      }));
    return {
      regionId,
      concepts: conceptNodes.map((node) => ({
        uri: node.uri,
        label: node.label,
        type: node.type,
      })),
      relationships,
      candidates: candidates.map(({ record, ...item }) => item),
      rdmRejected: candidates
        .filter((item) => !item.rdmEligible)
        .map((item) => item.rdmEntityId),
      rooDecisions,
      itinerary,
      visitorExplanation:
        asksJeong && asksFood
          ? '정지용 시인의 흔적을 따라 옥천구읍의 관련 문화공간을 둘러보고, 이후 옥천의 지역음식을 맛보는 흐름으로 구성할 수 있습니다.'
          : asksOldTown
            ? '옥천구읍 안에서 공식 근거로 연결된 역사문화 장소만 골랐습니다.'
            : '옥천의 음식 개념과 실제로 해당 음식을 취급한다고 확인된 식당을 구분해 안내합니다.',
    };
  }
  semanticDiagnostics(regionId: string, operationalRecords: readonly any[]) {
    const graph = this.getRegionalSubgraph(regionId),
      operationalIds = new Set(operationalRecords.map((x) => x.entityUri)),
      aligned = graph.entities.filter((x) => x.rdmEntityId);
    return {
      regionId,
      nodeCount: graph.entities.length,
      relationCount: graph.edges.length,
      alignedRdmEntities: aligned.filter((x) =>
        operationalIds.has(x.rdmEntityId!),
      ),
      semanticNodesWithoutRdm: graph.entities.filter((x) => !x.rdmEntityId),
      brokenAlignments: aligned.filter(
        (x) => !operationalIds.has(x.rdmEntityId!),
      ),
      unsupportedRelationships: graph.edges.filter(
        (edge) => !edge.provenance?.sourceUrl || !edge.reason,
      ),
      ambiguousAliases: graph.entities
        .flatMap((x) =>
          (x.aliases || []).map((alias) => ({ alias, uri: x.uri })),
        )
        .filter(
          (value, index, all) =>
            all.findIndex(
              (x) => this.normalize(x.alias) === this.normalize(value.alias),
            ) !== index,
        ),
      provenanceCoverage: graph.edges.length
        ? graph.edges.filter((x) => x.provenance?.sourceUrl).length /
          graph.edges.length
        : 0,
    };
  }
  private emptyCandidates() {
    return {
      resolved: false,
      alignmentStatus: 'UNRESOLVED',
      neighborCount: 0,
      regionalEntityIds: [] as string[],
      evidence: [] as Edge[],
    };
  }
  private normalize(value = '') {
    return value
      .normalize('NFKC')
      .toLocaleLowerCase('ko-KR')
      .replace(/[^0-9a-z가-힣]/g, '');
  }
}
