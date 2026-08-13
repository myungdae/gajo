import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchFacilities } from '../api/client';
import { getSessionLocation, isOperationalLocation } from '../utils/visitorLocation';
import { useSearchParams } from 'react-router-dom';

// Gajo-myeon (가조면), Geochang-gun, Gyeongsangnam-do approximate center.
const GAJO_CENTER: [number, number] = [35.7423, 127.9528];

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
function categoryIcon(category?:string){const color=category?.includes('온천')?'#dc2626':category?.includes('음식')?'#ea580c':category?.includes('카페')?'#7c3aed':category?.includes('산림')?'#15803d':'#0f766e';return L.divIcon({className:'facility-map-marker',html:`<div style="width:18px;height:18px;border-radius:4px;background:${color};border:2px solid white;box-shadow:0 1px 5px #334155"></div>`,iconSize:[18,18],iconAnchor:[9,9]})}

// Only facilities with reliable source coordinates receive a marker.
function FitKnownPoints({ points }: { points: [number, number][] }) { const map=useMap(); useEffect(()=>{ if(points.length>1) map.fitBounds(points,{padding:[30,30]}); else if(points.length===1) map.setView(points[0],15); },[map,points]); return null; }
function FocusPoint({ point }: { point?: [number, number] }) { const map=useMap(); useEffect(()=>{if(point)map.setView(point,16)},[map,point]); return null; }

export default function MapPage() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const visitor = getSessionLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchFacilities()
      .then(setFacilities)
      .finally(() => setLoading(false));
  }, []);

  const markers = useMemo(
    () =>
      facilities.map((f) => { const latitude=Number(f.literalProps?.latitude ?? f.literalProps?.lat), longitude=Number(f.literalProps?.longitude ?? f.literalProps?.lng ?? f.literalProps?.lon); return Number.isFinite(latitude)&&Number.isFinite(longitude)?{...f,position:[latitude,longitude] as [number,number]}:null; }).filter(Boolean) as any[],
    [facilities],
  );

  return (
    <div>
      <div className="card">
        <h2>가조 온천단지 시설 지도</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          온톨로지에 등록된 시설(Facility) 개체들을 지도에서 확인하세요. 실내/접근성 정보는
          온톨로지 속성(isIndoor, isAccessible)에서 그대로 가져옵니다.
        </p>
      </div>

      {loading ? (
        <div className="loading">시설 정보를 불러오는 중...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <MapContainer center={GAJO_CENTER} zoom={14} style={{ height: '55vh', width: '100%' }}>
            <FitKnownPoints points={[...(isOperationalLocation(visitor)?[[visitor!.latitude!,visitor!.longitude!] as [number,number]]:[]),...markers.map((m)=>m.position)]} />
            <FocusPoint point={markers.find((m)=>m.uri===searchParams.get('entityUri'))?.position} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map((m) => (
              <Marker key={m.uri} position={m.position} icon={categoryIcon(m.literalProps?.category)}>
                <Popup>
                  <b>{m.label}</b>
                  <br />
                  {m.comment}
                  <br />
                  {m.literalProps?.isIndoor === 'true' && <span>🏠 실내 시설</span>}
                  {m.literalProps?.isAccessible === 'true' && <span> · ♿ 접근성 양호</span>}
                </Popup>
              </Marker>
            ))}
            {isOperationalLocation(visitor) && <Marker position={[visitor!.latitude!,visitor!.longitude!]} icon={icon}><Popup><b>현재 위치</b></Popup></Marker>}
          </MapContainer>
        </div>
      )}

      <div className="card">
        <h2>시설 목록</h2>
        {facilities.map((f) => (
          <div key={f.uri} style={{ marginBottom: 10, fontSize: 13 }}>
            <b>{f.label}</b>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {f.comment}
            </p>
            {!Number.isFinite(Number(f.literalProps?.latitude)) && <small style={{color:'var(--color-text-muted)'}}>지도 위치 미확인</small>}
          </div>
        ))}
      </div>
    </div>
  );
}
