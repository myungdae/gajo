import { useState } from "react";
import { useRegion } from "../RegionContext";
import { recommendationItemLabel } from "../recommendationItem";
import { canonicalEntityId } from "../recommendationItem";
import { listArchivedTripSessions, type TripSession } from "../tripSession";
import { archivedTripDate, archivedTripStartTime, archivedTripSummary, DEFAULT_ARCHIVE_COUNT } from "../archivePresentation";

export default function ArchivedTrips() {
  const region = useRegion();
  const [selected, setSelected] = useState<TripSession>();
  const [showAll, setShowAll] = useState(false);
  const trips = listArchivedTripSessions(region.id);
  if (!trips.length) return null;
  return (
    <section className="card archived-trips" aria-labelledby="archived-trips-title">
      <h2 id="archived-trips-title">지난 여행</h2>
      <p>보관된 여행을 읽기 전용으로 볼 수 있어요. 현재 여행은 바뀌지 않습니다.</p>
      {(showAll ? trips : trips.slice(0, DEFAULT_ARCHIVE_COUNT)).map((trip) => {
        const { steps, saved: places, completed, skipped, replaced, newlyAdded } = archivedTripSummary(trip);
        const items = [...steps, ...places].filter((item, itemIndex, all) =>
          all.findIndex((candidate) => canonicalEntityId(candidate) === canonicalEntityId(item)) === itemIndex,
        );
        return (
          <div className="archived-trip-summary" key={trip.anonymousTripId}>
            <strong>{archivedTripDate(trip)} {region.regionName} 여행</strong>
            {archivedTripStartTime(trip) && <small>{archivedTripStartTime(trip)} 시작</small>}
            <span>{steps.length ? `방문 완료 ${completed.length}곳 · 계획 ${steps.length}곳${places.length ? ` · 담아둔 곳 ${places.length}곳` : ""}` : places.length ? `담아둔 곳 ${places.length}곳` : "일정 없음"}</span>
            <button className="btn btn-outline" type="button" onClick={() => setSelected(selected?.anonymousTripId === trip.anonymousTripId ? undefined : trip)}>
              {selected?.anonymousTripId === trip.anonymousTripId ? "여행 기록 접기" : "여행 기록 보기"}
            </button>
            {selected?.anonymousTripId === trip.anonymousTripId && (
              <div className="archived-trip-detail">
                {items.length ? <ol className="archived-trip-items">{items.map((item, itemIndex) => <li key={`${item.entityId || item.itemId || itemIndex}:${itemIndex}`}>{recommendationItemLabel(item)}</li>)}</ol> : <p>기록된 일정이 없습니다.</p>}
                {completed.length > 0 && <p>방문 완료 {completed.length}곳</p>}
                {skipped.length > 0 && <p>건너뜀 {skipped.length}곳</p>}
                {replaced.length > 0 && <p>재계획으로 변경됨 {replaced.length}곳</p>}
                {newlyAdded.length > 0 && <p>재계획에서 추가됨 {newlyAdded.length}곳</p>}
              </div>
            )}
          </div>
        );
      })}
      {trips.length > DEFAULT_ARCHIVE_COUNT && (
        <button className="btn btn-text archived-trips-more" type="button" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "지난 여행 접기" : "지난 여행 더보기"}
        </button>
      )}
    </section>
  );
}
