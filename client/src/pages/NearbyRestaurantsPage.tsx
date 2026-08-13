import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchLiveRuntimeContext, fetchNavigationLinks, fetchNearbyDiscovery, fetchNearbyStatus, type NearbyCategory, type NearbyPlace } from '../api/client';
import { getSessionLocation, isOperationalLocation, observeVisitorLocation } from '../utils/visitorLocation';
import { getQuickStartPreset } from '../quickStartPresets';
import { isMobileNavigation, launchNavigation, navigationDestination, navigationTarget, type NavigationProvider } from '../utils/placeNavigation';

const GAJO_CENTER: [number, number] = [35.698758, 128.023103];
const CATEGORIES: { id: NearbyCategory; emoji: string; label: string }[] = [
  { id: 'FOOD', emoji: '🍽️', label: '맛집' }, { id: 'CAFE', emoji: '☕', label: '카페' },
  { id: 'LODGING', emoji: '🏨', label: '숙박' }, { id: 'HOT_SPRING_WELLNESS', emoji: '♨️', label: '온천·휴식' },
  { id: 'GOLF_SCREEN_GOLF', emoji: '⛳', label: '골프·스크린골프' }, { id: 'ACTIVITY', emoji: '🎨', label: '놀거리·체험' },
  { id: 'TOURISM_NATURE', emoji: '🌳', label: '산책·관광' }, { id: 'CONVENIENCE', emoji: '🏥', label: '편의시설' },
];
const visitorIcon = L.divIcon({ className: 'nearby-marker visitor', html: '<span>●</span>', iconSize: [28, 28] });
const transientIcon = L.divIcon({ className: 'nearby-marker transient', html: '<span>●</span>', iconSize: [28, 28] });
const canonicalIcon = L.divIcon({ className: 'nearby-marker canonical', html: '<span>★</span>', iconSize: [30, 30] });

function Recenter({ center }: { center: [number, number] }) { const map = useMap(); useEffect(() => { map.setView(center, 14); }, [map, center]); return null; }

export default function NearbyRestaurantsPage() {
  const routeLocation=useLocation();
  const preset=getQuickStartPreset((routeLocation.state as {quickStartPreset?:unknown}|null)?.quickStartPreset);
  const [category, setCategory] = useState<NearbyCategory>('FOOD');
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [distanceTrusted, setDistanceTrusted] = useState(false);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selected, setSelected] = useState<NearbyPlace | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mapLink, setMapLink] = useState<string>();
  const [weather, setWeather] = useState<string>();
  const [navigationPlace,setNavigationPlace]=useState<NearbyPlace|null>(null);

  useEffect(() => {
    fetchNearbyStatus().then(s => setConfigured(s.configured)).catch(() => setConfigured(false));
    fetchLiveRuntimeContext().then(live => setWeather(live.context?.weatherState || live.context?.weather)).catch(() => setWeather(undefined));
  }, []);
  const locate = async (reuse=true) => {
    const cached=reuse?getSessionLocation():null; const gps=isOperationalLocation(cached)?cached!:await observeVisitorLocation(); const usable = isOperationalLocation(gps);
    setOrigin(usable ? [gps.latitude!, gps.longitude!] : GAJO_CENTER); setDistanceTrusted(usable);
    if (!usable) setNotice('현재 위치를 정확하게 확인하지 못했습니다. 위치를 다시 확인하면 가까운 장소와 이동시간을 더 정확하게 안내할 수 있습니다. 가조 중심으로 장소만 둘러볼 수 있습니다.');
    else setNotice(null);
  };
  useEffect(() => { locate(); }, []);
  useEffect(() => {
    if (!origin || configured !== true) return;
    setLoading(true); setError(null); setSelected(null);
    fetchNearbyDiscovery(category, origin[0], origin[1], { useDistance: distanceTrusted, transportMode: 'car', weather })
      .then(response => setPlaces(response.results))
      .catch(error => setError(error?.response?.data?.message || '주변 장소를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [category, origin, distanceTrusted, configured, weather]);
  const choose = async (place: NearbyPlace) => { setSelected(place); setNotice(null); const links = await fetchNavigationLinks(place.lat, place.lng, place.name); setMapLink(links.kakaoMapWeb); };
  const navigateWith=(provider:NavigationProvider)=>{const destination=navigationPlace&&navigationDestination(navigationPlace);if(!destination)return;const gps=getSessionLocation();const origin=gps&&isOperationalLocation(gps)?{latitude:gps.latitude!,longitude:gps.longitude!}:undefined;launchNavigation(navigationTarget(provider,destination,origin),{mobile:isMobileNavigation(navigator.userAgent)});setNavigationPlace(null)};
  const center = useMemo<[number, number]>(() => selected ? [selected.lat, selected.lng] : origin || GAJO_CENTER, [selected, origin]);

  return <div className="nearby-discovery">
    <section className="card"><small className="eyebrow">주변 즐길거리 찾기</small><h1>지금 주변에서 무엇을 찾으세요?</h1>{preset?.id==='nearby'&&<p className="quick-start-entry-message" role="status">{preset.entryMessage}</p>}<p className="text-muted">원하는 종류를 누르면 실제 주변 장소를 찾아드려요.</p></section>
    {configured === false && <div className="card status-warning">현재 위치를 확인하면 주변 장소와 이동 정보를 더 정확하게 안내해드릴 수 있습니다.</div>}
    <section className="nearby-category-grid" aria-label="주변 장소 종류">
      {CATEGORIES.map(item => <button key={item.id} className={`nearby-category-card ${category === item.id ? 'active' : ''}`} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}><span aria-hidden>{item.emoji}</span><b>{item.label}</b></button>)}
    </section>
    {notice && <div className="card location-confidence-message"><p>{notice}</p><button className="btn btn-outline" onClick={()=>locate(false)}>위치 다시 확인</button></div>}
    {loading && <div className="loading">주변 장소를 찾고 있어요…</div>}{error && <div className="card status-warning">{error}</div>}
    {!loading && !error && origin && <>
      <div className="card nearby-map-card"><MapContainer center={center} zoom={14} style={{ height: 330, width: '100%' }}><Recenter center={center}/><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {distanceTrusted && <Marker position={origin} icon={visitorIcon}><Popup>현재 위치</Popup></Marker>}
        {places.map(place => <Marker key={place.id} position={[place.lat, place.lng]} icon={place.canonicalEntityUri ? canonicalIcon : transientIcon} eventHandlers={{ click: () => choose(place) }}><Popup><b>{place.name}</b><br/>{place.categoryLabel}{place.canonicalEntityUri ? <><br/>등록 장소와 연결됨</> : <><br/>주변 검색 결과</>}</Popup></Marker>)}
      </MapContainer><div className="nearby-map-legend"><span>● 현재 위치</span><span>● 주변 검색 결과</span><span>★ 등록 장소 연결</span></div></div>
      {selected && <section className="card nearby-detail"><div className="nearby-title-row"><div><small>{selected.categoryLabel}</small><h2>{selected.name}</h2></div>{selected.canonicalEntityUri && <span className="badge">등록 장소 연결</span>}</div>
        {distanceTrusted && selected.distanceMeters != null && <p>현재 위치에서 약 {(selected.distanceMeters / 1000).toFixed(1)}km · 차량 약 {selected.estimatedTravelMinutes}분</p>}
        <p>{selected.roadAddress || selected.address || '주소 확인 필요'}</p>{selected.phone && <p>전화 {selected.phone}</p>}
        <p>{selected.operatingMessage}</p>{selected.availabilityMessage && <p>{selected.availabilityMessage}</p>}
        {selected.contextualReasons.map(reason => <p className="nearby-reason" key={reason}>✓ {reason}</p>)}
        <div className="nearby-actions"><a className="btn btn-primary" href={mapLink || selected.placeUrl} target="_blank" rel="noreferrer">지도에서 보기</a>{navigationDestination(selected)&&<button className="btn btn-outline" onClick={()=>setNavigationPlace(selected)}>🚗 내비로 가기</button>}<button className="btn btn-outline" onClick={() => setNotice('일정 변경은 확인 후 반영됩니다. 이 장소를 일정에 넣으려면 현재 일정 화면에서 변경을 요청해 주세요.')}>일정에 담기</button></div>
      </section>}
      <section className="card"><h2>{CATEGORIES.find(item => item.id === category)?.label} 목록</h2>{places.length === 0 ? <p className="text-muted">이 범위에서 확인된 장소가 없습니다.</p> : places.map(place => <button className="nearby-result" key={place.id} onClick={() => choose(place)}><span><b>{place.name}</b><small>{place.providerCategoryName}</small></span>{distanceTrusted && place.distanceMeters != null && <strong>{place.distanceMeters < 1000 ? `${place.distanceMeters}m` : `${(place.distanceMeters / 1000).toFixed(1)}km`}</strong>}</button>)}</section>
    </>}
    {navigationPlace&&navigationDestination(navigationPlace)&&<div className="navigation-sheet" role="dialog" aria-modal="true" aria-labelledby="navigation-sheet-title"><button type="button" className="navigation-backdrop" aria-label="내비 선택 닫기" onClick={()=>setNavigationPlace(null)}/><section className="navigation-panel"><button type="button" className="navigation-close" aria-label="닫기" onClick={()=>setNavigationPlace(null)}>×</button><h2 id="navigation-sheet-title">어떤 내비로 이동할까요?</h2><p>{navigationDestination(navigationPlace)!.name}</p><div className="navigation-providers"><button type="button" className="btn btn-outline" onClick={()=>navigateWith('naver')}>네이버지도</button><button type="button" className="btn btn-outline" onClick={()=>navigateWith('kakao')}>카카오맵</button><button type="button" className="btn btn-outline" onClick={()=>navigateWith('tmap')}>TMAP</button></div></section></div>}
  </div>;
}
