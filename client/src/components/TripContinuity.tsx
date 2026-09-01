import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { fetchAnonymousTrip, syncAnonymousTrip } from "../api/client";
import { track } from "../analytics";
import { regionalPath } from "../regionRouting";
import {
  archiveAndStartNewTrip,
  loadTripSession,
  safeTripState,
  saveTripSession,
  hasTripEvidence,
  tripRestorationDiagnostics,
  type TripSession,
} from "../tripSession";
import { itineraryItemCount, reconcileTrip } from "../tripContinuity";
import { journeyDayCounts } from "../fullJourney";
import { itinerarySteps, savedPlaceItems } from "../journeyExecution";
import { continueTripLabel, homeTripSummary } from "../homeExperience";
export default function TripContinuity() {
  const region = useRegion(),
    location = useLocation(),
    navigate = useNavigate(),
    [trip, setTrip] = useState<TripSession>(),
    [visible, setVisible] = useState(false),
    [confirmingNew, setConfirmingNew] = useState(false),
    home = location.pathname === "/" || location.pathname === `/${region.id}`;
  useEffect(() => {
    if (!home) return;
    let live = true;
    const local = loadTripSession(localStorage, region.id);
    if (!local || !hasTripEvidence(local)) {
      setTrip(undefined);
      setVisible(false);
      return;
    }
    setTrip(local);
    setVisible(true);
    if (import.meta.env.DEV)
      console.debug("[trip-restoration]", tripRestorationDiagnostics(region.id));
    const restore = async () => {
      let restored = local,
        source = "local";
      try {
        const response = await fetchAnonymousTrip(
          local.anonymousTripId,
          region.id,
          local.deletionToken,
        );
        restored = reconcileTrip(local, response.state);
        source = "server";
        restored = saveTripSession(restored);
      } catch {
        void syncAnonymousTrip({
          anonymousTripId: local.anonymousTripId,
          regionId: region.id,
          state: safeTripState(local),
          deletionToken: local.deletionToken,
        }).catch(() => undefined);
      }
      if (!live || !itineraryItemCount(restored)) return;
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
          deletionToken: current.deletionToken,
        }).catch(() => undefined);
    };
    window.addEventListener("regional-trip-saved", sync);
    return () => window.removeEventListener("regional-trip-saved", sync);
  }, [region.id]);
  if (!visible || !trip) return null;
  const count = itineraryItemCount(trip), summary = homeTripSummary(trip);
  const dayCount = journeyDayCounts(trip.itinerary).length;
  const fullCount = itinerarySteps(trip.itinerary).length,
    savedCount = savedPlaceItems(trip).length;
  return (
    <section className="home-resume-card" aria-labelledby="resume-trip-title">
      <small>나의 여행</small>
      <h2 id="resume-trip-title">이어갈 여행이 있어요</h2>
      {region.id === "hapcheon" ? <><p className="home-resume-heading">{summary.heading}</p>{summary.detail&&<p>{summary.detail}</p>}</> : <p>{(trip.itinerary as any)?.savedAsFullJourney ? `${dayCount > 1 ? `${dayCount - 1}박${dayCount}일 · ` : ""}일정 ${fullCount}곳${savedCount ? ` · 담아둔 곳 ${savedCount}곳` : ""}` : `담아둔 곳 ${count}곳이 있습니다.`}</p>}
      <div className="entity-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            track("TRIP_CONTINUED", trip.id, { itemCount: count });
            setVisible(false);
            navigate(regionalPath("/itinerary", region.id));
          }}
        >
          {continueTripLabel(trip)}
        </button>
        <button
          className="btn btn-text"
          onClick={() => setConfirmingNew(true)}
        >
          새 여행 만들기
        </button>
      </div>
      {confirmingNew && (
        <div role="alertdialog" aria-labelledby="continuity-new-trip-title">
          <strong id="continuity-new-trip-title">현재 여행은 보관하고 새 여행을 시작할까요?</strong>
          <div className="grid-2">
            <button className="btn btn-primary" onClick={() => {
              const next = archiveAndStartNewTrip(region.id);
              track("NEW_TRIP_STARTED", next.id);
              setConfirmingNew(false);
              setVisible(false);
            }}>새 여행 시작</button>
            <button className="btn btn-outline" onClick={() => setConfirmingNew(false)}>취소</button>
          </div>
        </div>
      )}
      <p className="home-new-trip-copy">새로운 동행·시간·목적으로 다시 계획합니다.</p>
    </section>
  );
}
