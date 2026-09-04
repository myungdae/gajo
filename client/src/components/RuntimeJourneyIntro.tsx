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
    <button ref={trigger} className="runtime-intro-link" onClick={() => setOpen(true)}>{language === "ko" ? "지금맞춤 지역여정이란?" : "What is a Runtime-Adaptive Regional Journey?"}</button>
    {open && <div className="runtime-intro-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="runtime-intro-title" aria-describedby="runtime-intro-description" className="runtime-intro">
      <button ref={close} aria-label={language === "ko" ? "소개 닫기" : "Close introduction"} onClick={dismiss}>×</button>
      <h2 id="runtime-intro-title">{RUNTIME_JOURNEY_NAME[language]}</h2>
      <p id="runtime-intro-description">{language === "ko" ? "EXKOVIA는 관광지를 나열하는 서비스가 아닙니다. 여행자의 지금에 따라 지역에서의 다음 경험을 계속 다시 구성합니다." : "EXKOVIA does not simply list attractions. It continually reshapes your next regional experience around your situation now."}</p>
      <button className="btn btn-primary" onClick={dismiss}>{language === "ko" ? "내 여정 시작하기" : "Start My Journey"}</button>
      <p>{language === "ko" ? "위치·날씨·시간은 확인된 정보만 반영하고, 필요한 조건만 선택합니다." : "We use verified location, weather, and time, and ask only for preferences that matter."}</p>
    </section></div>}
  </>;
}
