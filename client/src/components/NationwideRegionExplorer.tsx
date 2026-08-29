import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ExkoRegionKnowledgeLink from './ExkoRegionKnowledgeLink';
import { findNationwideRegion, REGION_STATUS_LABELS, regionsForParent, searchNationwideRegions, TOP_LEVEL_REGIONS, type NationwideRegion } from '../nationwideRegions';

function RegionAction({ region }: { region: NationwideRegion }) {
  if (region.aiUrl) {
    const label = `${region.name.replace(/[시군구]$/, '')} AI 시작하기`;
    return region.aiUrl.startsWith('http')
      ? <a className="region-explorer-primary" href={region.aiUrl}>{label}<span aria-hidden="true">→</span></a>
      : <Link className="region-explorer-primary" to={region.aiUrl}>{label}<span aria-hidden="true">→</span></Link>;
  }
  return <p className="region-explorer-unavailable">아직 AI 여행안내가 제공되지 않습니다.</p>;
}

function hasServiceCorsage(status: NationwideRegion['status']) {
  return status === 'AI_LIVE' || status === 'FIELD_TEST';
}

function ServiceCorsage({ status }: { status: NationwideRegion['status'] }) {
  if (!hasServiceCorsage(status)) return null;

  return <svg className="region-service-corsage" data-service-status={status} aria-hidden="true" focusable="false" viewBox="0 0 48 58">
    <path className="region-service-corsage-ribbon" d="M19 33 12 55l11-6 4 8 4-24Z" />
    <path className="region-service-corsage-ribbon" d="m29 33 7 22-11-6-4 8-4-24Z" />
    <g className="region-service-corsage-flower">
      <ellipse cx="24" cy="12" rx="8" ry="11" />
      <ellipse cx="35" cy="18" rx="8" ry="11" transform="rotate(60 35 18)" />
      <ellipse cx="35" cy="30" rx="8" ry="11" transform="rotate(120 35 30)" />
      <ellipse cx="24" cy="36" rx="8" ry="11" />
      <ellipse cx="13" cy="30" rx="8" ry="11" transform="rotate(60 13 30)" />
      <ellipse cx="13" cy="18" rx="8" ry="11" transform="rotate(120 13 18)" />
      <circle className="region-service-corsage-center" cx="24" cy="24" r="7" />
    </g>
  </svg>;
}

function RegionCard({ region }: { region: NationwideRegion }) {
  return <article className={`region-explorer-card status-${region.status.toLowerCase()}`}>
    <ServiceCorsage status={region.status} />
    <div className="region-explorer-card-heading">
      <div><small>{REGION_STATUS_LABELS[region.status]}</small><h3>{region.displayName ?? region.name}</h3></div>
      <span className="region-explorer-status" aria-label={`서비스 상태: ${REGION_STATUS_LABELS[region.status]}`}>{REGION_STATUS_LABELS[region.status]}</span>
    </div>
    <RegionAction region={region} />
    {region.exkoResourceHref && <a className="region-explorer-exko" href={region.exkoResourceHref} target="_blank" rel="noopener noreferrer">EXKO 지역지식 보기<span className="sr-only">: {region.exkoResourceLabel}</span><span aria-hidden="true">↗</span></a>}
    {region.exkoRegionId && <ExkoRegionKnowledgeLink regionId={region.exkoRegionId} compact />}
  </article>;
}

export default function NationwideRegionExplorer({ routeRegionId, routed = false }: { routeRegionId?: string; routed?: boolean }) {
  const navigate = useNavigate();
  const routeRegion = routed && routeRegionId ? findNationwideRegion(routeRegionId) : undefined;
  const routeParent = routeRegion?.parentId ?? routeRegion?.id;
  const invalidRoute = routed && Boolean(routeRegionId) && !routeRegion;
  const [embeddedParent, setEmbeddedParent] = useState(TOP_LEVEL_REGIONS[0].id);
  const selectedParent = routeParent ?? embeddedParent;
  const [mobileDetail, setMobileDetail] = useState(Boolean(routeRegionId && routeRegion));
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchNationwideRegions(query), [query]);
  const children = regionsForParent(selectedParent);
  const selected = findNationwideRegion(selectedParent)!;

  useEffect(() => {
    if (!routed) return;
    setQuery('');
    setMobileDetail(Boolean(routeRegionId && routeRegion));
    if (invalidRoute) navigate('/regions', { replace: true });
  }, [invalidRoute, navigate, routeRegion, routeRegionId, routed]);

  const selectParent = (id: string) => {
    setMobileDetail(true);
    setQuery('');
    if (routed) {
      if (routeRegionId !== id) navigate(`/regions/${id}`, { replace: false });
      return;
    }
    setEmbeddedParent(id);
  };

  if (invalidRoute) return <section className="nationwide-explorer" aria-labelledby="nationwide-title"><div className="platform-section-heading"><p className="platform-kicker">EXPLORE KOREA</p><h2 id="nationwide-title">지역을 찾을 수 없습니다</h2><p>전국 지역 목록으로 이동합니다.</p></div></section>;

  return <section className="nationwide-explorer" aria-labelledby="nationwide-title">
    <div className="platform-section-heading">
      <p className="platform-kicker">EXPLORE KOREA</p>
      <h2 id="nationwide-title">전국 지역 둘러보기</h2>
      <p>광역 지역을 고른 뒤 시·군·구의 AI 여행안내와 지역지식 제공 상태를 확인하세요.</p>
    </div>
    <label className="region-search">
      <span>지역 검색</span>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시·도, 시·군·구 이름 검색" />
    </label>
    {query.trim() ? <div className="region-search-results" aria-live="polite">
      <p><strong>{results.length}</strong>개 지역을 찾았습니다.</p>
      <div className="region-explorer-results">{results.map((region) => region.parentId ? <RegionCard key={region.id} region={region} /> : <button type="button" key={region.id} onClick={() => selectParent(region.id)}>{region.name}<span>시·군·구 보기</span></button>)}</div>
    </div> : <div className={`region-explorer-layout ${mobileDetail ? 'show-mobile-detail' : ''}`}>
      <nav className="region-province-list" aria-label="광역 지역 선택">
        {TOP_LEVEL_REGIONS.map((region) => <button type="button" key={region.id} aria-pressed={selectedParent === region.id} onClick={() => selectParent(region.id)}>
          <span>{region.shortName ?? region.name}</span><small>{regionsForParent(region.id).length}개 지역</small>
        </button>)}
      </nav>
      <div className="region-child-panel">
        <div className="region-child-heading"><button type="button" className="region-mobile-back" onClick={() => setMobileDetail(false)}>지역 다시 선택</button><p>{selected.name === selected.shortName ? selected.name : `${selected.shortName ?? selected.name} · ${selected.name}`}</p><strong>{children.length}개 시·군·구</strong></div>
        <div className="region-explorer-results">{children.map((region) => <RegionCard key={region.id} region={region} />)}</div>
      </div>
    </div>}
    <p className="region-registry-note">행정구역은 2026년 7월 1일 시행 체계를 기준으로 안내합니다. 서비스가 없는 지역은 임의 링크를 만들지 않습니다.</p>
  </section>;
}
