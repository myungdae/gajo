import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { fetchAnonymousTrip, syncAnonymousTrip } from "../api/client";
import { track } from "../analytics";
import { regionalPath } from "../regionRouting";
import {
  archiveAndStartNewTrip,
  ensureTripSession,
  loadTripSession,
  safeTripState,
  saveTripSession,
  type TripSession,
} from "../tripSession";
import { itineraryItemCount, reconcileTrip } from "../tripContinuity";
import { journeyDayCounts } from "../fullJourney";
import { itinerarySteps, savedPlaceItems } from "../journeyExecution";
export default function TripContinuity() {
  const region = useRegion(),
    location = useLocation(),
    navigate = useNavigate(),
    [trip, setTrip] = useState<TripSession>(),
    [visible, setVisible] = useState(false),
    home = location.pathname === "/" || location.pathname === `/${region.id}`;
  useEffect(() => {
    if (!home) return;
    let live = true;
    const local = ensureTripSession(region.id),
      seen = `regional-trip-return-shown-v1:${region.id}:${local.anonymousTripId}`;
    if (sessionStorage.getItem(seen)) return;
    const restore = async () => {
      let restored = local,
        source = "local";
      try {
        const response = await fetchAnonymousTrip(
          local.anonymousTripId,
          region.id,
        );
        restored = reconcileTrip(local, response.state);
        source = "server";
        saveTripSession(restored);
      } catch {
        void syncAnonymousTrip({
          anonymousTripId: local.anonymousTripId,
          regionId: region.id,
          state: safeTripState(local),
        }).catch(() => undefined);
      }
      if (!live || !itineraryItemCount(restored)) return;
      sessionStorage.setItem(seen, "1");
      setTrip(restored);
      setVisible(true);
      track("TRIP_RESTORED", restored.id, {
        source,
        itemCount: itineraryItemCount(restored),
      });
      if ((restored.itinerary as any)?.savedAsFullJourney)
        track("FULL_ITINERARY_RESTORED", restored.id, {
          journeyId: (restored.itinerary as any).journeyId,
          itemCount: itineraryItemCount(restored),
          dayCount: journeyDayCounts(restored.itinerary).length,
        });
    };
    void restore();
    return () => {
      live = false;
    };
  }, [home, region.id]);
  useEffect(() => {
    const sync = () => {
      const current = loadTripSession(localStorage, region.id);
      if (current)
        void syncAnonymousTrip({
          anonymousTripId: current.anonymousTripId,
          regionId: region.id,
          state: safeTripState(current),
        }).catch(() => undefined);
    };
    window.addEventListener("regional-trip-saved", sync);
    return () => window.removeEventListener("regional-trip-saved", sync);
  }, [region.id]);
  if (!visible || !trip) return null;
  const count = itineraryItemCount(trip);
  const dayCount = journeyDayCounts(trip.itinerary).length;
  const fullCount = itinerarySteps(trip.itinerary).length,
    savedCount = savedPlaceItems(trip).length;
  return (
    <section className="card trip-continuity" aria-label="지난 여행 이어가기">
      <h2>지난 {region.regionName} 여행을 이어볼까요?</h2>
      <p>
        {(trip.itinerary as any)?.savedAsFullJourney
          ? `${dayCount > 1 ? `${dayCount - 1}박${dayCount}일 · ` : ""}일정 ${fullCount}곳${savedCount ? ` · 담아둔 곳 ${savedCount}곳` : ""}`
          : `담아둔 곳 ${count}곳이 있습니다.`}
      </p>
      <div className="entity-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            track("TRIP_CONTINUED", trip.id, { itemCount: count });
            setVisible(false);
            navigate(regionalPath("/itinerary", region.id));
          }}
        >
          내 여행 계속하기
        </button>
        <button
          className="btn btn-text"
          onClick={() => {
            const next = archiveAndStartNewTrip(region.id);
            track("NEW_TRIP_STARTED", next.id, {
              previousTripId: trip.anonymousTripId,
            });
            setVisible(false);
          }}
        >
          새 여행 시작
        </button>
      </div>
    </section>
  );
}
