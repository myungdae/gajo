import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import inventory from './generated/inventory.json';
import subgraph from './generated/hapcheon-subgraph.json';
import { ENTITY_ALIGNMENTS } from './exko-semantic.mapping';
type Edge = { subject: string; predicate: string; object: string };
@Injectable()
export class ExkoSemanticAdapter {
  constructor(private readonly config: ConfigService) {}
  enabled(regionId: string) {
    return (
      regionId === 'hapcheon' &&
      this.config.get<string>('EXKO_HAPCHEON_PILOT', 'false') === 'true'
    );
  }
  inventory() {
    return inventory;
  }
  getHapcheonSubgraph(regionId: string) {
    return this.enabled(regionId)
      ? subgraph
      : {
          seedUris: [],
          entities: [],
          edges: [],
          size: { entities: 0, edges: 0 },
        };
  }
  getAlignment(value: string) {
    return ENTITY_ALIGNMENTS.filter(
      (row) => row.exkoUri === value || row.regionalEntityId === value,
    );
  }
  resolveSemanticEntity(value: string, regionId: string) {
    if (!this.enabled(regionId)) return [];
    const normalized = value
      .normalize('NFKC')
      .toLocaleLowerCase('ko-KR')
      .replace(/[^0-9a-z가-힣]/g, '');
    return subgraph.entities.filter(
      (entity) =>
        entity.uri === value ||
        entity.label
          .normalize('NFKC')
          .toLocaleLowerCase('ko-KR')
          .replace(/[^0-9a-z가-힣]/g, '') === normalized,
    );
  }
  getRelatedEntities(uri: string, regionId: string) {
    if (!this.enabled(regionId)) return [];
    return (subgraph.edges as Edge[])
      .filter((edge) => edge.subject === uri || edge.object === uri)
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
    }));
  }
  getInverseRelations(propertyUri: string) {
    return [...new Set((inventory.objectProperties as any[]).filter(
      (item) => item.uri === propertyUri,
    ).flatMap(item=>item.inverseOf||[]))];
  }
  getSemanticNeighborhood(uri: string, regionId: string, depth = 1) {
    if (!this.enabled(regionId)) return { entities: [], edges: [] };
    let frontier = new Set([uri]),
      visited = new Set([uri]);
    for (let i = 0; i < Math.min(depth, 2); i++) {
      const next = new Set<string>();
      for (const edge of subgraph.edges as Edge[])
        if (frontier.has(edge.subject) || frontier.has(edge.object)) {
          for (const value of [edge.subject, edge.object])
            if (!visited.has(value)) {
              visited.add(value);
              next.add(value);
            }
        }
      frontier = next;
    }
    return {
      entities: subgraph.entities.filter((entity) => visited.has(entity.uri)),
      edges: (subgraph.edges as Edge[]).filter(
        (edge) => visited.has(edge.subject) && visited.has(edge.object),
      ),
    };
  }
  semanticCandidates(regionId: string, regionalEntityId: string) {
    if (!this.enabled(regionId))
      return {
        resolved: false,
        alignmentStatus: 'UNRESOLVED',
        neighborCount: 0,
        regionalEntityIds: [] as string[],
        evidence: [] as Edge[],
      };
    const source = ENTITY_ALIGNMENTS.find(
      (row) =>
        row.regionalEntityId === regionalEntityId &&
        ['EXACT', 'HIGH_CONFIDENCE'].includes(row.status),
    );
    if (!source)
      return {
        resolved: false,
        alignmentStatus: 'UNRESOLVED',
        neighborCount: 0,
        regionalEntityIds: [],
        evidence: [],
      };
    const evidence = this.getRelatedEntities(source.exkoUri, regionId) as any[];
    const ids = [
      ...new Set(
        evidence.flatMap((edge) =>
          ENTITY_ALIGNMENTS.filter(
            (row) =>
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
}
