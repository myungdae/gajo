import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchRegionalHome, type NearbyCategory } from "../api/client";
import TripContinuity from "../components/TripContinuity";
import { useRegion } from "../RegionContext";
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
import { ensureTripSession, loadTripSession, hasTripEvidence, saveTripSession, type PlannedContext } from "../tripSession";
import type{CreateContextInput}from'../api/client';
import RuntimeJourneyEntry from '../components/RuntimeJourneyEntry';
import RuntimeJourneyIntro from '../components/RuntimeJourneyIntro';
import { track } from "../analytics";
import { buildProactiveGuidance } from "../proactiveGuidance";
import { sanitizeRegionalSpotlight } from "../regionalHomeCopy";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import { getRegionalHomeEnglish } from "../regionConfig";
import { HOME_COPY, localizedSpotlight } from "../regionalHomeI18n";
import { regionalHomeGuidancePlace } from "../regionalHomeGuidanceContext";

export default function HomePage() {
  const navigate = useNavigate(), location = useLocation(), region = useRegion(), { language, withLanguage } = useRegionalLanguage(), english = getRegionalHomeEnglish(region), copy = HOME_COPY[language], [managed, setManaged] = useState<any>();
  const [,refreshTrip]=useState(0);
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
    activeTrip=loadTripSession(localStorage,region.id),hasActiveTrip=Boolean(activeTrip&&hasTripEvidence(activeTrip)),
    createJourney=(text:string,context:CreateContextInput,planned:PlannedContext)=>{const current=session();saveTripSession({...current,mode:'NOW',plannedContext:{...(current.plannedContext||{}),...planned}});track('RUNTIME_JOURNEY_REQUESTED',current.id,{mode:'NOW'});navigate(link('/concierge?mode=now'),{state:{tripMode:'NOW',initialMessage:text,quickContext:context,autoSubmit:true}})};

  return <div className="regional-home" lang={language} style={{ "--region-accent": region.accent } as React.CSSProperties}>
    {hasActiveTrip?<><TripContinuity onNewTrip={()=>refreshTrip(value=>value+1)}/><RuntimeJourneyIntro/></>:<RuntimeJourneyEntry loading={false} onCreate={createJourney} onDirect={()=>navigate(link('/concierge?mode=now'),{state:{tripMode:'NOW',otherRequestOpen:true}})}/>}
    <section className={`spotlight-card${spotlight.imageUrl ? " has-image" : ""}`} style={spotlight.imageUrl ? { backgroundImage: `linear-gradient(180deg,rgba(8,24,18,.08) 5%,rgba(8,24,18,.96) 100%),url(${spotlight.imageUrl})`, backgroundPosition: `${spotlight.imageFocusX || "center"} ${spotlight.imageFocusY || "center"}` } : {}} aria-labelledby="spotlight-title">
      {spotlight.imageUrl && <img className="sr-only" src={spotlight.imageUrl} alt={spotlight.imageAlt || ""} />}
      <div><small>{spotlight.statusLabel}</small><h1 id="spotlight-title">{spotlight.title}</h1><p>{spotlight.shortDescription}</p><div className="spotlight-actions"><button onClick={primary}>{spotlight.primaryAction?.label || copy.story}</button>{(spotlight.secondaryAction || place?.latitude !== undefined) && <button onClick={() => findNearby("TOURIST_ATTRACTION")}>{spotlight.secondaryAction?.label || copy.nearby}</button>}</div></div>
    </section>
    <section className="proactive-card" aria-label={copy.guidance}><small>{copy.guidance}</small><p>{guidance.fact && `${guidance.fact} `}{guidance.context} {guidance.recommendation}</p>{guidance.basisLabel && <span>{guidance.basisLabel}</span>}</section>
  </div>;
}
