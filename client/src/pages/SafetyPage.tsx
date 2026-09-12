import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import GajoLiveStatus from "../components/GajoLiveStatus";
import {
  fetchSafetyAlerts,
  type SafetyAlertResponse,
} from "../api/client";
import { regionalRuntimeView } from "../regionalRuntime";
import { localizedRegionalPath } from "../visitorRouting";

export default function SafetyPage() {
  const region = useRegion();
  const { language } = useRegionalLanguage();
  const navigate = useNavigate();
  const runtime = regionalRuntimeView(region);

  const [safety, setSafety] = useState<SafetyAlertResponse | null>(null);
  const [safetyLoading, setSafetyLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setSafetyLoading(true);

    fetchSafetyAlerts(region.id)
      .then((result) => {
        if (active) setSafety(result);
      })
      .catch(() => {
        if (active) {
          setSafety({
            status: "UNAVAILABLE",
            source: "KMA",
            checkedAt: new Date().toISOString(),
            alerts: [],
          });
        }
      })
      .finally(() => {
        if (active) setSafetyLoading(false);
      });

    return () => {
      active = false;
    };
  }, [region.id]);

  const replan = () =>
    navigate(localizedRegionalPath("/concierge?mode=now", region.id), {
      state: {
        tripMode: "NOW",
        freeTextOpen: true,
        initialMessage:
          "현재 위치와 날씨, 확인 가능한 안전정보를 바탕으로 내 여행에 영향이 있는지 확인하고 안전한 다음 일정을 제안해 주세요.",
        autoSubmit: true,
      },
    });

  const safetyHeading =
    safetyLoading
      ? language === "ko"
        ? "공식 안전정보 확인 중"
        : "Checking official safety information"
      : safety?.status === "NOT_CONFIGURED"
        ? language === "ko"
          ? "공식 기상특보 연계 준비 중"
          : "Official weather alert integration pending"
        : safety?.status === "UNAVAILABLE"
          ? language === "ko"
            ? "공식 안전정보를 현재 확인할 수 없습니다"
            : "Official safety information is currently unavailable"
          : safety && safety.alerts.length > 0
            ? language === "ko"
              ? `현재 특보 ${safety.alerts.length}건`
              : `${safety.alerts.length} active alert(s)`
            : language === "ko"
              ? "현재 확인된 활성 특보가 없습니다"
              : "No active alerts currently confirmed";

  const safetyDescription =
    safety?.status === "NOT_CONFIGURED"
      ? language === "ko"
        ? "기상청 공식 특보 데이터 연계를 준비하고 있습니다. 아직 공식 재난정보가 없다는 뜻은 아닙니다."
        : "KMA official alert data integration is being prepared. This does not mean there are no hazards."
      : safety?.status === "UNAVAILABLE"
        ? language === "ko"
          ? "공식 데이터 연결 상태를 확인한 뒤 다시 시도해 주세요."
          : "Please try again after the official data connection is restored."
        : language === "ko"
          ? "기상청 공식 특보 정보를 기준으로 현재 상태를 확인합니다."
          : "Current status is checked against official KMA alert information.";

  return (
    <main className="safety-page">
      <header className="safety-page-head">
        <small>EXKOVIA RUNTIME SAFETY</small>
        <h1>{language === "ko" ? "안전·재난" : "Safety & Emergency"}</h1>
        <p>
          {language === "ko"
            ? "현재 상황을 확인하고 여행에 미칠 수 있는 영향을 살펴봅니다."
            : "Check current conditions and possible impacts on your trip."}
        </p>
      </header>

      <section className="safety-status-card">
        <small>{language === "ko" ? "현재 상황" : "CURRENT CONDITIONS"}</small>
        <GajoLiveStatus
          regionName={region.regionName}
          regionId={region.id}
          liveEnabled={runtime.weatherEnabled}
        />
      </section>

      <section className="safety-status-card">
        <small>
          {language === "ko"
            ? "공식 재난·위험정보"
            : "OFFICIAL SAFETY INFORMATION"}
        </small>

        <h2>{safetyHeading}</h2>
        <p>{safetyDescription}</p>

        {safety?.status === "READY" &&
          safety.alerts.map((alert) => (
            <div key={alert.id} className="safety-alert-item">
              <strong>{alert.title}</strong>
              <span>
                {alert.sourceName}
                {alert.rawRegionName ? ` · ${alert.rawRegionName}` : ""}
              </span>
            </div>
          ))}
      </section>

      <section className="safety-status-card safety-impact-card">
        <small>{language === "ko" ? "내 여행 영향" : "TRIP IMPACT"}</small>
        <h2>
          {language === "ko"
            ? "현재 상황을 기준으로 다시 판단합니다"
            : "Reassess using current conditions"}
        </h2>
        <p>
          {language === "ko"
            ? "위치·시간·날씨와 현재 여행 일정을 함께 보고 안전한 다음 행동을 검토합니다."
            : "Review location, time, weather and the current itinerary together."}
        </p>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={replan}
        >
          {language === "ko"
            ? "안전한 일정으로 다시 보기"
            : "Review a safer itinerary"}
        </button>
      </section>
    </main>
  );
}