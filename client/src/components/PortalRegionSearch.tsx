import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchNationwideRegions } from '../nationwideRegions';
import { RegionCard } from './NationwideRegionExplorer';

export default function PortalRegionSearch() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchNationwideRegions(query), [query]);
  const searching = Boolean(query.trim());

  return <div className="portal-region-search">
    <label className="region-search" htmlFor="portal-region-search-input">
      <span>지역 찾기</span>
      <input
        id="portal-region-search-input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="시·도, 시·군·구 이름 검색"
        aria-controls="portal-region-search-results"
      />
    </label>
    {searching && <div id="portal-region-search-results" className="region-search-results portal-region-search-results" aria-live="polite">
      <p>{results.length ? <><strong>{results.length}</strong>개 지역을 찾았습니다.</> : '검색 결과가 없습니다. 지역 이름을 다시 확인해 주세요.'}</p>
      {results.length > 0 && <div className="region-explorer-results">
        {results.map((region) => region.parentId
          ? <RegionCard key={region.id} region={region} />
          : <Link className="portal-region-parent-result" key={region.id} to={`/regions/${region.id}`}>
              <span>{region.name}</span><small>시·군·구 보기</small>
            </Link>)}
      </div>}
    </div>}
  </div>;
}
