import { useState } from "react";
import { useRegion } from "../RegionContext";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import ConciergeDemoOverlay from "../components/ConciergeDemoOverlay";

export default function TravelAssistantAboutPage() {
  const region = useRegion();
  const { language } = useRegionalLanguage();
  const [showDemo, setShowDemo] = useState(false);
  const [showDifference, setShowDifference] = useState(false);

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

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowDifference(open => !open)}
            aria-expanded={showDifference}
          >
            {language === "ko"
              ? "ChatGPT와 어떻게 다른가?"
              : "How is this different from ChatGPT?"}
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowDemo(true)}
          >
            {language === "ko" ? "소개 영상 보기" : "Watch introduction"}
          </button>
        </div>

        {showDifference && (
          <div style={{ marginTop: 16 }}>
            <p>
              {language === "ko"
                ? "ChatGPT와 Gemini 같은 범용 AI는 다양한 질문에 폭넓게 답하고, 지도 앱은 장소 검색과 길 안내에 강합니다. EXKOVIA는 지역 정보와 여행자의 위치·시간·날씨·상황을 함께 살펴 지금 필요한 장소를 추천하고, 지도 보기와 길찾기 등 다음 행동까지 안내하는 지역 맞춤형 AI 컨시어지입니다."
                : "General AI such as ChatGPT and Gemini can answer a wide range of questions, while map apps are strong at place search and navigation. EXKOVIA is a locally tailored AI concierge that considers regional information together with the traveler's location, time, weather and situation, recommends what is useful now, and connects the traveler to next actions such as maps and directions."}
            </p>

            <a
              href="https://exkovia.com/#why-exkovia"
              className="app-header__all-regions"
            >
              {language === "ko"
                ? "더 자세히 알아보기"
                : "Learn more"}
            </a>
          </div>
        )}
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
