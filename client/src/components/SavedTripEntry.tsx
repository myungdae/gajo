import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { track } from "../analytics";
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
import {
  archiveAndStartNewTrip,
  ensureTripSession,
  hasSavedTrip,
} from "../tripSession";
export default function SavedTripEntry() {
  const region = useRegion(),
    navigate = useNavigate(),
    session = ensureTripSession(region.id),
    [starting, setStarting] = useState(false),
    [confirming, setConfirming] = useState(false);
  if (!hasSavedTrip(session)) return null;
  const load = () => {
    track("SAVED_TRIP_LOADED", session.id, { source: "planning-entry" });
    navigate(regionalPath("/itinerary", region.id));
  };
  const start = () => {
    setStarting(true);
    archiveAndStartNewTrip(region.id);
    window.location.assign(regionalPath("/concierge?mode=plan", region.id));
  };
  return (
    <section className="card saved-trip-entry" aria-label="저장한 내 여행">
      <strong>저장한 {region.regionName} 여행이 있습니다.</strong>
      <p>전에 담아둔 곳과 저장한 일정을 다시 열 수 있어요.</p>
      <div className="grid-2">
        <button type="button" className="btn btn-primary" onClick={load}>
          내 여행 불러오기
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setConfirming(true)}
          disabled={starting}
        >
          {starting ? "새로운 여행 준비 중…" : "새로운 여행 시작하기"}
        </button>
      </div>
      {confirming && (
        <div role="alertdialog" aria-labelledby="saved-entry-new-trip-title">
          <strong id="saved-entry-new-trip-title">지금 여행은 그대로 두고 새로운 여행을 시작할까요?</strong>
          <div className="grid-2">
            <button type="button" className="btn btn-primary" onClick={start}>새로운 여행 시작</button>
            <button type="button" className="btn btn-outline" onClick={() => setConfirming(false)}>지금 여행 계속</button>
          </div>
        </div>
      )}
      <small>함께하는 사람이나 여행 시간이 달라졌다면 새로 시작할 수 있어요. 지금 여행은 그대로 보관됩니다.</small>
    </section>
  );
}
