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
            ? "찾아오는 여행도우미"
            : "Your Local Travel Companion"}
        </h1>

        <p>
          {language === "ko"
            ? "여행자의 현재 위치·시간·날씨와 여행 상황을 함께 살펴보고, 지금 필요한 다음 행동까지 이어드립니다."
            : "It considers your current location, time, weather and travel situation, then helps you move to the next useful action."}
        </p>
      </section>

      <section className="card">
        <h2>
          {language === "ko"
            ? "이 여행도우미가 다른 이유"
            : "Why this travel assistant is different"}
        </h2>

        <p>
          {language === "ko"
            ? "20초 체험으로 여행 상황이 달라졌을 때 여행도우미가 어떻게 다시 판단하는지 확인해 보세요."
            : "See in 20 seconds how the assistant responds when your travel situation changes."}
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowDemo(true)}
        >
          {language === "ko" ? "20초 체험 보기" : "See the 20-second demo"}
        </button>
      </section>

      <section className="card">
        <h2>
          {language === "ko"
            ? "ChatGPT·T맵과 무엇이 다른가요?"
            : "How is this different from ChatGPT and TMAP?"}
        </h2>

        <p>
          {language === "ko"
            ? "EXKOVIA가 범용 AI와 지도·내비게이션 서비스와 어떤 역할 차이를 가지는지 살펴보세요."
            : "See how EXKOVIA complements general AI and map or navigation services."}
        </p>

        <a
          className="btn btn-outline"
          href="https://exkovia.com/#why-exkovia"
        >
          {language === "ko"
            ? "차이 알아보기"
            : "See the differences"}
        </a>
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
