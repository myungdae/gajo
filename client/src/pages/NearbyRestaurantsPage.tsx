import VisitorBusinessDetails from '../components/VisitorBusinessDetails';
import { useRegionalLanguage } from '../RegionalLanguageContext';
import { localizedRegionalPath } from '../visitorRouting';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../nearby-radius.css';
import { fetchLiveRuntimeContext, fetchNavigationLinks, fetchNearbyDiscovery, fetchNearbyStatus, type NearbyCategory, type NearbyPlace } from '../api/client';
import { getSessionLocation, isOperationalLocation } from '../utils/visitorLocation';
import { getQuickStartPreset } from '../quickStartPresets';
import { isMobileNavigation, launchNavigation, navigationDestination, navigationTarget, type NavigationProvider } from '../utils/placeNavigation';
import { ensureTripSession, isFreshTripLocation } from '../tripSession';
import { track } from '../analytics';
import { useRegion } from '../RegionContext';
import { regionalRuntimeView } from '../regionalRuntime';
import { liveRuntimeForRegion } from '../liveRuntimeGuard';
import { addAccommodationToRegionalItinerary, addEntityToRegionalItinerary, type ItineraryAddResult } from '../journeyExecution';
import ItineraryAddContinuation from '../components/ItineraryAddContinuation';
import LocationContextBar from '../components/LocationContextBar';
import ExkoRegionKnowledgeLink from '../components/ExkoRegionKnowledgeLink';
import { isFoodCategory, isLodgingCategory, nearbyGroupFor, nearbyLabel, nearbyUiCategory, NEARBY_GROUPS, type NearbyGroupId } from '../nearbyTaxonomy';
import { tourismRepresentativeTitle, tourismResultSections } from '../nearbyTourismPresentation';
const visitorIcon = L.divIcon({ className: 'nearby-marker visitor', html: '<span>●</span>', iconSize: [28, 28] });
const transientIcon = L.divIcon({ className: 'nearby-marker transient', html: '<span>●</span>', iconSize: [28, 28] });
const canonicalIcon = L.divIcon({ className: 'nearby-marker canonical', html: '<span>★</span>', iconSize: [30, 30] });

function Recenter({ center }: { center: [number, number] }) { const map = useMap(); useEffect(() => { map.setView(center, 14); }, [map, center]); return null; }
function FitWideResults({origin,places}:{origin:[number,number];places:NearbyPlace[]}){const map=useMap();useEffect(()=>{if(!places.length)return;map.fitBounds(L.latLngBounds([origin,...places.map(place=>[place.lat,place.lng]as[number,number])]),{padding:[24,24],maxZoom:12})},[map,origin,places]);return null}

export default function NearbyRestaurantsPage() {
  const region=useRegion(); const {language}=useRegionalLanguage();
  const regionalRuntime=regionalRuntimeView(region);
  const tripSession=ensureTripSession(region.id);
  const routeLocation=useLocation();
  const routeState=routeLocation.state as {quickStartPreset?:unknown;category?:NearbyCategory;anchor?:{entityId:string;label:string;latitude:number;longitude:number}}|null;
  const preset=getQuickStartPreset(routeState?.quickStartPreset),anchor=routeState?.anchor;
  const confirmed=tripSession.locationContext?.now;
  const [operationalLocation,setOperationalLocation]=useState(confirmed);
  const searchRegionId=anchor?region.id:operationalLocation?.searchRegionId;
  const initialCategory=nearbyUiCategory(routeState?.category);
  const [category, setCategory] = useState<NearbyCategory>(initialCategory);
  const [categoryGroup,setCategoryGroup]=useState<NearbyGroupId>(nearbyGroupFor(initialCategory).id);
  const [origin, setOrigin] = useState<[number, number] | null>(()=>anchor?[anchor.latitude,anchor.longitude]:isFreshTripLocation(confirmed)&&confirmed?.latitude!=null&&confirmed.longitude!=null?[confirmed.latitude,confirmed.longitude]:null);
  const [distanceTrusted, setDistanceTrusted] = useState(Boolean(anchor||isFreshTripLocation(confirmed)));
  const [requestedRadius,setRequestedRadius]=useState<number>();
  const [radius,setRadius]=useState(1000);
  const [nearRadius,setNearRadius]=useState(1000);
  const [nextRadius,setNextRadius]=useState<number>();
  const [expanded,setExpanded]=useState(false);
  const [coverageStatus,setCoverageStatus]=useState<'COMPLETE'|'PARTIAL'>('COMPLETE');
  const [distanceBands,setDistanceBands]=useState<Array<{id:string;label:string;minExclusive:number;maxInclusive:number;resultCount:number}>>([]);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selected, setSelected] = useState<NearbyPlace | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mapLink, setMapLink] = useState<string>();
  const [weather, setWeather] = useState<string>();
  const [searchedAt,setSearchedAt]=useState<string>();
  const [navigationPlace,setNavigationPlace]=useState<NearbyPlace|null>(null);
  const [addedPlace,setAddedPlace]=useState<NearbyPlace|null>(null);
  const [addedEntity,setAddedEntity]=useState<any>(null);
  const [addResult,setAddResult]=useState<ItineraryAddResult|null>(null);
  const radiusClickGuard=useRef<{radius:number;at:number}|undefined>(undefined);

  useEffect(() => {
    if(!regionalRuntime.nearbyEnabled){setConfigured(false);return}fetchNearbyStatus(region.id).then(s => setConfigured(s.configured)).catch(() => setConfigured(false));
    if(regionalRuntime.weatherEnabled)fetchLiveRuntimeContext(region.id).then(live =>{const owned=liveRuntimeForRegion(live,region.id);setWeather(owned?.context?.weatherState||owned?.context?.weather)}).catch(() => setWeather(undefined));
  }, [region.id,regionalRuntime.nearbyEnabled,regionalRuntime.weatherEnabled]);
  useEffect(() => { if(anchor){setOrigin([anchor.latitude,anchor.longitude]);setDistanceTrusted(true)} }, [anchor]);
  useEffect(()=>{setRequestedRadius(undefined);setRadius(1000);setNextRadius(undefined);setExpanded(false)},[region.id]);
  useEffect(() => {
    if (!origin || configured !== true) return;
    let current=true;const controller=new AbortController();
    setLoading(true); setError(null); setSelected(null);setPlaces([]);setDistanceBands([]);setSearchedAt(undefined);
    fetchNearbyDiscovery(category, origin[0], origin[1], { radius:requestedRadius,useDistance: distanceTrusted, transportMode: 'car', weather, regionId: region.id,experienceRegionId:region.id,searchRegionId,coordinateSearch:!anchor,regionMembership:operationalLocation?.regionMembership,signal:controller.signal })
      .then(response => {if(current){const results=anchor?response.results.filter(place=>place.canonicalEntityUri!==anchor.entityId&&`provider:kakao:${place.providerPlaceId||place.id}`!==anchor.entityId):response.results;setPlaces(results);setDistanceBands(response.distanceBands||[]);setSearchedAt(response.searchedAt);setRadius(response.radius);setNearRadius(response.initialRadius);setNextRadius(response.nextRadius);setExpanded(response.expanded);setCoverageStatus(response.coverageStatus)}})
      .catch(error => {if(current)setError(error?.response?.data?.message || '주변 장소를 불러오지 못했습니다.')})
      .finally(() => {if(current)setLoading(false)});
    return()=>{current=false;controller.abort()};
  }, [category, origin, requestedRadius,distanceTrusted, configured, weather,region.id,searchRegionId,operationalLocation?.regionMembership,anchor,language]);
  const choose = async (place: NearbyPlace) => { track('PLACE_DETAIL_OPENED',tripSession.id,{category:place.category});setSelected(place); setNotice(null); const links = await fetchNavigationLinks(place.lat, place.lng, place.name); setMapLink(links.kakaoMapWeb); };
  const navigateWith=(provider:NavigationProvider)=>{const destination=navigationPlace&&navigationDestination(navigationPlace);if(!destination)return;track('NAVIGATION_HANDOFF',tripSession.id,{provider});const gps=getSessionLocation();const origin=gps&&isOperationalLocation(gps)?{latitude:gps.latitude!,longitude:gps.longitude!}:undefined;launchNavigation(navigationTarget(provider,destination,origin),{mobile:isMobileNavigation(navigator.userAgent)});setNavigationPlace(null)};
  const addToItinerary=(place:NearbyPlace)=>{const lodging=isLodgingCategory(place.category),destination=navigationDestination(place),external=place.provider==='KAKAO'||place.transient,entityId=external?`provider:kakao:${place.providerPlaceId||place.id}`:place.canonicalEntityUri,item={entityId,entityUri:entityId,canonicalEntityUri:external?undefined:place.canonicalEntityUri,linkedCanonicalEntityUri:place.canonicalEntityUri,provider:place.provider||'KAKAO',providerPlaceId:place.providerPlaceId||place.id,regionId:searchRegionId||region.id,experienceRegionId:region.id,label:place.name,name:place.name,entityType:lodging?'ACCOMMODATION':place.category,category:place.category,address:place.roadAddress||place.address,telephone:place.phone,latitude:place.lat,longitude:place.lng,provenance:'KAKAO_LOCAL',resolved:true,actions:destination?{navigate:{latitude:destination.latitude,longitude:destination.longitude}}:undefined};const result=lodging?addAccommodationToRegionalItinerary(region.id,item,tripSession.anonymousTripId,localStorage,track):addEntityToRegionalItinerary(region.id,item,localStorage,track);setAddedPlace(place);setAddedEntity(result.item||item);setAddResult(result);setNotice(null)};
  const center = useMemo<[number, number]>(() => selected ? [selected.lat, selected.lng] : origin!, [selected, origin]);
  const nearbyPlaces=places.filter(place=>!distanceTrusted||place.distanceMeters==null||place.distanceMeters<=nearRadius),widerPlaces=distanceTrusted?places.filter(place=>place.distanceMeters!=null&&place.distanceMeters>nearRadius):[];
  const tourismSections=tourismResultSections(category,places);
  const resetSearch=()=>{setRequestedRadius(undefined);setRadius(1000);setNextRadius(undefined);setExpanded(false);setCoverageStatus('COMPLETE');setDistanceBands([])};
  const selectRadius=(value:number)=>{const now=Date.now(),last=radiusClickGuard.current;if(last?.radius===value&&now-last.at<800)return;radiusClickGuard.current={radius:value,at:now};setRequestedRadius(value)};
  const resultButton=(place:NearbyPlace)=><button type="button" className="nearby-result" key={`${place.provider}:${place.providerPlaceId}`} onClick={() => choose(place)} aria-label={`${place.name}, ${place.categoryLabel}${distanceTrusted&&place.distanceMeters!=null?`, ${place.distanceMeters}미터`:""}`}><span><b translate="no">{place.name}</b><small>{place.administrativeRegion||'시·군 확인 필요'} · {place.categoryLabel}</small><small>{place.operatingMessage||'영업 여부 확인 필요'}</small>{place.matchedKeyword&&<small>검색 근거: {place.matchedKeyword}</small>}</span>{distanceTrusted && place.distanceMeters != null && <strong>{place.distanceMeters < 1000 ? `${place.distanceMeters}m` : `${(place.distanceMeters / 1000).toFixed(1)}km`}</strong>}</button>;

  if(!regionalRuntime.nearbyEnabled)return <div className="nearby-discovery"><section className="card"><small className="eyebrow">주변 즐길거리 찾기</small><h1>{region.regionName} 주변 정보 준비 중</h1><p className="text-muted">현재 등록된 {region.regionName} 장소의 정확한 위치 정보를 확인하고 있습니다.</p></section></div>;
  return <div className="nearby-discovery">
    <section className="card"><small className="eyebrow">내 주변 찾기</small><h1>{anchor?`${anchor.label} 주변 장소`:operationalLocation?.label?`현재 ${operationalLocation.label} 주변을 찾고 있어요`:'현재 위치 주변에서 찾아드릴까요?'}</h1>{preset?.id==='nearby'&&<p className="quick-start-entry-message" role="status">{preset.entryMessage}</p>}<p className="text-muted">{searchRegionId&&searchRegionId!==region.id?`${region.regionName} 여행 맥락은 유지하면서 현재 위치 기준으로 보여드립니다.`:'위치를 선택하면 실제 거리순으로 보여드립니다.'}</p></section>
    {configured === false && <div className="card status-warning">현재 위치를 확인하면 주변 장소와 이동 정보를 더 정확하게 안내해드릴 수 있습니다.</div>}
    <section className="card nearby-taxonomy" aria-labelledby="nearby-taxonomy-title">
      <h2 id="nearby-taxonomy-title">무엇을 찾으시나요?</h2>
      <div className="nearby-group-tabs" role="tablist" aria-label="주변 찾기 대분류">
        {NEARBY_GROUPS.map(group=><button key={group.id} type="button" role="tab" aria-selected={categoryGroup===group.id} aria-controls={`nearby-options-${group.id}`} className={categoryGroup===group.id?'active':''} onClick={()=>{setCategoryGroup(group.id);setCategory(group.options[0].id);resetSearch()}}><b>{group.label}</b><small>{group.description}</small></button>)}
      </div>
      {NEARBY_GROUPS.filter(group=>group.id===categoryGroup).map(group=><div id={`nearby-options-${group.id}`} role="tabpanel" className="nearby-subcategories" key={group.id}>{group.options.map(item=><button key={item.id} type="button" disabled={loading} className={category===item.id?'active':''} aria-pressed={category===item.id} onClick={()=>{setCategory(item.id);resetSearch()}}><span aria-hidden="true">{category===item.id?'✓':''}</span>{item.label}</button>)}</div>)}
      {isLodgingCategory(category)&&<div className="nearby-lodging-actions"><div><strong>숙소 찾기</strong><p>주변 숙소 후보를 찾습니다. 예약 가능 여부는 숙소에 직접 확인해 주세요.</p></div>{tripSession.plannedContext?.accommodationIntents?.[0]&&<Link to={localizedRegionalPath("/concierge",region.id)} state={{quickStartPreset:'saved-lodging'}}><span>저장된 숙소</span><b>{tripSession.plannedContext.accommodationIntents[0].label}로 돌아가기</b></Link>}</div>}
    </section>
    {!anchor&&<LocationContextBar mode="NOW" searchTarget={nearbyLabel(category)} onConfirmed={location=>{setOperationalLocation(location);setPlaces([]);setSelected(null);resetSearch();setSearchedAt(undefined);setOrigin([location.latitude!,location.longitude!]);setDistanceTrusted(true)}}/>}
    {notice && <div className="card location-confidence-message"><p>{notice}</p></div>}
    {loading && <div className="loading" role="status">가까운 곳부터 찾아보고 있습니다.</div>}{error && <div className="card status-warning">{error}</div>}
    {!loading && !error && origin && <>
      <div className="card nearby-map-card"><MapContainer center={center} zoom={14} style={{ height: 330, width: '100%' }}>{distanceBands.length?<FitWideResults origin={origin} places={places}/>:<Recenter center={center}/>}<TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {distanceTrusted && <Marker position={origin} icon={visitorIcon}><Popup>{anchor?.label||'현재 위치'}</Popup></Marker>}
        {places.map(place => <Marker key={place.id} position={[place.lat, place.lng]} icon={place.canonicalEntityUri ? canonicalIcon : transientIcon} eventHandlers={{ click: () => choose(place) }}><Popup><b translate="no">{place.name}</b><br/>{place.categoryLabel}{place.canonicalEntityUri ? <><br/>등록 장소와 연결됨</> : <><br/>주변 검색 결과</>}</Popup></Marker>)}
      </MapContainer><div className="nearby-map-legend"><span>● {anchor?.label||'현재 위치'}</span><span>● 주변 검색 결과</span><span>★ 등록 장소 연결</span></div></div>
      {selected && <section className="card nearby-detail"><div className="nearby-title-row"><div><small>{selected.categoryLabel}</small><h2 translate="no">{selected.name}</h2></div>{selected.canonicalEntityUri && <span className="badge">등록 장소 연결</span>}</div>
        {distanceTrusted && selected.distanceMeters != null && <p>{anchor?`${anchor.label}에서`:'현재 위치에서'} 직선거리 약 {(selected.distanceMeters / 1000).toFixed(1)}km</p>}
        <p>{selected.roadAddress || selected.address ? <span translate="no">{selected.roadAddress || selected.address}</span> : '주소 확인 필요'}</p>{selected.administrativeRegion&&<p>행정지역 {selected.administrativeRegion}</p>}{selected.phone && <p>전화 {selected.phone}</p>}
        <VisitorBusinessDetails place={selected}/><p>{selected.operatingMessage}</p>{selected.availabilityMessage && <p>{selected.availabilityMessage}</p>}
        {selected.contextualReasons.map(reason => <p className="nearby-reason" key={reason}>✓ {reason}</p>)}
        <div className="nearby-actions"><a className="btn btn-primary" href={mapLink || selected.placeUrl} target="_blank" rel="noopener noreferrer" onClick={()=>track('MAP_OPENED',tripSession.id,{category:selected.category})}>지도에서 보기</a>{selected.phone&&<a className="btn btn-text" href={`tel:${selected.phone.replace(/[^0-9+]/g,'')}`}>전화하기</a>}{navigationDestination(selected)&&<button className="btn btn-text" onClick={()=>setNavigationPlace(selected)}>길찾기</button>}<button className="btn btn-text" onClick={()=>addToItinerary(selected)}>{isLodgingCategory(selected.category)?'내 여행 숙소로 저장':'내 여행에 담기'}</button></div>
      </section>}
      {addedPlace&&addedEntity&&addResult&&<ItineraryAddContinuation entity={addedEntity} result={addResult} onStart={navigationDestination(addedPlace)?()=>setNavigationPlace(addedPlace):undefined} onReset={()=>{setAddedPlace(null);setAddedEntity(null);setAddResult(null);setSelected(null)}}/>}
      <section className="card nearby-radius-picker" aria-labelledby="nearby-radius-title"><h2 id="nearby-radius-title">검색 범위를 넓혀볼까요?</h2><p><b>검색 기준 위치</b> {anchor?.label||operationalLocation?.label||'현재 위치'} · <b>현재 선택한 반경</b> {radius/1000}km</p><div role="group" aria-label="검색 반경 선택">{[10000,20000,30000,40000,50000].map(value=><button type="button" key={value} className={radius===value?'active':''} aria-pressed={radius===value} disabled={loading} onClick={()=>selectRadius(value)}>{value/1000}km</button>)}</div></section>
      <section className="card"><h2>{nearbyLabel(category)} 목록{coverageStatus==='COMPLETE'?` · ${radius/1000}km`:' · 일부 범위 확인'}</h2>{searchedAt&&<><p className="nearby-result-summary" role="status">{coverageStatus==='PARTIAL'?'일부 범위까지 확인했습니다. 확인된 장소만 보여드립니다.':expanded?`선택지를 넓히기 위해 주변 ${radius/1000}km까지 함께 찾았습니다.`:tourismSections?'지역에서 확인된 관광자원과 가까운 장소를 함께 찾았습니다.':`가까운 ${nearbyLabel(category)}부터 찾았습니다.`}</p><p className="text-muted">확인 시각 {new Date(searchedAt).toLocaleTimeString(language === 'en' ? 'en-US' : 'ko-KR',{hour:'2-digit',minute:'2-digit'})}</p></>}{places.length === 0&&!distanceBands.length ? <div><p className="text-muted">현재 조건에서 확인된 장소가 없습니다.</p><p className="nearby-range-guidance">검색 반경을 넓히거나 기준 장소를 변경해 보세요.</p>{isFoodCategory(category)&&category!=='FOOD'&&<p className="nearby-range-guidance">다른 음식 종류로 바꾸지 않았습니다. 범위를 넓히거나 ‘전체 음식점’을 선택해 보세요.</p>}</div> : distanceBands.length?distanceBands.map(band=><div className="nearby-result-section nearby-distance-band" key={band.id} data-distance-band={band.id}><h3>{band.label}</h3>{places.filter(place=>place.distanceBandId===band.id).length?places.filter(place=>place.distanceBandId===band.id).map(resultButton):<p className="nearby-range-guidance">{coverageStatus==='PARTIAL'?'외부 검색이 일부 완료되지 않아 이 거리 구간을 모두 확인하지 못했습니다.':'이 거리 구간에서는 확인된 장소가 없습니다.'}</p>}</div>):tourismSections?<>{tourismSections.representative.length>0&&<div className="nearby-result-section"><h3>{tourismRepresentativeTitle(region.regionName)}</h3><p className="nearby-range-guidance">승인·검증된 지역 관광 데이터를 먼저 보여드립니다.</p>{tourismSections.representative.map(resultButton)}</div>}{tourismSections.nearby.length>0&&<div className="nearby-result-section"><h3>현재 위치에서 가까운 곳</h3><p className="nearby-range-guidance">관광 분류와 지역·좌표가 확인된 주변 검색 결과입니다.</p>{tourismSections.nearby.map(resultButton)}</div>}</>:<><div className="nearby-result-section"><h3>{distanceTrusted?'가까운 곳':'확인된 장소'}</h3>{nearbyPlaces.map(resultButton)}</div>{widerPlaces.length>0&&<div className="nearby-result-section"><h3>함께 살펴볼 만한 곳</h3>{widerPlaces.map(resultButton)}</div>}</>}{nextRadius&&<div className="nearby-range-action"><p className="nearby-range-guidance">현재 {radius/1000}km 안에서 지역·분류·좌표가 확인된 장소를 보여드립니다.</p><button type="button" className="btn btn-outline" disabled={loading} onClick={()=>setRequestedRadius(nextRadius)}>더 넓게 찾아보기 · {nextRadius/1000}km</button></div>}</section>
      <ExkoRegionKnowledgeLink regionId={region.id}/>
    </>}
    {navigationPlace&&navigationDestination(navigationPlace)&&<div className="navigation-sheet" role="dialog" aria-modal="true" aria-labelledby="navigation-sheet-title"><button type="button" className="navigation-backdrop" aria-label="내비 선택 닫기" onClick={()=>setNavigationPlace(null)}/><section className="navigation-panel"><button type="button" className="navigation-close" aria-label="닫기" onClick={()=>setNavigationPlace(null)}>×</button><h2 id="navigation-sheet-title">어떤 내비로 이동할까요?</h2><p>{navigationDestination(navigationPlace)!.name}</p><div className="navigation-providers"><button type="button" className="btn btn-outline" onClick={()=>navigateWith('naver')}>네이버지도</button><button type="button" className="btn btn-outline" onClick={()=>navigateWith('kakao')}>카카오맵</button><button type="button" className="btn btn-outline" onClick={()=>navigateWith('tmap')}>TMAP</button></div></section></div>}
  </div>;
}
