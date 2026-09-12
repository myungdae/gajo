import { useNavigate } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import GajoLiveStatus from "../components/GajoLiveStatus";
import { regionalRuntimeView } from "../regionalRuntime";
import { localizedRegionalPath } from "../visitorRouting";

export default function SafetyPage() {
  const region = useRegion();
  const { language } = useRegionalLanguage();
  const navigate = useNavigate();
  const runtime = regionalRuntimeView(region);

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
        <small>{language === "ko" ? "공식 재난·위험정보" : "OFFICIAL SAFETY INFORMATION"}</small>
        <h2>{language === "ko" ? "연계 준비 중" : "Integration in progress"}</h2>
        <p>
          {language === "ko"
            ? "공식 기상특보·재난·위험정보를 여행 상황과 연결하는 기능을 준비하고 있습니다."
            : "Official weather alerts and emergency information will be connected with the travel context."}
        </p>
      </section>

      <section className="safety-status-card safety-impact-card">
        <small>{language === "ko" ? "내 여행 영향" : "TRIP IMPACT"}</small>
        <h2>{language === "ko" ? "현재 상황을 기준으로 다시 판단합니다" : "Reassess using current conditions"}</h2>
        <p>
          {language === "ko"
            ? "위치·시간·날씨와 현재 여행 일정을 함께 보고 안전한 다음 행동을 검토합니다."
            : "Review location, time, weather and the current itinerary together."}
        </p>

        <button type="button" className="btn btn-primary btn-block" onClick={replan}>
          {language === "ko" ? "안전한 일정으로 다시 보기" : "Review a safer itinerary"}
        </button>
      </section>
    </main>
  );
}