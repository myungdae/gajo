export type PlaceNode = { id: string; label: string; kind: string; status: string; area: string; sourceName: string };
export type EvidenceLevel = 'RESOURCE_RELATIONSHIP' | 'INTEREST' | 'MOVEMENT_INTENT' | 'VERIFIED_USE';
export type NetworkEdge = { source: string; target: string; relation: string; evidenceLevel?: EvidenceLevel; basis: string; total?: number };
export type Ecosystem = {
  status: string; nodes: PlaceNode[]; edges: NetworkEdge[];
  counts: { total: number; verified: number; byKind: Record<string, number> };
  runtimeSignals: string[]; actionPath: string[]; outcomePath: string[];
  usage?: { status: string; start?: string; endExclusive?: string; minimumCellSize: number };
};
export const GROUPS = [['ATTRACTION', '관광·체험'], ['FESTIVAL', '축제'], ['FOOD', '음식점'], ['CAFE', '카페'], ['STAY', '숙박']] as const;
export type Filter = 'ALL' | EvidenceLevel;
export const evidenceLevel = (edge: NetworkEdge): EvidenceLevel | undefined => edge.evidenceLevel ||
  (edge.relation === 'ACTUAL_USAGE' ? 'VERIFIED_USE' :
  edge.relation === 'INTEREST' || edge.relation === 'MOVEMENT_INTENT' ? edge.relation :
  ['NEARBY', 'EXPLICIT_RELATED', 'SAME_THEME', 'SAME_AREA'].includes(edge.relation) ? 'RESOURCE_RELATIONSHIP' : undefined);
export const EVIDENCE_LABELS = { RESOURCE_RELATIONSHIP: '자원 관계', INTEREST: '관심 행동', MOVEMENT_INTENT: '이동 의도', VERIFIED_USE: '검증 이용' };
export function filteredEdges(data: Ecosystem, filter: Filter) {
  const ids = new Set(data.nodes.map(n => n.id));
  return data.edges.filter(e => ids.has(e.source) && ids.has(e.target) &&
    (filter === 'ALL' || evidenceLevel(e) === filter));
}
export const relationLabel = (edge: NetworkEdge) => EVIDENCE_LABELS[evidenceLevel(edge)!] || '근거 미분류';
