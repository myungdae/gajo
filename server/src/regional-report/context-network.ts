export const EVIDENCE_INTERPRETATION = {
  RESOURCE_RELATIONSHIP: '자원 데이터에 근거한 관계입니다. 관광객 행동 성과를 의미하지 않습니다.',
  INTEREST: '추천 노출 또는 상세 열람이 관측되었습니다. 실제 방문·이용을 의미하지 않습니다.',
  MOVEMENT_INTENT: '길찾기 또는 이동 시작, 전화·예약·홈페이지 연결 행동이 관측되었습니다. 실제 방문·식사·구매를 의미하지 않습니다.',
  VERIFIED_USE: '현장 검증 기준을 충족한 이용 관계입니다. 업소 QR 유입 이후 다른 업소의 검증 혜택 이용이며, 이동 경로·식사·매출을 증명하지 않습니다.',
};
export type EvidenceLevel = keyof typeof EVIDENCE_INTERPRETATION;
export type NetworkResource = {
  id: string; label: string; category?: string; status: string; area: string;
  sourceName: string; latitude?: number; longitude?: number;
};
const kinds: Record<string, string> = {
  FOOD: 'FOOD', RESTAURANT: 'FOOD', CAFE: 'CAFE', ACCOMMODATION: 'STAY',
  LODGING: 'STAY', STAY: 'STAY', FESTIVAL: 'FESTIVAL', FESTIVAL_EXHIBITION: 'FESTIVAL',
  ATTRACTION: 'ATTRACTION', TOURIST_ATTRACTION: 'ATTRACTION', TOURISM_NATURE: 'ATTRACTION',
  EXPERIENCE: 'ATTRACTION', ACTIVITY: 'ATTRACTION', TOURISM: 'ATTRACTION',
  CULTURE_HISTORY: 'ATTRACTION',
  GEO_TOURISM: 'ATTRACTION', CULTURE: 'ATTRACTION', LEISURE_SPORTS: 'ATTRACTION',
  TOURISM_CULTURE: 'ATTRACTION', HAPCHEON_LAKE: 'ATTRACTION',
};
export function contextNetwork(resources: NetworkResource[]) {
  const records = [...new Map(resources.filter(r => r.id && r.label && kinds[r.category || ''])
    .map(r => [r.id, r])).values()];
  const nodes = records.map(({ latitude, longitude, category, ...row }) => ({ ...row, kind: kinds[category!] }));
  const edges: Array<{ source: string; target: string; relation: string; evidenceLevel: EvidenceLevel; basis: string; total?: number }> = [];
  const valid = (r: NetworkResource) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude) &&
    Math.abs(r.latitude!) <= 90 && Math.abs(r.longitude!) <= 180;
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const a = records[i], b = records[j];
    if (!valid(a) || !valid(b)) continue;
    const rad = Math.PI / 180;
    const h = Math.sin((b.latitude! - a.latitude!) * rad / 2) ** 2 +
      Math.cos(a.latitude! * rad) * Math.cos(b.latitude! * rad) * Math.sin((b.longitude! - a.longitude!) * rad / 2) ** 2;
    const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    if (meters <= 1000) edges.push({ source: a.id, target: b.id, relation: 'NEARBY', evidenceLevel: 'RESOURCE_RELATIONSHIP',
      basis: `승인 좌표 간 직선거리 ${Math.round(meters)}m · 1km 이내 (보행 경로 아님)` });
  }
  return { nodes, edges };
}
