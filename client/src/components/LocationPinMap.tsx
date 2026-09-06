import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
type Point = { latitude: number; longitude: number };
const icon = L.divIcon({
  className: "location-review-pin",
  html: '<span aria-hidden="true">📍</span>',
  iconSize: [32, 36],
  iconAnchor: [16, 32],
});
function Pin({
  point,
  onChange,
  editable,
}: {
  point?: Point;
  onChange: (point: Point) => void;
  editable: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (point) map.panTo([point.latitude, point.longitude]);
  }, [map, point?.latitude, point?.longitude]);
  useMapEvents({
    click: (e) => {
      if (editable)
        onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return point ? (
    <Marker
      position={[point.latitude, point.longitude]}
      icon={icon}
      draggable={editable}
      title="검토할 위치 핀"
      alt="검토할 위치 핀"
      eventHandlers={{
        dragend: (e) => {
          const p = e.target.getLatLng();
          onChange({ latitude: p.lat, longitude: p.lng });
        },
      }}
    />
  ) : null;
}
export default function LocationPinMap({
  point,
  current,
  center,
  editable,
  onChange,
}: {
  point?: Point;
  current?: Point;
  center?: Point;
  editable: boolean;
  onChange: (p: Point) => void;
}) {
  const start = point ||
    current ||
    center || { latitude: 36.5, longitude: 127.5 };
  return (
    <div className="location-pin-map" aria-label="위치 검토 지도">
      <MapContainer
        center={[start.latitude, start.longitude]}
        zoom={point || current ? 16 : center ? 11 : 7}
        style={{ height: 320, width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {current && (
          <CircleMarker
            center={[current.latitude, current.longitude]}
            radius={8}
            pathOptions={{ color: "#2563eb" }}
          />
        )}
        <Pin point={point} onChange={onChange} editable={editable} />
      </MapContainer>
      <p>
        파란 원: 현재 좌표 · 핀: 검토할 좌표. 지도에서 선택하거나 핀을 이동해도
        공개되지 않습니다. 키보드로는 아래 위도·경도 입력란을 이용해 주세요.
      </p>
    </div>
  );
}
