import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { fetchAnonymousTrip, syncAnonymousTrip } from "../api/client";
import { track } from "../analytics";
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
import {
  archiveAndStartNewTrip,
  hasTripEvidence,
  loadTripSession,
  safeTripState,
  saveTripSession,
  tripRestorationDiagnostics,
  type TripSession,
} from "../tripSession";
import { itineraryItemCount, reconcileTrip } from "../tripContinuity";
import { journeyDayCounts } from "../fullJourney";
import { useRegionalLanguage } from "../RegionalLanguageContext";
export default function TripContinuity({onNewTrip}:{onNewTrip?:()=>void}={}) {
  const region = useRegion(),
    {language,withLanguage}=useRegionalLanguage(),
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
      if (!live || !hasTripEvidence(restored)) return;
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
  const count = itineraryItemCount(trip);
  return (
    <section className="home-trip-secondary" aria-labelledby="resume-trip-title">
      <p id="resume-trip-title">{language==='en'?'Your previous trip is here.':'지난 여행이 남아 있어요.'}</p>
      <div className="entity-actions">
        <button className="btn btn-primary home-trip-continue" onClick={()=>{track('TRIP_CONTINUED',trip.id,{itemCount:count});navigate(withLanguage(regionalPath('/concierge?mode=now',region.id)),{state:{tripMode:'NOW'}})}}>{language==='en'?'Continue Previous Trip':'▶ 지난 여행 이어가기'}</button>
        <button className="btn btn-outline home-trip-new" onClick={()=>setConfirmingNew(true)}>{language==='en'?'Start a New Trip':'＋ 새 여행 시작하기'}</button>
      </div>
      {confirmingNew && (
        <div role="alertdialog" aria-labelledby="continuity-new-trip-title">
          <strong id="continuity-new-trip-title">{language==='en'?'Archive this trip and start a new one?':'지금 여행은 그대로 두고 새로운 여행을 시작할까요?'}</strong>
          <div className="grid-2">
            <button className="btn btn-primary" onClick={() => {
              const next = archiveAndStartNewTrip(region.id);
              track("NEW_TRIP_STARTED", next.id);
              setConfirmingNew(false);
              setVisible(false);
              onNewTrip?.();
            }}>{language==='en'?'Start New Trip':'새로운 여행 시작'}</button>
            <button className="btn btn-outline" onClick={() => setConfirmingNew(false)}>{language==='en'?'Cancel':'지금 여행 계속'}</button>
          </div>
        </div>
      )}

    </section>
  );
}
