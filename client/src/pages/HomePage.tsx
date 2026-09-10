import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchRegionalHome, type NearbyCategory } from "../api/client";
import TripContinuity from "../components/TripContinuity";
import { useRegion } from "../RegionContext";
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
import { ensureTripSession, loadTripSession, saveTripSession, type PlannedContext } from "../tripSession";
import type{CreateContextInput}from'../api/client';
import RuntimeJourneyEntry from '../components/RuntimeJourneyEntry';
import ConciergeDemoOverlay from "../components/ConciergeDemoOverlay";
import GajoLiveStatus from '../components/GajoLiveStatus';
import { regionalRuntimeView } from "../regionalRuntime";
import { locationPermissionState, observeVisitorLocation } from "../utils/visitorLocation";
import { confirmTripLocation, type TripLocation } from "../tripSession";
import { reverseGeocodeLocation } from "../api/client";
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
  const [showConciergeDemo, setShowConciergeDemo] = useState(false);
  const [homeLocation,setHomeLocation]=useState<TripLocation|undefined>(
    ()=>ensureTripSession(region.id).locationContext?.now
  );

  const hydrateHomeLocation=async(requestPermission=false)=>{
    const saved=ensureTripSession(region.id).locationContext?.now;

    if(saved?.status==="CONFIRMED"){
      setHomeLocation(saved);
    }

    const permission=await locationPermissionState();

    if(permission==="denied")return;
    if(permission!=="granted"&&!requestPermission)return;

    const gps=await observeVisitorLocation();
    if(gps.status!=="AVAILABLE")return;

    if(!Number.isFinite(gps.accuracy)||gps.accuracy!>500){
      setHomeLocation({
        status:"STALE",
        source:"GPS",
        latitude:gps.latitude,
        longitude:gps.longitude,
        accuracy:gps.accuracy,
        label:language==="ko"?"대략적인 위치":"Approximate location",
        experienceRegionId:region.id,
        regionMembership:"UNCERTAIN",
        observedAt:gps.observedAt
      });
      return;
    }

    let label=saved?.label||saved?.address||"현재 위치 주변";
    let address=saved?.address;
    let searchRegionId=saved?.searchRegionId;
    let regionMembership=saved?.regionMembership||"UNCERTAIN";

    try{
      const reverse=await reverseGeocodeLocation(
        gps.latitude!,
        gps.longitude!,
        region.id,
        gps.accuracy
      );

      if(reverse.status==="RESOLVED"){
        label=reverse.label;
        address=reverse.address;
      }

      searchRegionId=reverse.searchRegionId||reverse.detectedRegionId;
      regionMembership=reverse.regionMembership||"UNCERTAIN";
    }catch{}

    const next:TripLocation={
      status:"CONFIRMED",
      source:"GPS",
      latitude:gps.latitude,
      longitude:gps.longitude,
      accuracy:gps.accuracy,
      label,
      address,
      experienceRegionId:region.id,
      searchRegionId,
      regionMembership,
      observedAt:gps.observedAt,
      confirmedAt:new Date().toISOString()
    };

    confirmTripLocation(region.id,"NOW",next);
    setHomeLocation(next);
  };

  useEffect(()=>{
    void hydrateHomeLocation(false);
  },[region.id]);

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
    createJourney=(text:string,context:CreateContextInput,planned:PlannedContext)=>{const current=session();saveTripSession({...current,mode:'NOW',plannedContext:{...(current.plannedContext||{}),...planned}});track('RUNTIME_JOURNEY_REQUESTED',current.id,{mode:'NOW'});navigate(link('/concierge?mode=now'),{state:{tripMode:'NOW',initialMessage:text,quickContext:context,autoSubmit:true}})};

  return <div className="regional-home" lang={language} style={{ "--region-accent": region.accent } as React.CSSProperties}>
    <section className={`spotlight-card${spotlight.imageUrl ? " has-image" : ""}`} style={spotlight.imageUrl ? { backgroundImage: `linear-gradient(180deg,rgba(8,24,18,.08) 5%,rgba(8,24,18,.96) 100%),url(${spotlight.imageUrl})`, backgroundPosition: `${spotlight.imageFocusX || "center"} ${spotlight.imageFocusY || "center"}` } : {}} aria-labelledby="spotlight-title">
      {spotlight.imageUrl && <img className="sr-only" src={spotlight.imageUrl} alt={spotlight.imageAlt || ""} />}
      <div><small>{spotlight.statusLabel}</small><h1 id="spotlight-title">{spotlight.title}</h1><p>{spotlight.shortDescription}</p>{spotlightQuestion&&<p className="spotlight-question">{spotlightQuestion}</p>}{region.id!=="hapcheon"&&<div className="spotlight-actions"><button onClick={primary}>{spotlight.primaryAction?.label || copy.story}</button>{(spotlight.secondaryAction || place?.latitude !== undefined) && <button onClick={() => findNearby("TOURIST_ATTRACTION")}>{spotlight.secondaryAction?.label || copy.nearby}</button>}</div>}</div>
    </section>
    <section className="home-context-strip" aria-label={language==="ko"?"현재 여행 상황":"Current travel context"}>
      <GajoLiveStatus
        regionName={region.regionName}
        regionId={region.id}
        liveEnabled={regionalRuntimeView(region).weatherEnabled}
      />
      {homeLocation?.status==="CONFIRMED" ? (
        <span className="home-context-location home-context-location-confirmed">
          {homeLocation.label||homeLocation.address||(language==="ko"?"현재 위치":"Current location")}
        </span>
      ) : (
        <button
          type="button"
          className="home-context-location"
          onClick={()=>void hydrateHomeLocation(true)}
        >
          {language==="ko"?"위치 확인 필요":"Location needed"}
        </button>
      )}
    </section>
    <button
      type="button"
      className="home-concierge-demo-button"
      onClick={() => setShowConciergeDemo(true)}
      style={{
        width: "100%",
        margin: "12px 0 16px",
        padding: "14px 16px",
        border: "1px solid #dbeafe",
        borderRadius: "16px",
        background: "#f8fbff",
        color: "#1e40af",
        fontSize: "15px",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      ✨ 이 여행도우미가 다른 이유, 20초만 보세요
    </button>

    <RuntimeJourneyEntry
      loading={false}
      onCreate={createJourney}
      onSubmit={text=>ask(text,text)}
      onDirect={()=>navigate(link('/concierge?mode=now'),{state:{tripMode:'NOW',voiceRequested:true}})}
    />
    <TripContinuity onNewTrip={()=>refreshTrip(value=>value+1)}/>
    {guidancePlace&&<section className="proactive-card" aria-label={language==='ko'?'출발 전에 확인하세요':'Check Before You Leave'}><small>{language==='ko'?'출발 전에 확인하세요':'Check Before You Leave'}</small>{guidancePlace&&<h2>{guidanceContext.label}{language==='ko'?'로 가시나요?':' — ready to leave?'}</h2>}<p>{guidance.fact && `${guidance.fact} `}{guidance.context} {guidance.fallbackUsed?(guidancePlace?(language==='ko'?'목적지의 최신 날씨는 아직 확인되지 않았어요.':'The latest destination weather has not been verified yet.'):(language==='ko'?'여정을 만들면 출발 전에 필요한 정보를 확인해 드릴게요.':'Create a journey and I will check what you need before departure.')):guidance.recommendation}</p>{guidance.basisLabel && <span>{guidance.basisLabel}</span>}{guidancePlace&&<button type="button" className="btn btn-outline" onClick={()=>ask(`${guidanceContext.label}로 출발하기 전에 최신 날씨와 이용 정보를 확인해 주세요.`,`Check the latest weather and visitor information before I leave for ${guidanceContext.label}.`)}>{language==='ko'?'출발 정보 확인하기':'Check Departure Information'}</button>}</section>}

    <ConciergeDemoOverlay
      open={showConciergeDemo}
      regionName={region.regionName}
      onClose={() => setShowConciergeDemo(false)}
      onStartTrip={() => {
        setShowConciergeDemo(false);
        navigate(
          link("/concierge?mode=now"),
          { state: { tripMode: "NOW", freeTextOpen: true } }
        );
      }}
    />
  </div>;
}
