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
import { hasActiveItinerary, itineraryItemCount, reconcileTrip } from "../tripContinuity";
import { journeyDayCounts } from "../fullJourney";
import { itinerarySteps, savedPlaceItems } from "../journeyExecution";
import { continueTripLabel, homeTripSummary } from "../homeExperience";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import { getRegionalHomeEnglish } from "../regionConfig";
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
  const count = itineraryItemCount(trip), summary = homeTripSummary(trip), active = hasActiveItinerary(trip);
  const dayCount = journeyDayCounts(trip.itinerary).length;
  const fullCount = itinerarySteps(trip.itinerary).length,
    savedCount = savedPlaceItems(trip).length;
  return (
    <section className="home-resume-card" aria-labelledby="resume-trip-title">
      <small>{language==='en'?'My Trip':'나의 여행'}</small>
      <h2 id="resume-trip-title">{active?(language==='en'?`Continue Your ${getRegionalHomeEnglish(region).regionName} Trip`:`이어갈 ${region.regionName} 여행이 있어요`):(language==='en'?`Start Your ${getRegionalHomeEnglish(region).regionName} Journey`:`지금의 조건으로 ${region.regionName} 여행을 시작해 볼까요?`)}</h2>
      {active&&(language==='en'?<p>{`${fullCount||count} saved ${(fullCount||count)===1?'place':'places'}${savedCount?` · ${savedCount} additional saved`:''}`}</p>:region.id === "hapcheon" ? <><p className="home-resume-heading">{summary.heading}</p>{summary.detail&&<p>{summary.detail}</p>}</> : <p>{`${dayCount > 1 ? `${dayCount - 1}박${dayCount}일 · ` : ""}일정 ${fullCount}곳${savedCount ? ` · 담아둔 곳 ${savedCount}곳` : ""}`}</p>)}
      {!active&&<p>{language==='en'?'Your saved preferences are ready. Create a journey for your situation now.':'앞서 선택한 여행 조건을 유지하고, 지금 상황에 맞는 여정을 만들 수 있습니다.'}</p>}
      <div className="entity-actions">
        {active&&<button
          className="btn btn-primary"
          onClick={() => {
            track("TRIP_CONTINUED", trip.id, { itemCount: count });
            setVisible(false);
            navigate(withLanguage(regionalPath("/itinerary", region.id)));
          }}
        >
          {language==='en'?'Continue Trip':continueTripLabel(trip)}
        </button>}
        <button
          className="btn btn-outline"
          onClick={()=>{track(active?'RUNTIME_JOURNEY_REPLAN_REQUESTED':'RUNTIME_JOURNEY_REQUESTED',trip.id,{mode:'NOW'});navigate(withLanguage(regionalPath('/concierge?mode=now',region.id)),{state:{tripMode:'NOW',initialMessage:active?(language==='en'?'Re-plan my remaining journey for my verified situation now.':'확인된 지금 상황에 맞춰 남은 여정을 다시 구성해 주세요.'):(language==='en'?'Create a journey from my saved preferences and verified situation now.':'앞서 선택한 여행 조건과 확인된 지금 상황으로 여정을 만들어 주세요.'),autoSubmit:true}})}}
        >{active?(language==='en'?'Re-plan for Now':'지금 상황에 맞게 다시 짜기'):(language==='en'?'Create for My Situation':'현재 상황으로 여정 만들기')}</button>
        <button
          className="btn btn-text"
          onClick={() => setConfirmingNew(true)}
        >
          {language==='en'?'Start a New Trip':'새로운 여행 시작하기'}
        </button>
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
      <p className="home-new-trip-copy">{language==='en'?'Start fresh with new companions, timing, or goals.':'함께하는 사람이나 여행 시간이 달라졌다면 새로 시작할 수 있어요.'}</p>
    </section>
  );
}
