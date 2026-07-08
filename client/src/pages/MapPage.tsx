import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchFacilities } from '../api/client';
import { shortUri } from '../utils/uri';

// Gajo-myeon (가조면), Geochang-gun, Gyeongsangnam-do approximate center.
const GAJO_CENTER: [number, number] = [35.7423, 127.9528];

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// The ontology does not encode lat/long for facilities (it's a
// business/wellness ontology, not a GIS one), so we deterministically
// scatter facility markers within a small radius of the Gajo hot spring
// complex based on a hash of their URI. This keeps marker positions
// stable across reloads without needing separate GIS data entry for MVP.
function hashOffset(uri: string): [number, number] {
  let h = 0;
  for (let i = 0; i < uri.length; i++) {
    h = (h * 31 + uri.charCodeAt(i)) >>> 0;
  }
  const dx = ((h % 1000) / 1000 - 0.5) * 0.012;
  const dy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.012;
  return [dx, dy];
}

export default function MapPage() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFacilities()
      .then(setFacilities)
      .finally(() => setLoading(false));
  }, []);

  const markers = useMemo(
    () =>
      facilities.map((f) => {
        const [dx, dy] = hashOffset(f.uri);
        return { ...f, position: [GAJO_CENTER[0] + dx, GAJO_CENTER[1] + dy] as [number, number] };
      }),
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
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map((m) => (
              <Marker key={m.uri} position={m.position} icon={icon}>
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
          </MapContainer>
        </div>
      )}

      <div className="card">
        <h2>시설 목록</h2>
        {facilities.map((f) => (
          <div key={f.uri} style={{ marginBottom: 10, fontSize: 13 }}>
            <b>{f.label}</b> <span className="badge muted">{shortUri(f.uri)}</span>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {f.comment}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
