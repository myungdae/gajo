import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchNavigationLinks,
  fetchNearbyRestaurants,
  fetchNearbyStatus,
  fetchRoutePreview,
  type NearbyRestaurant,
} from '../api/client';

// Gajo-myeon (가조면) approximate center, used as a fallback origin when the
// visitor declines/loses location permission so the finder still works.
const GAJO_CENTER: [number, number] = [35.7423, 127.9528];

const CATEGORY_ORDER = ['건강식/약선', '채식/사찰음식', '한식', '해산물', '기타 음식점'];
const CATEGORY_EMOJI: Record<string, string> = {
  '건강식/약선': '🍵',
  '채식/사찰음식': '🥗',
  한식: '🍚',
  해산물: '🐟',
  '기타 음식점': '🍽️',
};

const originIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'origin-marker',
});

const destIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [30, 49],
  iconAnchor: [15, 49],
});

type LocationState = 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported';

function RecenterOnChange({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);
  return null;
}

export default function NearbyRestaurantsPage() {
  const [locState, setLocState] = useState<LocationState>('idle');
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Record<string, NearbyRestaurant[]>>({});
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORY_ORDER[0]);
  const [selected, setSelected] = useState<NearbyRestaurant | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeMeta, setRouteMeta] = useState<{ distanceMeters: number; durationSeconds: number } | null>(null);
  const [navLinks, setNavLinks] = useState<{ kakaoMapWeb: string; googleMaps: string } | null>(null);

  useEffect(() => {
    fetchNearbyStatus()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
  }, []);

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocState('unsupported');
      setOrigin(GAJO_CENTER);
      setUsingFallback(true);
      return;
    }
    setLocState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin([pos.coords.latitude, pos.coords.longitude]);
        setUsingFallback(false);
        setLocState('granted');
      },
      () => {
        setLocState('denied');
        setOrigin(GAJO_CENTER);
        setUsingFallback(true);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  useEffect(() => {
    if (!origin) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setRoute(null);
    setRouteMeta(null);
    fetchNearbyRestaurants(origin[0], origin[1], 2500)
      .then((res) => {
        setGroups(res.groups);
        const firstNonEmpty = CATEGORY_ORDER.find((c) => (res.groups[c] || []).length > 0);
        if (firstNonEmpty) setActiveCategory(firstNonEmpty);
      })
      .catch((e) => setError(e?.response?.data?.message || e?.message || '식당 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [origin]);

  const selectRestaurant = async (r: NearbyRestaurant) => {
    setSelected(r);
    setRoute(null);
    setRouteMeta(null);
    setNavLinks(null);
    if (!origin) return;
    const [preview, links] = await Promise.all([
      fetchRoutePreview(origin[0], origin[1], r.lat, r.lng, 'foot'),
      fetchNavigationLinks(r.lat, r.lng, r.name),
    ]);
    if (preview.available && preview.coordinates) {
      setRoute(preview.coordinates);
      setRouteMeta({
        distanceMeters: preview.distanceMeters || 0,
        durationSeconds: preview.durationSeconds || 0,
      });
    }
    setNavLinks(links);
  };

  const activeList = groups[activeCategory] || [];
  const mapCenter = useMemo<[number, number]>(() => {
    if (selected) return [selected.lat, selected.lng];
    return origin || GAJO_CENTER;
  }, [selected, origin]);

  return (
    <div>
      <div className="card">
        <h2>🍽️ 내 주변 지역 식당 찾기</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          현재 위치를 기준으로 실제 주변 식당을 종류별(건강식/약선, 채식·사찰음식, 한식, 해산물 등)로
          분류해 보여줍니다. 온천단지 온톨로지 추천과는 별도로, 카카오 로컬 API 기반 실제 지도 데이터를
          사용합니다.
        </p>
        {configured === false && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: 'var(--color-danger)',
              borderRadius: 10,
              padding: 10,
            }}
          >
            ⚠️ 서버에 카카오 REST API 키(KAKAO_REST_API_KEY)가 아직 설정되지 않았습니다. 관리자에게
            문의해주세요.
          </div>
        )}
      </div>

      {!origin && (
        <div className="card">
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            정확한 주변 식당 안내를 위해 현재 위치 확인이 필요합니다. 위치 정보는 식당 검색에만
            사용되며 저장되지 않습니다.
          </p>
          <button className="btn btn-primary btn-block" onClick={requestLocation} disabled={locState === 'locating'}>
            {locState === 'locating' ? '위치 확인 중...' : '📍 현재 위치로 주변 식당 찾기'}
          </button>
          {(locState === 'denied' || locState === 'unsupported') && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
              위치 권한이 거부되어 가조 온천단지 중심으로 대신 검색합니다.
            </p>
          )}
        </div>
      )}

      {origin && (
        <>
          {usingFallback && (
            <div className="card" style={{ padding: '10px 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>
              📍 위치 권한이 없어 가조 온천단지 중심 기준으로 검색 중입니다.
              <button
                className="btn btn-outline"
                style={{ marginLeft: 8, padding: '4px 10px', fontSize: 11 }}
                onClick={requestLocation}
              >
                다시 시도
              </button>
            </div>
          )}

          {loading && <div className="loading">주변 식당을 검색하는 중...</div>}
          {error && (
            <div className="card" style={{ color: 'var(--color-danger)', fontSize: 13 }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="tag-row" style={{ marginBottom: 4 }}>
                {CATEGORY_ORDER.map((c) => {
                  const count = (groups[c] || []).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        setActiveCategory(c);
                        setSelected(null);
                        setRoute(null);
                      }}
                      className="badge"
                      style={{
                        cursor: 'pointer',
                        border: 'none',
                        background: activeCategory === c ? 'var(--color-primary)' : '#ecfdf5',
                        color: activeCategory === c ? 'white' : 'var(--color-primary-dark)',
                      }}
                    >
                      {CATEGORY_EMOJI[c]} {c} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <MapContainer center={mapCenter} zoom={15} style={{ height: '38vh', width: '100%' }}>
                  <RecenterOnChange center={mapCenter} />
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={origin} icon={originIcon}>
                    <Popup>📍 현재 위치{usingFallback ? ' (가조 온천단지 중심)' : ''}</Popup>
                  </Marker>
                  {activeList.map((r) => (
                    <Marker
                      key={r.id}
                      position={[r.lat, r.lng]}
                      icon={selected?.id === r.id ? destIcon : originIcon}
                      eventHandlers={{ click: () => selectRestaurant(r) }}
                    >
                      <Popup>
                        <b>{r.name}</b>
                        <br />
                        {r.categoryName}
                      </Popup>
                    </Marker>
                  ))}
                  {route && <Polyline positions={route} pathOptions={{ color: '#0f766e', weight: 4 }} />}
                </MapContainer>
              </div>

              {selected && (
                <div className="card">
                  <h2>{selected.name}</h2>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>
                    {selected.categoryName}
                    {selected.matchedKeyword ? ` · "${selected.matchedKeyword}" 관련` : ''}
                  </p>
                  <p style={{ fontSize: 13, margin: '0 0 4px' }}>📍 {selected.roadAddress || selected.address}</p>
                  {selected.phone && <p style={{ fontSize: 13, margin: '0 0 4px' }}>📞 {selected.phone}</p>}
                  {typeof selected.distanceMeters === 'number' && (
                    <p style={{ fontSize: 13, margin: '0 0 8px' }}>
                      직선거리 약 {selected.distanceMeters}m
                    </p>
                  )}
                  {routeMeta && (
                    <p style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--color-primary-dark)' }}>
                      🚶 도보 경로 약 {Math.round(routeMeta.distanceMeters)}m · 약{' '}
                      {Math.max(1, Math.round(routeMeta.durationSeconds / 60))}분
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <a
                      className="btn btn-primary"
                      style={{ flex: 1, textDecoration: 'none' }}
                      href={navLinks?.googleMaps || '#'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      🧭 길찾기 시작
                    </a>
                    <a
                      className="btn btn-outline"
                      style={{ flex: 1, textDecoration: 'none' }}
                      href={selected.placeUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      상세 정보
                    </a>
                  </div>
                  {navLinks && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                      카카오맵으로 열기:{' '}
                      <a href={navLinks.kakaoMapWeb} target="_blank" rel="noreferrer">
                        {navLinks.kakaoMapWeb}
                      </a>
                    </p>
                  )}
                </div>
              )}

              <div className="card">
                <h2>
                  {CATEGORY_EMOJI[activeCategory]} {activeCategory} 목록
                </h2>
                {activeList.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    주변 2.5km 내에 해당 카테고리의 식당이 없습니다.
                  </p>
                )}
                {activeList.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectRestaurant(r)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      padding: 10,
                      marginBottom: 8,
                      background: selected?.id === r.id ? '#ecfdf5' : 'var(--color-surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <b style={{ fontSize: 13 }}>{r.name}</b>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                      {typeof r.distanceMeters === 'number' ? `${r.distanceMeters}m` : ''}
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{r.categoryName}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
