import { useState } from "react";
import { useRegion } from "../RegionContext";
import { track } from "../analytics";
import { clearRegionalSavedPlaces, savedPlaceItems } from "../journeyExecution";
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
import { archiveAndStartNewTrip, ensureTripSession } from "../tripSession";

export default function TripManagement({ onSavedPlacesCleared }: { onSavedPlacesCleared?: (places: any[]) => void }) {
  const region = useRegion();
  const [open, setOpen] = useState(false), [confirming, setConfirming] = useState<"CLEAR" | "NEW" | null>(null);
  const session = ensureTripSession(region.id);
  const toggle = () => { const next = !open; setOpen(next); setConfirming(null); if (next) track("TRIP_MANAGEMENT_OPENED", session.id); };
  const clear = () => {
    const updated = clearRegionalSavedPlaces(region.id);
    if (!updated) return;
    onSavedPlacesCleared?.(savedPlaceItems(updated));
    track("SAVED_PLACES_CLEARED", updated.id, { clearedCount: savedPlaceItems(session).length });
    setConfirming(null);
  };
  const startNew = () => {
    const next = archiveAndStartNewTrip(region.id);
    track("NEW_TRIP_STARTED", next.id, { source: "trip-management" });
    window.location.assign(regionalPath("/concierge?mode=plan", region.id));
  };
  return <section className="trip-management">
    <button type="button" className="btn btn-text trip-management-toggle" aria-expanded={open} onClick={toggle}>⋯ 여행 관리</button>
    {open && <div className="trip-management-panel">
      {!confirming && <><button type="button" className="btn btn-outline" onClick={() => setConfirming("CLEAR")} disabled={!savedPlaceItems(session).length}>담아둔 곳 모두 비우기</button><button type="button" className="btn btn-outline" onClick={() => setConfirming("NEW")}>새 여행 시작하기</button></>}
      {confirming === "CLEAR" && <div role="alertdialog" aria-labelledby="clear-saved-title"><strong id="clear-saved-title">담아둔 장소를 모두 비울까요?</strong><p>저장된 전체 일정은 유지됩니다.</p><div className="grid-2"><button type="button" className="btn btn-danger" onClick={clear}>모두 비우기</button><button type="button" className="btn btn-outline" onClick={() => setConfirming(null)}>취소</button></div></div>}
      {confirming === "NEW" && <div role="alertdialog" aria-labelledby="new-trip-title"><strong id="new-trip-title">현재 여행은 보관하고 새 여행을 시작합니다.</strong><div className="grid-2"><button type="button" className="btn btn-primary" onClick={startNew}>새 여행 시작</button><button type="button" className="btn btn-outline" onClick={() => setConfirming(null)}>취소</button></div></div>}
    </div>}
  </section>;
}
