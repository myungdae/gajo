import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchRegionalHome, type NearbyCategory } from "../api/client";
import TripContinuity from "../components/TripContinuity";
import { useRegion } from "../RegionContext";
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
import { ensureTripSession, hasTripEvidence, loadTripSession, saveTripSession, type PlannedContext } from "../tripSession";
import { hasActiveItinerary } from "../tripContinuity";
import type{CreateContextInput}from'../api/client';
import RuntimeJourneyEntry from '../components/RuntimeJourneyEntry';
import RuntimeJourneyIntro from '../components/RuntimeJourneyIntro';
import { track } from "../analytics";
import { buildProactiveGuidance } from "../proactiveGuidance";
import { sanitizeRegionalSpotlight } from "../regionalHomeCopy";
import { useRegionalLanguage } from "../RegionalLanguageContext";
import { getRegionalHomeEnglish } from "../regionConfig";
import { HOME_COPY, localizedSpotlight } from "../regionalHomeI18n";
import { regionalHomeGuidancePlace, selectedRegionalHomePlace } from "../regionalHomeGuidanceContext";

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
      primaryAction: region.id === "hapcheon" ? { label: language === "en" ? english.spotlight?.cta || "Start My Journey" : "내 여정 시작하기", type: "JOURNEY" } : undefined,
    },
    spotlight=region.id === "hapcheon"?fallback:managed?localizedSpotlight(managed,language,english):fallback,
    spotlightQuestion=region.id === "hapcheon"?(language === "en" ? "How can I help you right now?" : region.home.question):undefined,
    currentTrip = loadTripSession(localStorage, region.id),
    guidancePlace = selectedRegionalHomePlace(region, currentTrip),
    guidanceContext = regionalHomeGuidancePlace(region, currentTrip, language, english),
    guidance = buildProactiveGuidance(guidanceContext, undefined, new Date(), language),
    primary = () => spotlight.primaryAction?.type === "JOURNEY" ? navigate(link("/concierge?mode=now"),{state:{tripMode:"NOW"}}) : spotlight.primaryAction?.type === "DETAIL" && spotlight.primaryAction.target ? navigate(withLanguage(spotlight.primaryAction.target)) : ask(`${spotlight.title} 이야기를 알려주세요.`, `Tell me more about ${spotlight.title}.`),
    activeTrip=loadTripSession(localStorage,region.id),hasActiveTrip=hasActiveItinerary(activeTrip),hasTripContext=Boolean(activeTrip&&hasTripEvidence(activeTrip)),
    createJourney=(text:string,context:CreateContextInput,planned:PlannedContext)=>{const current=session();saveTripSession({...current,mode:'NOW',plannedContext:{...(current.plannedContext||{}),...planned}});track('RUNTIME_JOURNEY_REQUESTED',current.id,{mode:'NOW'});navigate(link('/concierge?mode=now'),{state:{tripMode:'NOW',initialMessage:text,quickContext:context,autoSubmit:true}})};

  return <div className="regional-home" lang={language} style={{ "--region-accent": region.accent } as React.CSSProperties}>
    <section className={`spotlight-card${spotlight.imageUrl ? " has-image" : ""}`} style={spotlight.imageUrl ? { backgroundImage: `linear-gradient(180deg,rgba(8,24,18,.08) 5%,rgba(8,24,18,.96) 100%),url(${spotlight.imageUrl})`, backgroundPosition: `${spotlight.imageFocusX || "center"} ${spotlight.imageFocusY || "center"}` } : {}} aria-labelledby="spotlight-title">
      {spotlight.imageUrl && <img className="sr-only" src={spotlight.imageUrl} alt={spotlight.imageAlt || ""} />}
      <div><small>{spotlight.statusLabel}</small><h1 id="spotlight-title">{spotlight.title}</h1><p>{spotlight.shortDescription}</p>{spotlightQuestion&&<p className="spotlight-question">{spotlightQuestion}</p>}<div className="spotlight-actions"><button onClick={primary}>{spotlight.primaryAction?.label || copy.story}</button>{(spotlight.secondaryAction || place?.latitude !== undefined) && <button onClick={() => findNearby("TOURIST_ATTRACTION")}>{spotlight.secondaryAction?.label || copy.nearby}</button>}</div></div>
    </section>
    {hasTripContext&&<TripContinuity onNewTrip={()=>refreshTrip(value=>value+1)}/>}
    {hasActiveTrip?<RuntimeJourneyIntro/>:!hasTripContext&&<RuntimeJourneyEntry loading={false} onCreate={createJourney} onDirect={()=>navigate(link('/concierge?mode=now'),{state:{tripMode:'NOW',otherRequestOpen:true}})}/>}
    <section className="proactive-card" aria-label={language==='ko'?'출발 전에 확인하세요':'Check Before You Leave'}><small>{language==='ko'?'출발 전에 확인하세요':'Check Before You Leave'}</small>{guidancePlace&&<h2>{guidanceContext.label}{language==='ko'?'로 가시나요?':' — ready to leave?'}</h2>}<p>{guidance.fact && `${guidance.fact} `}{guidance.context} {guidance.fallbackUsed?(guidancePlace?(language==='ko'?'목적지의 최신 날씨는 아직 확인되지 않았어요.':'The latest destination weather has not been verified yet.'):(language==='ko'?'여정을 만들면 출발 전에 필요한 정보를 확인해 드릴게요.':'Create a journey and I will check what you need before departure.')):guidance.recommendation}</p>{guidance.basisLabel && <span>{guidance.basisLabel}</span>}{guidancePlace&&<button type="button" className="btn btn-outline" onClick={()=>ask(`${guidanceContext.label}로 출발하기 전에 최신 날씨와 이용 정보를 확인해 주세요.`,`Check the latest weather and visitor information before I leave for ${guidanceContext.label}.`)}>{language==='ko'?'출발 정보 확인하기':'Check Departure Information'}</button>}</section>
  </div>;
}
