import { useState } from "react";
import { useRegion } from "../RegionContext";
import { recommendationItemLabel } from "../recommendationItem";
import { canonicalEntityId } from "../recommendationItem";
import { deleteAllArchivedTripSessions, deleteArchivedTripSession, listArchivedTripSessions, type TripSession } from "../tripSession";
import { archivedTripDate, archivedTripStartTime, archivedTripSummary, DEFAULT_ARCHIVE_COUNT } from "../archivePresentation";
import { deleteAnonymousTrip } from "../api/client";

export default function ArchivedTrips() {
  const region = useRegion();
  const [selected, setSelected] = useState<TripSession>();
  const [showAll, setShowAll] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirming, setConfirming] = useState<string | "ALL">();
  const trips = listArchivedTripSessions(region.id);
  const refresh = () => { setSelected(undefined); setConfirming(undefined); setRevision((value) => value + 1); };
  const removeRemote = (trip:TripSession) => trip.deletionToken ? deleteAnonymousTrip(trip.anonymousTripId,region.id,trip.deletionToken).catch(()=>undefined) : Promise.resolve();
  void revision;
  return (
    <section className="card archived-trips" aria-labelledby="archived-trips-title">
      <h2 id="archived-trips-title">지난 여행</h2>
      <p>과거 여행 상세는 읽기 전용으로 확인하거나 기록 전체를 삭제할 수 있어요. 현재 여행은 바뀌지 않습니다.</p>
      {!trips.length && <p className="archived-trips-empty">아직 지난 여행 기록이 없습니다.</p>}
      {(showAll ? trips : trips.slice(0, DEFAULT_ARCHIVE_COUNT)).map((trip) => {
        const { steps, saved: places, completed, skipped, replaced, newlyAdded } = archivedTripSummary(trip);
        const items = [...steps, ...places].filter((item, itemIndex, all) =>
          all.findIndex((candidate) => canonicalEntityId(candidate) === canonicalEntityId(item)) === itemIndex,
        );
        return (
          <div className="archived-trip-summary" key={trip.anonymousTripId}>
            <details className="archived-trip-menu">
              <summary aria-label={`${archivedTripDate(trip)} 여행 메뉴`}>⋮</summary>
              <button type="button" onClick={() => setConfirming(trip.anonymousTripId)}>여행 기록 삭제</button>
            </details>
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
            {confirming === trip.anonymousTripId && <div className="archive-delete-confirm" role="alertdialog" aria-modal="true"><p>이 여행 기록을 삭제하시겠습니까?</p><div><button className="btn btn-danger" type="button" onClick={() => { deleteArchivedTripSession(region.id, trip.anonymousTripId); void removeRemote(trip); refresh(); }}>삭제</button><button className="btn btn-text" type="button" onClick={() => setConfirming(undefined)}>취소</button></div></div>}
          </div>
        );
      })}
      {trips.length > DEFAULT_ARCHIVE_COUNT && (
        <button className="btn btn-text archived-trips-more" type="button" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "지난 여행 접기" : "지난 여행 더보기"}
        </button>
      )}
      {trips.length > 0 && <><button className="btn btn-text archived-trips-delete-all" type="button" onClick={() => setConfirming("ALL")}>전체 여행 기록 삭제</button>{confirming === "ALL" && <div className="archive-delete-confirm" role="alertdialog" aria-modal="true"><p>현재 진행 중인 여행은 유지하고, 과거 여행 기록을 모두 삭제하시겠습니까?</p><div><button className="btn btn-danger" type="button" onClick={() => { deleteAllArchivedTripSessions(region.id); for(const trip of trips) void removeRemote(trip); refresh(); }}>삭제</button><button className="btn btn-text" type="button" onClick={() => setConfirming(undefined)}>취소</button></div></div>}</>}
    </section>
  );
}
