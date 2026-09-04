import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { ensureTripSession } from "../tripSession";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import { analyticsScreen } from "../visitorAnalyticsSession";
import { setEntry, visitFor, visitorTrack } from "../visitorAnalytics";
export default function VisitorAnalyticsObserver() {
  const region = useRegion(),
    location = useLocation(),
    { language } = useRegionalLanguage();
  useEffect(() => {
    if (analyticsScreen(location.pathname, region.id) === "UNKNOWN") return;
    const entry = new URLSearchParams(location.search).get("entry");
    if (entry === `regional-qr:${region.id}`) setEntry(region.id, entry);
    const trip = ensureTripSession(region.id);
    visitorTrack(
      analyticsScreen(location.pathname, region.id) === "HOME"
        ? "REGION_HOME_VIEWED"
        : "PAGE_VIEWED",
      region.id,
      trip.anonymousTripId,
    );
  }, [region.id, location.pathname, language]);
  useEffect(() => {
    let last = 0;
    const activity = () => {
      if (
        Date.now() - last < 1000 ||
        analyticsScreen(window.location.pathname, region.id) === "UNKNOWN"
      )
        return;
      last = Date.now();
      try {
        visitFor(region.id);
      } catch {
        /* Optional analytics. */
      }
    };
    window.addEventListener("pointerdown", activity, { passive: true });
    window.addEventListener("keydown", activity);
    return () => {
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [region.id]);
  let marked = false;
  try {
    marked = Boolean(sessionStorage.getItem(`analytics-marker:${region.id}`));
  } catch {
    /* Optional storage. */
  }
  return marked ? (
    <p role="status" className="notice">
      내부 검증 표식 적용 중 / Internal analytics test marker active
    </p>
  ) : null;
}
