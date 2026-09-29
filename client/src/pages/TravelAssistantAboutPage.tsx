import { useState } from "react";
import { useRegion } from "../RegionContext";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import ConciergeDemoOverlay from "../components/ConciergeDemoOverlay";

export default function TravelAssistantAboutPage() {
  const region = useRegion();
  const { language } = useRegionalLanguage();
  const [showDemo, setShowDemo] = useState(false);

  return (
    <article className="regional-home">
      <section className="card">
        <small>
          {language === "ko" ? "여행도우미 소개" : "About Your Travel Assistant"}
        </small>

        <h1>
          {language === "ko"
            ? "이 여행도우미는 무엇이 다른가요?"
            : "What makes this travel assistant different?"}
        </h1>

        <p>
          {language === "ko"
            ? "여행자의 현재 위치·시간·날씨와 여행 상황을 함께 살펴보고, 지역의 정보를 바탕으로 지금 필요한 곳을 제안하며 지도·길찾기·전화 등 실제 다음 행동까지 연결합니다."
            : "It considers your current location, time, weather and travel situation, uses local information to suggest what you need now, and connects you to practical next actions such as maps, directions and calls."}
        </p>

        <p>
          {language === "ko"
            ? "ChatGPT·Gemini 같은 범용 AI는 다양한 질문에 답하는 데 강하고, 지도·내비게이션은 장소 검색과 이동에 강합니다. 이 여행도우미는 이를 대신하는 것이 아니라, 지역의 정보와 여행자의 지금 상황을 연결해 다음 행동을 돕습니다."
            : "General AI such as ChatGPT and Gemini is strong at answering a wide range of questions, while maps and navigation are strong at finding places and routes. This travel assistant does not replace them; it connects local information with your current travel situation to help you take the next action."}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowDemo(true)}
          >
            {language === "ko" ? "소개 영상 보기" : "Watch introduction"}
          </button>

          <a
            className="btn btn-outline"
            href="https://exkovia.com/#why-exkovia"
          >
            {language === "ko"
              ? "자세한 차이 알아보기"
              : "See the differences"}
          </a>
        </div>
      </section>

      <ConciergeDemoOverlay
        open={showDemo}
        regionName={region.regionName}
        onClose={() => setShowDemo(false)}
        onStartTrip={() => setShowDemo(false)}
        startLabel={language === "ko" ? "닫기" : "Close"}
      />
    </article>
  );
}
