import { useMemo, useState } from 'react';
import { GROUPS, EVIDENCE_LABELS, evidenceLevel, filteredEdges, relationLabel, type Ecosystem, type Filter, type PlaceNode } from '../contextNetwork';

const FILTERS: [Filter, string][] = [['ALL', '전체'], ['RESOURCE_RELATIONSHIP', '자원 관계'], ['INTEREST', '관심 행동'], ['MOVEMENT_INTENT', '이동 의도'], ['VERIFIED_USE', '검증 이용']];
const point = (angle: number, rx: number, ry: number) => ({ x: 650 + Math.cos(angle) * rx, y: 355 + Math.sin(angle) * ry });
export default function ContextResourceNetwork({
  data,
  selected,
  onSelect,
  priorityNodeIds,
}: {
  data: Ecosystem;
  selected?: PlaceNode;
  onSelect: (node?: PlaceNode) => void;
  priorityNodeIds?: Set<string>;
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [category, setCategory] = useState<string>();
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState<string>();
  const edges = useMemo(() => filteredEdges(data, filter), [data, filter]);
  const eligible = data.nodes;
  const groups = GROUPS.map(([kind, label], i) => {
    const all = eligible
      .filter(n => n.kind === kind)
      .sort((a, b) => {
        const ap = priorityNodeIds?.has(a.id) ? 1 : 0;
        const bp = priorityNodeIds?.has(b.id) ? 1 : 0;
        return bp - ap;
      });
    const selectedIndex = selected ? all.findIndex(n => n.id === selected.id) : -1;
    const pages = Math.max(1, Math.ceil(all.length / 4));
    const activePage = selectedIndex >= 0 ? Math.floor(selectedIndex / 4) : page % pages;
    const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
    return { kind, label, all, angle, ...point(angle, 225, 145),
      nodes: all.slice(activePage * 4, activePage * 4 + 4).map((n, j) => ({ ...n, ...point(angle + (j - 1.5) * .30, 495, 272) })) };
  });
  const visible = groups.flatMap(g => g.nodes);
  const byId = new Map(visible.map(n => [n.id, n]));
  const selectedId = selected?.id;
  const connected = new Set(selectedId ? [selectedId, ...edges.filter(e => e.source === selectedId || e.target === selectedId).flatMap(e => [e.source, e.target])] : []);
  const dim = (id: string, kind: string) => selectedId ? !connected.has(id) : category ? kind !== category : false;
  const reset = () => { onSelect(undefined); setCategory(undefined); };
  const focused = data.nodes.find(n => n.id === hover) || selected;
  const activeEdges = edges.filter(e => !selectedId || e.source === selectedId || e.target === selectedId);
  const maxPages = Math.max(1, ...groups.map(g => Math.ceil(g.all.length / 4)));
  return <>
    <div className="context-graph-toolbar"><p><strong>여행자의 현재 상황 → 지역자원 연결 → 이용 흐름</strong><br/>노드를 선택하면 직접 연결된 자원과 근거가 드러납니다.</p>
      <div role="group" aria-label="관계 필터">{FILTERS.map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setCategory(undefined); setPage(0); }}>{label}</button>)}</div>
    </div>
    <p className="context-graph-key"><span>─ 분류 구조</span><span>┄ 자원 관계</span><span className="interest-key">··· 관심 행동</span><span className="movement-key">┅ 이동 의도</span><span className="usage-key">━ 검증 이용</span><span>금색 점선 노드: 추가 검증 필요</span></p>
    {!edges.length && ['INTEREST','MOVEMENT_INTENT','VERIFIED_USE'].includes(filter) && <p className="context-empty context-empty-prominent" role="status">아직 확인된 {EVIDENCE_LABELS[filter as Exclude<Filter,'ALL'>]} 관계가 없습니다.</p>}
    <div className="context-graph-scroll" role="region" aria-label="합천 자원 네트워크, 작은 화면에서는 가로 스크롤" tabIndex={0}>
      <svg className="context-graph" viewBox="0 0 1300 710" role="group" aria-label="여행자 현재 맥락 중심 지역자원 네트워크">
        <ellipse cx="650" cy="355" rx="495" ry="272" className="context-orbit"/>
        {groups.map(g => <g key={g.kind} opacity={category && category !== g.kind ? .15 : selectedId ? .2 : 1}>
          <line x1="650" y1="355" x2={g.x} y2={g.y} className="context-structure"/>
          {g.nodes.map(n => <line key={n.id} x1={g.x} y1={g.y} x2={n.x} y2={n.y} className="context-structure"/>)}
        </g>)}
        {edges.map((e, i) => {
          const a = byId.get(e.source), b = byId.get(e.target);
          if (!a || !b) return null;
          const faded = selectedId ? e.source !== selectedId && e.target !== selectedId : category ? a.kind !== category && b.kind !== category : false;
          const level = evidenceLevel(e);
          const bend = { RESOURCE_RELATIONSHIP: 305, INTEREST: 340, MOVEMENT_INTENT: 375, VERIFIED_USE: 410 };
          const controlY = level ? bend[level] : 355;
          const labelX = (a.x + 2 * 650 + b.x) / 4;
          const labelY = (a.y + 2 * controlY + b.y) / 4;

          return <g key={`${e.source}-${e.target}-${i}`}>
            <path
              d={`M ${a.x} ${a.y} Q 650 ${controlY} ${b.x} ${b.y}`}
              className={`context-edge ${level?.toLowerCase()}`}
              opacity={faded ? .07 : 1}
            >
              <title>{a.label} {level === 'RESOURCE_RELATIONSHIP' ? '↔' : '→'} {b.label}: {relationLabel(e)} · {e.basis}{e.total ? ` · ${e.total}회` : ''}</title>
            </path>
            {e.total && level && level !== 'RESOURCE_RELATIONSHIP' && (
              <g
                className={`context-edge-count ${level.toLowerCase()}`}
                opacity={faded ? .07 : 1}
              >
                <rect
                  x={labelX - 36}
                  y={labelY - 12}
                  width="72"
                  height="24"
                  rx="12"
                />
                <text x={labelX} y={labelY + 5}>
                  {level === "INTEREST"
                    ? `관심 ${e.total}`
                    : level === "MOVEMENT_INTENT"
                      ? `이동 ${e.total}`
                      : `${e.total}`}
                </text>
              </g>
            )}
          </g>;
        })}
        {groups.map(g => <g key={g.kind} role="button" tabIndex={0} aria-label={`${g.label} ${g.all.length}개 자원`} aria-pressed={category === g.kind}
          onClick={() => { onSelect(undefined); setCategory(g.kind); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(undefined); setCategory(g.kind); } }}
          className="context-category" opacity={selectedId ? (g.kind === selected?.kind ? 1 : .2) : category && category !== g.kind ? .2 : 1}>
          <rect x={g.x - 64} y={g.y - 25} width="128" height="50" rx="25"/><text x={g.x} y={g.y + 5}>{g.label} · {g.all.length}</text>
        </g>)}
        {visible.map(n => { const count = edges.filter(e => e.source === n.id || e.target === n.id).length;
          const label = GROUPS.find(g => g[0] === n.kind)?.[1];
          return <g key={n.id} role="button" tabIndex={0} aria-pressed={selectedId === n.id} aria-label={`${n.label}, ${label}, ${n.status}, 관계 ${count}개`}
            className={`context-resource ${n.status === 'VERIFIED' ? 'verified' : 'partial'}`} opacity={dim(n.id, n.kind) ? .15 : 1}
            onClick={() => { onSelect(n); setCategory(undefined); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n); setCategory(undefined); } }}
            onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(undefined)} onFocus={() => setHover(n.id)} onBlur={() => setHover(undefined)}>
            <title>{n.label} · {label} · {n.status} · 관계 {count}개</title>
            <rect x={n.x - 70} y={n.y - 20} width="140" height="40" rx="12"/>
            <text x={n.x} y={n.y + 5}>{n.label.length > 12 ? `${n.label.slice(0, 11)}…` : n.label}</text>
          </g>;
        })}
        <g className="context-center" role="button" tabIndex={0} aria-label="여행자 현재 맥락, 전체 복원" onClick={reset} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reset(); } }}>
          <circle cx="650" cy="355" r="101"/><text x="650" y="328" className="core-title">여행자 현재 맥락</text>
          <text x="650" y="357">위치 · 시간 · 날씨</text><text x="650" y="380">동행자 · 보행 여건</text>
          <text x="650" y="409" className="core-stages">{data.actionPath.join(' / ')}</text>
        </g>
      </svg>
    </div>
    <div className="context-node-info" role="status">{focused ? <><strong>{focused.label}</strong><span>{GROUPS.find(g => g[0] === focused.kind)?.[1]} · {focused.status} · 관계 {edges.filter(e => e.source === focused.id || e.target === focused.id).length}개</span></> : <><strong>여행자 현재 맥락</strong><span>중앙 노드 클릭: 전체 복원 · 분류선은 맥락 적합성이나 실제 이용을 뜻하지 않습니다.</span></>}</div>
    {maxPages > 1 && <div className="context-pages"><span>가독성을 위해 범주별 최대 4개 표시 · 현재 {visible.length}/{eligible.length}개</span><button onClick={() => { reset(); setPage(p => p + 1); }}>다음 자원 보기</button><span>전체 자원은 아래 상세 목록에서 선택할 수 있습니다.</span></div>}
    {!data.nodes.length && <p role="status">공개 가능한 운영 DB 등록 자원이 없습니다. 정적 예시 자원은 표시하지 않습니다.</p>}
    {!edges.length && <p className="context-empty" role="status">{filter === 'MOVEMENT_INTENT'
      ? '현재 확인된 이동 의도 관계가 없습니다. 길찾기·이동 시작 행동이 확인되면 이곳에 표시됩니다.'
      : filter === 'VERIFIED_USE'
        ? '현재 확인된 검증 이용 관계가 없습니다. 현장 검증 기준을 충족한 이용이 확인되면 이곳에 표시됩니다.'
        : `${filter === 'ALL' ? '현재 공개 가능한 자원 간 관계가 없습니다.' : `공개 기준을 충족한 ${EVIDENCE_LABELS[filter]} 관계가 아직 없습니다.`} 분류 구조만 표시합니다.`}</p>}
    <details className="context-evidence" open={Boolean(selectedId)}><summary>관계 근거 {activeEdges.length}개{selectedId ? ' · 선택한 자원' : ''}</summary>
      {selectedId && !activeEdges.length && <p>선택한 자원에 현재 필터의 공개 가능한 직접 연결 근거가 없습니다.</p>}
      {activeEdges.map((e, i) => <p key={i}><strong>{data.nodes.find(n => n.id === e.source)?.label} {evidenceLevel(e) === 'RESOURCE_RELATIONSHIP' ? '↔' : '→'} {data.nodes.find(n => n.id === e.target)?.label}</strong><br/>{relationLabel(e)} · {e.basis}{e.total ? ` · ${e.total}회` : ''}</p>)}
    </details>
    <p className="context-usage-note">
      관심 행동은 장소 상세 열람 등 적극적인 탐색 행동입니다. 이동 의도는 일정 저장·길찾기·전화·예약 등 다음 행동으로 이어질 가능성을 보여주며 실제 방문·소비를 증명하지 않습니다. QR과 검증 혜택 이용은 현장 이용을 확인하는 더 강한 근거로 별도 활용됩니다. 개인정보 보호를 위해 서로 다른 익명 여행 흐름 {data.usage?.minimumCellSize || 5}건 이상이 확인된 연결만 공개합니다. 실제 이동 경로·식사·매출을 뜻하지 않습니다.
      {data.usage?.start && data.usage?.endExclusive && ` 집계: ${new Date(data.usage.start).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} ~ ${new Date(data.usage.endExclusive).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} (종료일 제외).`}
    </p>
    <blockquote className="context-message">합천의 관광자원은 개별 장소가 아니라, 여행자의 현재 상황을 중심으로 연결될 때 하나의 지역경제 네트워크가 됩니다.</blockquote>
  </>;
}
