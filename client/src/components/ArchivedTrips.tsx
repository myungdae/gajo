import { useState } from "react";
import { useRegion } from "../RegionContext";
import { itinerarySteps, savedPlaceItems } from "../journeyExecution";
import { recommendationItemLabel } from "../recommendationItem";
import { canonicalEntityId } from "../recommendationItem";
import { listArchivedTripSessions, type TripSession } from "../tripSession";

export default function ArchivedTrips() {
  const region = useRegion();
  const [selected, setSelected] = useState<TripSession>();
  const trips = listArchivedTripSessions(region.id);
  if (!trips.length) return null;
  return (
    <section className="card archived-trips" aria-labelledby="archived-trips-title">
      <h2 id="archived-trips-title">지난 여행</h2>
      <p>보관된 여행을 읽기 전용으로 볼 수 있어요. 현재 여행은 바뀌지 않습니다.</p>
      {trips.map((trip, index) => {
        const steps = itinerarySteps(trip.itinerary);
        const places = savedPlaceItems(trip);
        const items = [...steps, ...places].filter((item, itemIndex, all) =>
          all.findIndex((candidate) => canonicalEntityId(candidate) === canonicalEntityId(item)) === itemIndex,
        );
        return (
          <div className="archived-trip-summary" key={trip.anonymousTripId}>
            <strong>{new Date(trip.updatedAt).toLocaleDateString("ko-KR")} {region.regionName} 여행</strong>
            <span>일정 {steps.length}곳 · 담아둔 곳 {places.length}곳</span>
            <button className="btn btn-outline" type="button" onClick={() => setSelected(selected?.anonymousTripId === trip.anonymousTripId ? undefined : trip)}>
              {selected?.anonymousTripId === trip.anonymousTripId ? "접기" : `지난 여행 ${index + 1} 보기`}
            </button>
            {selected?.anonymousTripId === trip.anonymousTripId && (
              <ol className="archived-trip-items">
                {items.map((item, itemIndex) => (
                  <li key={`${item.entityId || item.itemId || itemIndex}:${itemIndex}`}>{recommendationItemLabel(item)}</li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </section>
  );
}
