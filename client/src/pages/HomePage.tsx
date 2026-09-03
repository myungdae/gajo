import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchRegionalHome, type NearbyCategory } from "../api/client";
import { RegionalActionIcon, type RegionalHomeActionType } from "../components/RegionalActionIcon";
import TripContinuity from "../components/TripContinuity";
import { useRegion } from "../RegionContext";
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
import { ensureTripSession, loadTripSession } from "../tripSession";
import { track } from "../analytics";
import { buildProactiveGuidance } from "../proactiveGuidance";
import { sanitizeRegionalSpotlight } from "../regionalHomeCopy";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import { getRegionalHomeEnglish } from "../regionConfig";
import { HOME_COPY, localizedSpotlight } from "../regionalHomeI18n";
import { regionalHomeGuidancePlace } from "../regionalHomeGuidanceContext";

type ImmediateAction = { type: RegionalHomeActionType; label: string; run: () => void };

export default function HomePage() {
  const navigate = useNavigate(), location = useLocation(), region = useRegion(), { language, withLanguage } = useRegionalLanguage(), english = getRegionalHomeEnglish(region), copy = HOME_COPY[language], [managed, setManaged] = useState<any>();
  useEffect(() => {
    let active = true;
    fetchRegionalHome(region.id).then((value) => active && setManaged(sanitizeRegionalSpotlight(value.spotlight))).catch(() => active && setManaged(undefined));
    return () => { active = false; };
  }, [region.id]);

  const link = (path: string) => withLanguage(regionalPath(path, region.id, location.pathname.startsWith("/gajo"))),
    session = () => ensureTripSession(region.id),
    findNearby = (category: NearbyCategory) => {
      const current = session();
      track("QUICK_INTENT_SELECTED", current.id, { intent: category });
      navigate(link("/nearby-discovery"), { state: { category } });
    },
    ask = (ko: string, en: string) => {
      session();
      navigate(link("/concierge?mode=now"), { state: { tripMode: "NOW", freeTextOpen: true, initialMessage: language === "en" ? en : ko, autoSubmit: true } });
    };

  const hero = region.home.hero,
    place = region.places.find((item) => item.runtimeDataStatus === "VERIFIED") || region.places[0],
    fallback = {
      statusLabel: language === "en" ? english.spotlight?.statusLabel || english.serviceName : `오늘의 ${region.regionName}`,
      title: language === "en" ? english.spotlight?.title || english.heroTitle : hero?.title || region.heroTitle,
      shortDescription: language === "en" ? english.spotlight?.description || english.heroCopy : hero?.description || region.heroCopy,
      imageUrl: hero?.image,
      imageAlt: language === "en" ? english.spotlight?.imageAlt || hero?.alt : hero?.alt,
      imageFocusX: "center", imageFocusY: "center",
      primaryAction: english.spotlight ? { label: language === "en" ? english.spotlight.cta : "운석충돌구 이야기", type: "DETAIL", target: `/${region.id}/meteor-crater` } : undefined,
    },
    spotlight=managed?localizedSpotlight(managed,language,english):fallback,
    guidanceContext = regionalHomeGuidancePlace(region, loadTripSession(localStorage, region.id), language, english),
    guidance = buildProactiveGuidance(guidanceContext, undefined, new Date(), language),
    primary = () => spotlight.primaryAction?.type === "DETAIL" && spotlight.primaryAction.target ? navigate(withLanguage(spotlight.primaryAction.target)) : ask(`${spotlight.title} 이야기를 알려주세요.`, `Tell me more about ${spotlight.title}.`),
    actions: ImmediateAction[] = [
      { type: "FOOD", label: copy.food, run: () => findNearby("FOOD") },
      { type: "CAFE", label: copy.cafe, run: () => ask("카페에서 쉬고 싶어요.", "Find a café where I can take a break.") },
      { type: "NEXT_PLACE", label: copy.next, run: () => findNearby("TOURIST_ATTRACTION") },
      { type: "EVENT_TODAY", label: copy.events, run: () => ask("오늘 확인된 행사만 알려주세요.", "Show only verified events happening today.") },
      { type: "COMPANION_FRIENDLY", label: copy.family, run: () => ask("부모님이나 아이와 편하게 갈 곳을 추천해 주세요.", "Recommend comfortable places for parents or children.") },
    ];

  return <div className="regional-home" lang={language} style={{ "--region-accent": region.accent } as React.CSSProperties}>
    <section className={`spotlight-card${spotlight.imageUrl ? " has-image" : ""}`} style={spotlight.imageUrl ? { backgroundImage: `linear-gradient(180deg,rgba(8,24,18,.08) 5%,rgba(8,24,18,.96) 100%),url(${spotlight.imageUrl})`, backgroundPosition: `${spotlight.imageFocusX || "center"} ${spotlight.imageFocusY || "center"}` } : {}} aria-labelledby="spotlight-title">
      {spotlight.imageUrl && <img className="sr-only" src={spotlight.imageUrl} alt={spotlight.imageAlt || ""} />}
      <div><small>{spotlight.statusLabel}</small><h1 id="spotlight-title">{spotlight.title}</h1><p>{spotlight.shortDescription}</p><div className="spotlight-actions"><button onClick={primary}>{spotlight.primaryAction?.label || copy.story}</button>{(spotlight.secondaryAction || place?.latitude !== undefined) && <button onClick={() => findNearby("TOURIST_ATTRACTION")}>{spotlight.secondaryAction?.label || copy.nearby}</button>}</div></div>
    </section>
    <section className="instant-actions" aria-labelledby="instant-title"><h2 id="instant-title">{copy.question}</h2><div>{actions.map((action) => <button key={action.type} type="button" data-action-type={action.type} onClick={action.run}><RegionalActionIcon type={action.type} /><span>{action.label}</span></button>)}</div></section>
    <section className="proactive-card" aria-label={copy.guidance}><small>{copy.guidance}</small><p>{guidance.fact && `${guidance.fact} `}{guidance.context} {guidance.recommendation}</p>{guidance.basisLabel && <span>{guidance.basisLabel}</span>}</section>
    <TripContinuity />
  </div>;
}
