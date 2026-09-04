import { useEffect, useRef, useState } from "react";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import { RUNTIME_JOURNEY_NAME, rememberRuntimeIntro, runtimeIntroSeen } from "../runtimeJourney";

export default function RuntimeJourneyIntro() {
  const { language } = useRegionalLanguage();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const dismiss = () => {
    rememberRuntimeIntro();
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  useEffect(() => { if (!runtimeIntroSeen()) setOpen(true); }, []);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="runtime-intro-link" onClick={() => setOpen(true)}>ⓘ {language === "ko" ? "지금맞춤 지역여정이란?" : "About this journey"}</button>
    {open && <div className="runtime-intro-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="runtime-intro-title" aria-describedby="runtime-intro-description" className="runtime-intro">
      <button ref={close} aria-label={language === "ko" ? "소개 닫기" : "Close introduction"} onClick={dismiss}>×</button>
      <h2 id="runtime-intro-title">{RUNTIME_JOURNEY_NAME[language]}</h2>
      <p className="runtime-intro-subtitle">{RUNTIME_JOURNEY_NAME[language === "ko" ? "en" : "ko"]}</p>
      <p id="runtime-intro-description">{language === "ko" ? "여행자의 위치·날씨·시간과 여행 조건에 따라 지역에서의 다음 경험을 계속 다시 구성합니다." : "It continually reshapes your next regional experience around your location, weather, time, and travel preferences."}</p>
      <button className="btn btn-primary" onClick={dismiss}>{language === "ko" ? "내 여정 시작하기" : "Start My Journey"}</button>
    </section></div>}
  </>;
}
