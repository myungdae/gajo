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
const openTextEntry =
  Boolean((location.state as { openTextEntry?: boolean } | null)?.openTextEntry);
  const [,refreshTrip]=useState(0);
  const [showConciergeDemo, setShowConciergeDemo] = useState(false);
  const [showStoryNotice, setShowStoryNotice] = useState(false);
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
    createJourney=(text:string,context:CreateContextInput,planned:PlannedContext)=>{const current=session();saveTripSession({...current,mode:'NOW',plannedContext:{...(current.plannedContext||{}),...planned}});track('RUNTIME_JOURNEY_REQUESTED',current.id,{mode:'NOW'});navigate(link('/concierge?mode=now'),{state:{tripMode:'NOW',initialMessage:text,quickContext:context,autoSubmit:true}})};

  return <div className="regional-home" lang={language} style={{ "--region-accent": region.accent } as React.CSSProperties}>
    <section className={`spotlight-card${spotlight.imageUrl ? " has-image" : ""}`} style={spotlight.imageUrl ? { backgroundImage: `linear-gradient(180deg,rgba(8,24,18,.08) 5%,rgba(8,24,18,.96) 100%),url(${spotlight.imageUrl})`, backgroundPosition: `${spotlight.imageFocusX || "center"} ${spotlight.imageFocusY || "center"}` } : {}} aria-labelledby="spotlight-title">
      {spotlight.imageUrl && <img className="sr-only" src={spotlight.imageUrl} alt={spotlight.imageAlt || ""} />}
      <div><small>{spotlight.statusLabel}</small><h1 id="spotlight-title">{spotlight.title}</h1><p>{spotlight.shortDescription}</p>{spotlightQuestion&&<p className="spotlight-question">{spotlightQuestion}</p>}{region.id!=="hapcheon"&&<div className="spotlight-actions">{(spotlight.secondaryAction || place?.latitude !== undefined) && <button onClick={() => findNearby("TOURIST_ATTRACTION")}>{spotlight.secondaryAction?.label || copy.nearby}</button>}</div>}</div>
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
    <div style={{display:"grid",gap:8,margin:"0 0 16px"}}>
      <a
        href={`/?lang=${language}#why-exkovia`}
        aria-label={language==="ko"?"ChatGPT·T맵과 무엇이 다른가요?":"How is this different from ChatGPT and TMAP?"}
        style={{
          minHeight:72,
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          gap:12,
          width:"100%",
          padding:"10px 12px",
          borderRadius:14,
          border:"1px solid #9fd6cf",
          background:"#eef9f7",
          color:"#08786d",
          textDecoration:"none",
          boxSizing:"border-box"
        }}
      >
        <span style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
          <span
            aria-hidden="true"
            style={{
              width:42,
              height:42,
              display:"grid",
              placeItems:"center",
              flex:"0 0 auto",
              borderRadius:"50%",
              border:"2px solid #08786d",
              fontSize:13,
              fontWeight:900,
              letterSpacing:"-0.5px"
            }}
          >
            GPT
          </span>

          <span style={{textAlign:"left",lineHeight:1.25}}>
            <strong style={{display:"block",fontSize:14,fontWeight:800}}>
              {language==="ko"?"ChatGPT · T맵과":"ChatGPT · TMAP"}
            </strong>
            <strong style={{display:"block",fontSize:16,fontWeight:900}}>
              {language==="ko"?"무엇이 다른가요?":"What is different?"}
            </strong>
          </span>
        </span>

        <span
          aria-hidden="true"
          style={{
            width:42,
            height:42,
            display:"grid",
            placeItems:"center",
            flex:"0 0 auto",
            borderRadius:"50%",
            background:"#0b8a7d",
            color:"#fff",
            fontSize:30,
            fontWeight:900,
            lineHeight:1
          }}
        >
          ›
        </span>
      </a>

      <button
        type="button"
        className="home-concierge-demo-button"
        onClick={() => setShowConciergeDemo(true)}
        style={{
          minHeight:72,
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          gap:12,
          width:"100%",
          padding:"10px 12px",
          borderRadius:14,
          border:"1px solid #9fd6cf",
          background:"#eef9f7",
          color:"#08786d",
          boxSizing:"border-box",
          cursor:"pointer",
          fontFamily:"inherit"
        }}
      >
        <span style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
          <span
            aria-hidden="true"
            style={{
              width:42,
              height:42,
              display:"grid",
              placeItems:"center",
              flex:"0 0 auto",
              fontSize:27
            }}
          >
            ✨
          </span>

          <span style={{textAlign:"left",lineHeight:1.25}}>
            <strong style={{display:"block",fontSize:14,fontWeight:800}}>
              {language==="ko"?"이 여행도우미가 다른 이유,":"Why this travel assistant is different"}
            </strong>
            <strong style={{display:"block",fontSize:16,fontWeight:900}}>
              {language==="ko"?"20초만 보세요":"See it in 20 seconds"}
            </strong>
          </span>
        </span>

        <span
          aria-hidden="true"
          style={{
            width:42,
            height:42,
            display:"grid",
            placeItems:"center",
            flex:"0 0 auto",
            borderRadius:"50%",
            background:"#0b8a7d",
            color:"#fff",
            fontSize:30,
            fontWeight:900,
            lineHeight:1
          }}
        >
          ›
        </span>
      </button>
    </div>


      <button
        type="button"
        className="home-safety-action"
        onClick={() => navigate(withLanguage(region.id === "gajo" ? "/gajo/safety" : `/${region.id}/safety`))}
      >
        <span className="home-safety-action-icon" aria-hidden="true">⚠️</span>

        <span className="home-safety-action-copy">
          <strong>
            {language === "ko" ? "안전·재난" : "Safety & Emergency"}
          </strong>
          <small>
            {language === "ko"
              ? "기상특보·재난정보가 내 여행에 미치는 영향을 확인합니다."
              : "Check how weather alerts and hazards may affect your trip."}
          </small>
        </span>

        <span className="home-safety-action-arrow" aria-hidden="true">›</span>
      </button>


      <button
        type="button"
        className="home-safety-action"
        onClick={() => {
          if (region.id === "hapcheon") {
            navigate(withLanguage("/hapcheon/meteor-crater"));
          } else {
            setShowStoryNotice(true);
          }
        }}
      >
        <span className="home-safety-action-icon" aria-hidden="true">📖</span>

        <span className="home-safety-action-copy">
          <strong>
            {language === "ko"
              ? `${region.regionName}의 이야기 만나기`
              : `Discover the Story of ${english.regionName}`}
          </strong>
          <small>
            {language === "ko"
              ? `지금 내가 있는 곳에서 ${region.regionName}의 이야기를 만나보세요.`
              : `Discover the stories connected to where you are in ${english.regionName}.`}
          </small>
        </span>

        <span className="home-safety-action-arrow" aria-hidden="true">›</span>
      </button>
<RuntimeJourneyEntry
  loading={false}
  onCreate={createJourney}
  onSubmit={text=>ask(text,text)}
  initialTextEntryOpen={openTextEntry}
  onDirect={()=>navigate(
    link('/concierge?mode=now'),
    {state:{tripMode:'NOW',voiceRequested:true}}
  )}
/>

    <TripContinuity onNewTrip={()=>refreshTrip(value=>value+1)}/>
    {guidancePlace&&<section className="proactive-card" aria-label={language==='ko'?'출발 전에 확인하세요':'Check Before You Leave'}><small>{language==='ko'?'출발 전에 확인하세요':'Check Before You Leave'}</small>{guidancePlace&&<h2>{guidanceContext.label}{language==='ko'?'로 가시나요?':' — ready to leave?'}</h2>}<p>{guidance.fact && `${guidance.fact} `}{guidance.context} {guidance.fallbackUsed?(guidancePlace?(language==='ko'?'목적지의 최신 날씨는 아직 확인되지 않았어요.':'The latest destination weather has not been verified yet.'):(language==='ko'?'여정을 만들면 출발 전에 필요한 정보를 확인해 드릴게요.':'Create a journey and I will check what you need before departure.')):guidance.recommendation}</p>{guidance.basisLabel && <span>{guidance.basisLabel}</span>}{guidancePlace&&<button type="button" className="btn btn-outline" onClick={()=>ask(`${guidanceContext.label}로 출발하기 전에 최신 날씨와 이용 정보를 확인해 주세요.`,`Check the latest weather and visitor information before I leave for ${guidanceContext.label}.`)}>{language==='ko'?'출발 정보 확인하기':'Check Departure Information'}</button>}</section>}

    {showStoryNotice && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={language === "ko" ? `${region.regionName} 이야기 안내` : `${english.regionName} story notice`}
        onClick={() => setShowStoryNotice(false)}
        style={{
          position:"fixed",
          inset:0,
          zIndex:1000,
          background:"rgba(0,0,0,.48)",
          display:"grid",
          placeItems:"center",
          padding:20
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width:"min(420px,100%)",
            background:"#fff",
            borderRadius:20,
            padding:"26px 22px",
            boxShadow:"0 18px 50px rgba(0,0,0,.22)"
          }}
        >
          <div style={{fontSize:32,marginBottom:10}}>📖</div>

          <h2 style={{margin:"0 0 12px",fontSize:21,lineHeight:1.35}}>
            {language === "ko"
              ? `${region.regionName}의 이야기를 준비하고 있습니다`
              : `We are preparing the story of ${english.regionName}`}
          </h2>

          <p style={{margin:"0 0 22px",lineHeight:1.7,color:"#475569"}}>
            {language === "ko"
              ? `이 공간은 지역과 협의하여 ${region.regionName}의 역사·문화·예술·사람 가운데 어떤 이야기를 여행자에게 들려드릴지 함께 정하기 위해 마련했습니다.`
              : `This space is reserved for stories to be selected together with the local community, including the history, culture, arts, and people of ${english.regionName}.`}
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowStoryNotice(false)}
            style={{width:"100%"}}
          >
            {language === "ko" ? "확인" : "OK"}
          </button>
        </div>
      </div>
    )}
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
