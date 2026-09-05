import { REQUEST_PRESENTATION_COPY, requestPresentation, shouldOfferContextRefresh } from "../conversationPresentation";
import { RECOMMENDATION_REQUEST_COPY } from '../recommendationRequestCopy';
import VoiceInputDialog from "../components/VoiceInputDialog";
import { readConversation, saveConversation, shouldAutoSubmitEntry } from "../conversationMemory";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  postConciergeChat,
  recordPartnerRecommendations,
  runDemoScenario,
  type ConciergeChatResponse,
  type CreateContextInput,
} from "../api/client";
import GajoLiveStatus from "../components/GajoLiveStatus";
import LocationContextBar from "../components/LocationContextBar";
import RecommendationItineraryItem from "../components/RecommendationItineraryItem";
import PlaceGuidanceSummary from "../components/PlaceGuidanceSummary";
import { getSessionLocation, locationPermissionState, mayRefreshLocationSilently, observeVisitorLocation } from "../utils/visitorLocation";
import { useSpeechInput } from "../hooks/useSpeechInput";
import {
  alignCompletedResponse,
  stabilizeCompletedResponse,
} from "../responseScroll";
import {
  buildContextSummary,
  withRequestedDestinations,
} from "../utils/contextSummary";
import { getQuickStartPreset } from "../quickStartPresets";
import {
  ensureTripSession,
  loadTripSession,
  mergeTravelContext,
  saveTripSession,
  sessionContext,
  isFreshTripLocation,
  isLocationSensitiveRequest,
  isMaterialLocationMove,
  LOCATION_SENSITIVE_FRESH_MS,
  confirmTripLocation,
  type PlannedContext,
} from "../tripSession";
import { REGION_INTEREST_OPTIONS } from "../regionConfig";
import { track } from "../analytics";
import { buildNowContinuation } from "../nowContinuation";
import { useRegion } from "../RegionContext";
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
import { regionalRuntimeView } from "../regionalRuntime";
import { SHARED_VISITOR_COPY } from "../visitorCopy";
import InstallExperience from "../components/InstallExperience";
import FullJourneySave from "../components/FullJourneySave";
import SavedTripEntry from "../components/SavedTripEntry";
import AiResponseActions from "../components/AiResponseActions";
import RuntimeJourneyEntry from '../components/RuntimeJourneyEntry';
import RuntimeJourneyResultActions from '../components/RuntimeJourneyResultActions';
import '../components/runtime-empty-journey.css';
import { journeyRequest, runtimeJourneySteps } from '../runtimeJourney';
import {
  beginCurrentTurn,
  isCurrentTurn,
  resolveCurrentTurn,
  type CurrentTurnResult,
} from "../currentTurnResult";
import {
  captureExplicitJourney,
  explicitJourneyPayload,
  type ExplicitJourneyContext,
} from "../explicitJourneyContext";
import { GlossaryText } from "../components/GlossaryText";
import { isExplanationOnly } from "../aiResponseActions";
import { understoodSummary } from "../understoodSummary";
import { acceptVoiceResult, understandVoice, type VoiceResultFingerprint, type VoiceUnderstanding } from "../voice/voiceUx";
import { useRegionalLanguage } from "../RegionalLanguageContext";

interface Message {
  role: "user" | "ai";
  text: string;
  result?: ConciergeChatResponse;
  requestText?: string;
  turnId?: string;
}

interface ConversationSnapshot {
  messages: Message[];
  currentTurn: CurrentTurnResult<ConciergeChatResponse> | null;
  freeTextOpen: boolean;
  conversationAnchor: NonNullable<CreateContextInput["conversationalAnchor"]> | null;
  discoveryContext?: CreateContextInput["discoveryContext"];
  explicitJourney?: ExplicitJourneyContext;
  excludedDiscoveryIds: string[];
}
function summarizeResult(result: ConciergeChatResponse): string {
  const rec = result.recommendation;
  if (result.error) {
    return "죄송합니다. 말씀하신 내용을 일정으로 구성하지 못했습니다. 원하는 방문 상황을 조금 더 구체적으로 말씀해 주세요.";
  }
  if (result.visitorMessage) return result.visitorMessage;
  if (result.distanceInfo)
    return result.distanceInfo.status === "RESOLVED"
      ? `${result.distanceInfo.fromLabel}에서 ${result.distanceInfo.toLabel}까지 직선거리로 약 ${result.distanceInfo.distanceMeters}m입니다.`
      : result.distanceInfo.message ||
          "거리 확인을 위해 출발 장소를 알려주세요.";
  if (result.discovery) {
    const first = result.discovery.entities[0];
    if (first && result.discovery.searchFallback?.used)
      return `${result.discovery.anchorLabel ? `${result.discovery.anchorLabel} 근처에서는 ` : ""}${first.programLabel || first.facilityLabel || first.label}를 확인했습니다. 현재 영업 여부는 방문 전에 확인해 주세요.`;
    return result.discovery.entities.length
      ? `${first.programLabel || first.facilityLabel || first.label}으로 가는 것이 좋겠습니다.${Number.isFinite(first.distanceMeters) ? ` 기준 위치에서 약 ${first.distanceMeters}m 떨어져 있습니다.` : ""}`
      : "조건에 맞는 검증된 장소를 아직 찾지 못했습니다.";
  }
  if (!rec) {
    return "요청을 접수했습니다. 조건을 분석했지만 아직 추천할 프로그램을 찾지 못했습니다.";
  }
  return (
    rec.reasonSummary || "말씀하신 상황에 맞춰 편안한 일정을 준비했습니다."
  );
}

export default function ConciergePage() {
  const region=useRegion(),location=useLocation();
  const mode=(location.state as {tripMode?:string}|null)?.tripMode||new URLSearchParams(location.search).get("mode")?.toUpperCase()||"GENERIC";
  return <ConciergeConversation key={region.id+":"+ensureTripSession(region.id).id+":"+mode}/>;
}

function ConciergeConversation() {
  const { language } = useRegionalLanguage();
  const region = useRegion();
  const regionLink = (path: string) => regionalPath(path, region.id);
  const navigate = useNavigate();
  const location = useLocation();
  const entryState = location.state as {
    quickStartPreset?: unknown;
    quickContext?: CreateContextInput;
    freeTextOpen?: boolean;
    tripMode?: "PLAN" | "NOW";
    initialMessage?: string;
    autoSubmit?: boolean;
    entryMessage?: string;
    entryDescription?: string;
    conversationSnapshot?: ConversationSnapshot;
    otherRequestOpen?: boolean;
  } | null;
  const queryMode = new URLSearchParams(location.search)
    .get("mode")
    ?.toUpperCase();
  const tripMode: "PLAN" | "NOW" | "GENERIC" =
    entryState?.tripMode ||
    (queryMode === "PLAN" || queryMode === "NOW" ? queryMode : "GENERIC");
  const preset = getQuickStartPreset(entryState?.quickStartPreset);
  const tripSession = ensureTripSession(region.id);
  const restored=useRef(readConversation<ConversationSnapshot>(sessionStorage,region.id,tripSession.id,tripMode)).current;
  const [messages, setMessages] = useState<Message[]>(restored?.messages || [
    {
      role: "ai",
      text:
        tripMode === "PLAN"
          ? "여행 날짜를 아직 정하지 않았어도 괜찮아요. 알고 있는 내용만으로 준비할게요."
          : tripMode === "NOW"
            ? (entryState?.entryDescription ? undefined : entryState?.entryMessage) ||
              "필요한 선택을 누르거나 달라진 상황을 편하게 알려주세요."
            : "함께 오신 분, 머무는 시간, 이동 방법, 걷기 편한 정도를 알려주시면 알맞은 일정을 안내해 드릴게요.",
    },
  ]);
  const [input, setInput] = useState(entryState?.initialMessage || "");
  const [currentTurn, setCurrentTurn] =
    useState<CurrentTurnResult<ConciergeChatResponse> | null>(restored?.currentTurn || null);
  const [conversationAnchor, setConversationAnchor] = useState<NonNullable<
    CreateContextInput["conversationalAnchor"]
  > | null>(restored?.conversationAnchor || null);
  const [discoveryContext, setDiscoveryContext] =
    useState<CreateContextInput["discoveryContext"]>(restored?.discoveryContext);
  const [explicitJourney, setExplicitJourney] =
    useState<ExplicitJourneyContext | undefined>(restored?.explicitJourney);
  const [excludedDiscoveryIds, setExcludedDiscoveryIds] = useState<string[]>(
    restored?.excludedDiscoveryIds || [],
  );
  const currentAnswerRef = useRef<HTMLDivElement>(null);
  const currentTurnConversationRef = useRef<HTMLDivElement>(null);
  const followCurrentTurnRef = useRef(true);
  const responseStabilizerCleanupRef = useRef<() => void>(() => {});
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [locationFreshnessNotice,setLocationFreshnessNotice]=useState<{label?:string;confirmedAt?:string}|null>(null);
  const [freeTextOpen, setFreeTextOpen] = useState(
    restored?.messages.some(message=>Boolean(message.result)) ? false : restored?.freeTextOpen ?? Boolean(entryState?.freeTextOpen),
  );
  const [manualEntryMode,setManualEntryMode]=useState<"VOICE"|"TEXT"|null>(null);
  const [otherRequestOpen,setOtherRequestOpen]=useState(Boolean(entryState?.otherRequestOpen));
  const [emptyJourneyEditOpen,setEmptyJourneyEditOpen]=useState(false);
  const [structuredDraft, setStructuredDraft] = useState<CreateContextInput>(
    () =>
      mergeTravelContext(
        sessionContext(tripSession),
        entryState?.quickContext ||
          preset?.context || { inputMode: "STRUCTURED" },
      ),
  );
  const contextSessionKey = `regional-context-session:${region.id}`;
  const contextSessionIdRef = useRef(
    sessionStorage.getItem(contextSessionKey) || crypto.randomUUID(),
  );
  const liveStoryRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);
  const homeSubmittedRef = useRef(false);
  const [voiceOpen,setVoiceOpen]=useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const lastRequestRef = useRef<{
    text: string;
    structured?: CreateContextInput;
  } | null>(null);
  const allowStaleLocationOnceRef=useRef(false);
  const [voiceUnderstanding,setVoiceUnderstanding]=useState<VoiceUnderstanding|null>(null);
  const [voiceDraft,setVoiceDraft]=useState("");
  const voiceStartedAtRef=useRef(0);
  const lastVoiceResultRef=useRef<VoiceResultFingerprint|null>(null);
  const openNearby=(category?:ConciergeChatResponse["nearbyCategory"])=>{
    navigate(regionLink("/nearby-discovery"),{state:{category}});
  };
  const onVoiceFinal=(text:string)=>{
    const gate=acceptVoiceResult(lastVoiceResultRef.current,text,Date.now(),requestInFlightRef.current);
    lastVoiceResultRef.current=gate.next;
    if(!text.trim()||!gate.accepted||requestInFlightRef.current){track("VOICE_DUPLICATE_BLOCKED",tripSession.id,{source:"FINAL_RESULT"});return;}
    setVoiceDraft(text);setVoiceUnderstanding(understandVoice(text));setVoiceState("CONFIRMING");
  };
  const {
    listening,
    voiceError,
    voiceState,
    setVoiceState,
    toggleListening,
    stopListening,
    cancelListening,
  } = useSpeechInput(voiceDraft, setVoiceDraft,onVoiceFinal,language);
  const beginVoice=()=>{
    if(requestInFlightRef.current||voiceState==="REQUESTING_PERMISSION"||voiceState==="TRANSCRIBING")return;
    if(listening){stopListening();return;}
    setVoiceUnderstanding(null);setVoiceDraft("");lastVoiceResultRef.current=null;
    voiceStartedAtRef.current=Date.now();track("VOICE_STARTED",tripSession.id,{});
    toggleListening();
  };
  const openVoice=()=>{if(requestInFlightRef.current)return;setVoiceOpen(true);beginVoice();};
  const dismissVoice=()=>{cancelListening();setVoiceUnderstanding(null);setVoiceDraft("");setVoiceState("IDLE");setVoiceOpen(false);track("VOICE_INPUT_SWITCHED",tripSession.id,{to:"TEXT_OR_TOUCH"});};
  const openText=()=>{setManualEntryMode("TEXT");setFreeTextOpen(true);requestAnimationFrame(()=>textInputRef.current?.focus());};
  const createRuntimeJourney=(text:string,context:CreateContextInput,planned:PlannedContext)=>{
    const current=loadTripSession(localStorage,region.id)||tripSession;
    const changed=Object.fromEntries(Object.entries(planned).filter(([,value])=>value!==undefined));
    saveTripSession({...current,mode:tripMode==='GENERIC'?current.mode:tripMode,plannedContext:{...(current.plannedContext||{}),...changed}});
    setStructuredDraft(currentDraft=>mergeTravelContext(currentDraft,context));
    setOtherRequestOpen(false);
    setEmptyJourneyEditOpen(false);
    track('RUNTIME_JOURNEY_REQUESTED',tripSession.id,{mode:tripMode});
    void send(text,context);
  };
  const voiceToText=()=>{dismissVoice();setManualEntryMode("TEXT");setFreeTextOpen(true);requestAnimationFrame(()=>textInputRef.current?.focus());};
  useEffect(() => {
    sessionStorage.setItem(contextSessionKey, contextSessionIdRef.current);
  }, [contextSessionKey]);
  useEffect(()=>{track("VOICE_STATE_CHANGED",tripSession.id,{state:voiceState});if(voiceState==="PERMISSION_DENIED")track("VOICE_PERMISSION_DENIED",tripSession.id);},[voiceState,tripSession.id]);
  useEffect(() => {
    const scrollSurface =
      currentTurnConversationRef.current?.closest(".app-main");
    if (!scrollSurface) return;
    const cancelFollow = () => {
      followCurrentTurnRef.current = false;
    };
    const cancelFollowByKey = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        cancelFollow();
    };
    scrollSurface.addEventListener("wheel", cancelFollow, { passive: true });
    scrollSurface.addEventListener("touchstart", cancelFollow, {
      passive: true,
    });
    scrollSurface.addEventListener("pointerdown", cancelFollow, {
      passive: true,
    });
    document.addEventListener("keydown", cancelFollowByKey);
    return () => {
      scrollSurface.removeEventListener("wheel", cancelFollow);
      scrollSurface.removeEventListener("touchstart", cancelFollow);
      scrollSurface.removeEventListener("pointerdown", cancelFollow);
      document.removeEventListener("keydown", cancelFollowByKey);
    };
  }, []);
  useEffect(()=>{
    if(loading||!messages.some(message=>message.role==="user"))return;
    saveConversation(sessionStorage,region.id,tripSession.id,tripMode,{
      messages,currentTurn,freeTextOpen,conversationAnchor,discoveryContext,explicitJourney,excludedDiscoveryIds,
    } satisfies ConversationSnapshot);
  },[messages,currentTurn,freeTextOpen,conversationAnchor,discoveryContext,explicitJourney,excludedDiscoveryIds,loading,region.id,tripSession.id,tripMode]);
  useEffect(() => {
    if (tripMode === "PLAN")
      track(
        tripSession.plannedContext ? "PLAN_RESUMED" : "PLAN_SESSION_STARTED",
        tripSession.id,
      );
    if (tripMode === "NOW") {
      track("NOW_SESSION_STARTED", tripSession.id);
      if (tripSession.plannedContext)
        track("PLAN_NOW_CONTINUED", tripSession.id);
    }
  }, []);

  const send = async (
    overrideText?: string,
    structured?: CreateContextInput,
    retry = false,
    voiceModel?:VoiceUnderstanding,
  ) => {
    const text = (overrideText ?? input).trim();
    if ((!text && !structured) || requestInFlightRef.current) return;
    requestInFlightRef.current=true;
    setLoading(true);
    try {
    if(!retry)lastRequestRef.current={text,structured};
    if(tripMode==="NOW"&&isLocationSensitiveRequest(text)){
      const active=loadTripSession(localStorage,region.id)||tripSession,saved=active.locationContext?.now;
      if(saved?.status==="CONFIRMED"&&!isFreshTripLocation(saved,Date.now(),LOCATION_SENSITIVE_FRESH_MS)&&!allowStaleLocationOnceRef.current){
        const permission=await locationPermissionState();
        if(mayRefreshLocationSilently(permission)){
          const fix=await observeVisitorLocation();
          if(fix.status==="AVAILABLE"){
            const refreshed={...saved,source:"GPS" as const,status:"CONFIRMED" as const,latitude:fix.latitude,longitude:fix.longitude,accuracy:fix.accuracy,observedAt:fix.observedAt};
            if(!isMaterialLocationMove(saved,refreshed)){
              confirmTripLocation(region.id,"NOW",refreshed);
              setLocationFreshnessNotice(null);
            }else{
              setLocationFreshnessNotice({label:saved.label||saved.address,confirmedAt:saved.confirmedAt});
              return;
            }
          }else{
            setLocationFreshnessNotice({label:saved.label||saved.address,confirmedAt:saved.confirmedAt});
            return;
          }
        }else{
          setLocationFreshnessNotice({label:saved.label||saved.address,confirmedAt:saved.confirmedAt});
          return;
        }
      }
      allowStaleLocationOnceRef.current=false;
    }
    const turnId = crypto.randomUUID();
    const scrollSurface =
      currentTurnConversationRef.current?.closest(".app-main");
    followCurrentTurnRef.current =
      document.activeElement === textInputRef.current ||
      !scrollSurface ||
      scrollSurface.scrollHeight -
        scrollSurface.scrollTop -
        scrollSurface.clientHeight <
        280;
    requestInFlightRef.current = true;
    const activeVoice=voiceModel||voiceUnderstanding;
    setFreeTextOpen(false);
    setVoiceOpen(false);
    cancelListening();
    if(activeVoice)setVoiceState("EXECUTING");
    setCurrentTurn(beginCurrentTurn(turnId, text));
    setRequestError(false);
    if (!retry) {
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: text || "선택한 조건으로 일정을 추천해 주세요.",
          turnId,
        },
      ]);
    }
    if (followCurrentTurnRef.current)
      requestAnimationFrame(() =>
        currentTurnConversationRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        }),
      );
    setLoading(true);
    track(
      text ? "FREE_LANGUAGE_REQUEST" : "STRUCTURED_RECOMMENDATION_REQUESTED",
      tripSession.id,
      { mode: tripMode },
    );
    try {
      const storedTrip=loadTripSession(localStorage,region.id)||tripSession,storedLocation=tripMode==="PLAN"?storedTrip.locationContext?.planStart:storedTrip.locationContext?.now;
      const gps=isFreshTripLocation(storedLocation)?{status:"AVAILABLE" as const,latitude:storedLocation!.latitude,longitude:storedLocation!.longitude,accuracy:storedLocation!.accuracy??100,observedAt:storedLocation!.observedAt}:tripMode==="PLAN"||storedLocation?null:getSessionLocation();
      const previousContext =
        [...messages].reverse().find((message) => message.result?.context)
          ?.result?.context || {};
      const previousInput = previousContext.raw?.input || previousContext;
      const carriedContext = {
        visitorNo: previousInput.visitorNo || previousContext.visitorNo,
        visitorAge: previousInput.visitorAge,
        healthConditions:
          previousContext.healthConditions || previousInput.healthConditions,
        wellnessGoals:
          previousContext.wellnessGoals || previousInput.wellnessGoals,
        activityPreferences:
          previousContext.activityPreferences ||
          previousInput.activityPreferences,
        mustVisitPlaces:
          previousContext.mustVisitPlaces || previousInput.mustVisitPlaces,
        companions: previousContext.companions || previousInput.companions,
        weather: previousInput.weather || previousContext.weather,
        congestion: previousInput.congestion,
        temperature: previousContext.temperature,
        precipitation: previousContext.precipitation,
        transportMode: previousContext.transportMode,
        stayUntil: previousContext.stayUntil,
        walkingLevel: previousContext.walkingLevel,
        companionConstraints: previousContext.companionConstraints,
        congestionState: previousContext.congestionState,
        runtimeStates: previousContext.runtimeStates,
      };
      const result = await postConciergeChat({
        regionId: region.id,
        experienceRegionId: region.id,
        searchRegionId:
          (loadTripSession(localStorage, region.id) || tripSession)
            .locationContext?.now?.searchRegionId ?? null,
        turnId,
        ...(conversationAnchor?.regionId === region.id
          ? { conversationalAnchor: conversationAnchor }
          : {}),
        ...(discoveryContext?.regionId === region.id
          ? { discoveryContext }
          : {}),
        ...(hasCompletedTurn ? carriedContext : structuredDraft),
        ...(hasCompletedTurn ? explicitJourneyPayload(explicitJourney) : {}),
        ...structured,
        tripContext: sessionContext(
          loadTripSession(localStorage, region.id) || tripSession,
        ).tripContext,
        ...(text ? { rawMessage: text, inputMode: "FREE_TEXT" as const } : {}),
        contextSessionId: contextSessionIdRef.current,
        discoveryCategoryHint: (discoveryContext?.targetCategory ||
          currentResult?.discovery
            ?.category) as CreateContextInput["discoveryCategoryHint"],
        isFollowup:
          hasCompletedTurn &&
          !/카페|커피|식당|맛집|배고|밥|숙소|호텔|펜션|관광|명소|왜|유래|역사|의미/.test(
            text,
          ),
        ...(gps?.status === "AVAILABLE"
          ? {
              latitude: gps.latitude,
              longitude: gps.longitude,
              locationAccuracy: gps.accuracy,
              locationObservedAt: gps.observedAt,
              locationStatus: gps.status,
            }
          : tripMode === "PLAN"
            ? {}
            : { locationStatus: gps?.status }),
      });
      const isGuideExplanation = result.intentRoute === "GUIDE_EXPLANATION";
      const latestSession =
        loadTripSession(localStorage, region.id) || tripSession;
      if (!isGuideExplanation)
        saveTripSession({
          ...latestSession,
          mode: tripMode === "GENERIC" ? latestSession.mode : tripMode,
          runtimeContext:
            tripMode === "PLAN" ? latestSession.runtimeContext : result.context,
        });
      if (tripMode === "PLAN") track("PLAN_COMPLETED", tripSession.id);
      if (tripMode === "NOW")
        track("RUNTIME_HYDRATED", tripSession.id, {
          location: Boolean(gps?.status === "AVAILABLE"),
        });
      if (result.recommendation)
        track("RECOMMENDATION_SHOWN", tripSession.id, {
          mode: tripMode,
          candidateRegionIds: (
            result.recommendation.candidateRegionIds || []
          ).join(","),
        });
      if (runtimeJourneySteps(result.recommendation).length)
        track("RUNTIME_JOURNEY_PRESENTED", tripSession.id, { mode: tripMode });
      const partnerCandidateIds = [
        ...(result.discovery?.entities || []),
        ...runtimeJourneySteps(result.recommendation),
      ]
        .map(
          (item: any) => item.entityId || item.programUri || item.facilityUri,
        )
        .filter(Boolean);
      if (partnerCandidateIds.length)
        void recordPartnerRecommendations({
          regionId: region.id,
          anonymousTripId: tripSession.anonymousTripId,
          entityIds: partnerCandidateIds,
        });
      if (!isGuideExplanation)
        setExplicitJourney((current) =>
          captureExplicitJourney(result, turnId, current),
        );
      if (result.intentRoute)
        track("INTENT_ROUTED", tripSession.id, {
          intentRoute: result.intentRoute,
        });
      if (result.discovery?.searchFallback?.used) {
        const entity = result.discovery.entities[0];
        track("SEARCH_FALLBACK_USED", tripSession.id, {
          category: result.discovery.category,
        });
        track(
          entity?.operationalEvidence?.source === "RDM"
            ? "SEARCH_ENTITY_RESOLVED"
            : "SEARCH_ENTITY_UNVERIFIED",
          tripSession.id,
          { category: result.discovery.category },
        );
      }
      if (conversationAnchor?.source === "SEARCH" && result.discovery)
        track("SEARCH_TO_ACTION_CONTINUED", tripSession.id, {
          category: result.discovery.category,
        });
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: summarizeResult(result),
          result,
          requestText: text,
          turnId,
        },
      ]);
      setCurrentTurn((current) => resolveCurrentTurn(current, turnId, result));
      if(activeVoice){track("VOICE_COMPLETED",tripSession.id,{durationMs:Date.now()-voiceStartedAtRef.current,confirmation:true});setVoiceUnderstanding(null);setVoiceState("IDLE");}
      setExcludedDiscoveryIds([]);
      const referenceEntity = result.discovery?.entities?.[0];
      const reference = referenceEntity
        ? {
            entityId: referenceEntity.entityId,
            regionId: referenceEntity.regionId || region.id,
            label:
              referenceEntity.programLabel ||
              referenceEntity.facilityLabel ||
              referenceEntity.label,
            entityType: referenceEntity.entityType,
            category: referenceEntity.category,
            latitude: referenceEntity.latitude,
            longitude: referenceEntity.longitude,
            source:
              referenceEntity.operationalEvidence?.source === "SEARCH"
                ? ("SEARCH" as const)
                : ("RDM" as const),
            sourceTurnId: turnId,
            role: "RESULT" as const,
          }
        : result.conversationalReference
          ? {
              ...result.conversationalReference,
              sourceTurnId: turnId,
              role: "SUBJECT" as const,
            }
          : null;
      if (!isGuideExplanation && !result.distanceInfo)
        setConversationAnchor(
          reference?.regionId === region.id ? reference : null,
        );
      if (
        result.discovery &&
        result.discovery.anchorEntityId &&
        referenceEntity
      ) {
        setDiscoveryContext((previous) => {
          const same =
            previous?.regionId === region.id &&
            previous.anchor.entityId === result.discovery!.anchorEntityId &&
            previous.targetCategory === result.discovery!.category;
          return {
            regionId: region.id,
            anchor: {
              entityId: result.discovery!.anchorEntityId!,
              label: result.discovery!.anchorLabel,
              latitude: result.discovery!.anchorLatitude,
              longitude: result.discovery!.anchorLongitude,
              source: result.discovery!.anchorEntityId!.startsWith("search:")
                ? "SEARCH"
                : "RDM",
            },
            targetCategory: result.discovery!.category as NonNullable<
              CreateContextInput["discoveryCategoryHint"]
            >,
            relation: result.discovery!.relation || "REGIONAL",
            currentResult: {
              entityId: referenceEntity.entityId,
              label:
                referenceEntity.programLabel || referenceEntity.facilityLabel,
              latitude: referenceEntity.latitude,
              longitude: referenceEntity.longitude,
              source:
                referenceEntity.operationalEvidence?.source === "SEARCH"
                  ? "SEARCH"
                  : "RDM",
            },
            shownEntityIds: [
              ...new Set([
                ...(same ? previous!.shownEntityIds : []),
                referenceEntity.entityId,
              ]),
            ],
            sourceTurnId: turnId,
          };
        });
      } else if (!isGuideExplanation && !result.distanceInfo)
        setDiscoveryContext(undefined);
      setInput("");
      setFreeTextOpen(false);
      setManualEntryMode(null);
    } catch (e: any) {
      if(activeVoice){setInput(text);setManualEntryMode("TEXT");}
      console.error("[concierge] request failed", e);
      setRequestError(true);
      setFreeTextOpen(true);
      track("RETRY_ERROR", tripSession.id, { stage: "recommendation" });
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
      if(activeVoice){setVoiceUnderstanding(null);setVoiceDraft("");setVoiceState("IDLE");setVoiceOpen(false);}
    }
    } finally { requestInFlightRef.current=false; setLoading(false); }
  };

  useEffect(() => {
    if (
      entryState?.autoSubmit &&
      entryState.initialMessage &&
      shouldAutoSubmitEntry(entryState.initialMessage, restored?.messages) &&
      !homeSubmittedRef.current
    ) {
      homeSubmittedRef.current = true;
      send(entryState.initialMessage);
    }
  }, []);

  const hasCompletedTurn = messages.some((message) => Boolean(message.result));
  const requestUi=requestPresentation(hasCompletedTurn,loading,freeTextOpen,voiceOpen);
  const requestCopy=REQUEST_PRESENTATION_COPY[language];
  const currentResult =
    currentTurn?.status === "RESOLVED" ? currentTurn.result : undefined;
  const currentIsKnowledge = isExplanationOnly(currentTurn?.requestText || "");
  const hasRecommendation =
    !currentIsKnowledge && Boolean(currentResult?.recommendation);
  const hasPrimaryResult =
    !currentIsKnowledge &&
    Boolean(
      currentResult?.recommendation ||
      currentResult?.discovery ||
      currentResult?.distanceInfo,
    );
  const latestRecommendation = hasRecommendation ? currentResult : undefined;
  const journeySteps = runtimeJourneySteps(currentResult?.recommendation);
  const latestPrimaryResult = hasPrimaryResult ? currentResult : undefined;
  useEffect(() => {
    const textarea = textInputRef.current;
    if (!textarea) return;
    if (!hasCompletedTurn || !input) {
      textarea.style.height = "44px";
      return;
    }
    textarea.style.height = "44px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 88)}px`;
  }, [input, hasCompletedTurn]);

  useEffect(() => {
    if (currentTurn?.status !== "RESOLVED") return;
    responseStabilizerCleanupRef.current();
    const frame = requestAnimationFrame(() => {
      const answer = currentAnswerRef.current;
      alignCompletedResponse(answer, () => followCurrentTurnRef.current);
      responseStabilizerCleanupRef.current = stabilizeCompletedResponse(
        answer,
        () => followCurrentTurnRef.current,
      );
    });
    return () => {
      cancelAnimationFrame(frame);
      responseStabilizerCleanupRef.current();
    };
  }, [currentTurn?.status, currentTurn?.turnId]);

  const runDemo = async () => {
    const turnId = crypto.randomUUID();
    const requestText =
      "맑은 날 78세 어머니를 모시고 자동차로 방문합니다. 어머니는 무릎이 불편해 짧은 보행이 필요하고 오후 5시까지 머물 예정입니다.";
    setLoading(true);
    setCurrentTurn(beginCurrentTurn(turnId, requestText));
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: requestText,
        turnId,
      },
    ]);
    try {
      const result = await runDemoScenario();
      const merged: ConciergeChatResponse = {
        ...result,
        recommendation: (result as any).runResult?.recommendation,
        risks: (result as any).context?.risks,
      } as any;
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: summarizeResult(merged),
          result: merged,
          requestText,
          turnId,
        },
      ]);
      setCurrentTurn((current) => resolveCurrentTurn(current, turnId, merged));
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "데모 시나리오 실행 중 오류: " + (e?.message || ""),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="concierge-conversation">
      {requestUi.intro&&!otherRequestOpen&&<RuntimeJourneyEntry loading={loading} onCreate={createRuntimeJourney} onDirect={()=>setOtherRequestOpen(true)}/>}
      {requestUi.intro&&otherRequestOpen&&<section className="runtime-other-request" aria-label={language==='ko'?'다른 요청 방식':'Another request method'}><button className="btn btn-primary" onClick={openVoice}>{language==='ko'?'말하기':'Speak'}</button><button className="btn btn-outline" onClick={openText}>{language==='ko'?'글로 입력하기':'Type'}</button><button className="btn btn-text" onClick={()=>setOtherRequestOpen(false)}>{language==='ko'?'닫기':'Close'}</button></section>}

      {tripMode === "PLAN" && !hasCompletedTurn && <SavedTripEntry />}
      {tripMode !== "PLAN" && (
        <div ref={liveStoryRef} className="journey-live-context">
          {tripMode === "NOW" && !hasCompletedTurn && !loading && (
            <header className="journey-mode-header now">
              <small>NOW · 여행 중</small>
              {entryState?.entryDescription && entryState.entryMessage && (
                <strong className="partner-entry-title">{entryState.entryMessage}</strong>
              )}
              {entryState?.entryDescription && (
                <p className="partner-entry-description">{entryState.entryDescription}</p>
              )}
            </header>
          )}
          <GajoLiveStatus
            regionName={region.regionName}
            regionId={region.id}
            liveEnabled={regionalRuntimeView(region).weatherEnabled}
          />
        </div>
      )}
      {tripMode === "NOW" && tripSession.plannedContext && (
        <NowContinuationSummary planned={tripSession.plannedContext} language={language} />
      )}
      {tripMode === "NOW" && <details className="structured-request-alternative"><summary>{language==="en"?"Location settings":"위치 설정"}</summary><LocationContextBar mode="NOW" refreshNeeded={Boolean(locationFreshnessNotice)} onConfirmed={()=>setLocationFreshnessNotice(null)} /></details>}
      {tripMode === "PLAN" && !hasCompletedTurn && <details className="structured-request-alternative"><summary>{language==="en"?"Starting point":"여행 시작 위치"}</summary><LocationContextBar mode="PLAN" /></details>}
      {tripMode==="NOW"&&locationFreshnessNotice&&<section className="card location-freshness-choice" role="status"><b>마지막으로 확인한 위치가 오래됐어요. 현재 위치를 다시 확인할까요?</b><p>{locationFreshnessNotice.label||"이전 확인 위치"}{locationFreshnessNotice.confirmedAt?` · ${new Date(locationFreshnessNotice.confirmedAt).toLocaleString("ko-KR")}`:""}</p><button type="button" className="btn btn-outline" onClick={()=>{const request=lastRequestRef.current;if(!request)return;allowStaleLocationOnceRef.current=true;setLocationFreshnessNotice(null);void send(request.text,request.structured,true)}}>이 위치 기준으로 검색</button></section>}
      <div className="chat-window">
        {messages.map((m, i) => {
          if(i===0&&m.role==="ai"&&!m.result&&!m.turnId)return null;
          const isCurrentAnswer =
            m.role === "ai" &&
            Boolean(m.result) &&
            isCurrentTurn(m.turnId, currentTurn);
          return (
            <div
              key={i}
              ref={isCurrentAnswer ? currentAnswerRef : undefined}
              className={`chat-message${isCurrentAnswer ? " current-ai-answer-anchor" : ""}`}
              tabIndex={isCurrentAnswer ? -1 : undefined}
              aria-label={isCurrentAnswer ? "새 AI 여행 답변" : undefined}
            >
              <div
                className={`chat-bubble ${m.role === "user" ? "user" : "ai"}`}
              >
                {m.role === "ai" ? <GlossaryText text={m.text} /> : m.text}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="loading" role="status">{requestCopy.processing}</div>
        )}
        <div
          ref={currentTurnConversationRef}
          className="current-turn-conversation-anchor"
          aria-hidden="true"
        />
      </div>
      {requestError && (
        <div className="visitor-error" role="alert">
          <b>잠시 연결이 원활하지 않습니다.</b>
          <p>다시 한 번 시도해 주세요.</p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              const last = lastRequestRef.current;
              if (last) send(last.text, last.structured, true);
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      {hasRecommendation && latestRecommendation && (
        <div className="recommendation-journey-start">
          {tripMode === "PLAN" && tripSession.plannedContext && (
            <PlanSummary planned={tripSession.plannedContext} />
          )}
          <UnderstoodContext result={latestRecommendation} />
          {journeySteps.length>0&&<h1>{language==='ko'?'지금맞춤 지역여정':'Runtime-Adaptive Regional Journey'}</h1>}
          {journeySteps.length?<ResultPanel result={latestRecommendation} onFindNearbyRestaurants={openNearby}/>:<section className="runtime-empty-journey" aria-labelledby="runtime-empty-journey-title"><h2 id="runtime-empty-journey-title">{language==='ko'?'조건에 맞는 여정을 찾지 못했어요.':'We could not find a matching journey.'}</h2><p>{language==='ko'?'검증된 장소가 부족하거나 선택한 조건이 좁을 수 있어요. 목적이나 조건을 바꿔 다시 만들어 보세요.':'Verified places may be limited or the selected conditions may be too narrow. Change the goal or preferences and try again.'}</p><div className="runtime-empty-actions"><button type="button" className="runtime-empty-primary" aria-expanded={emptyJourneyEditOpen} onClick={()=>setEmptyJourneyEditOpen(open=>!open)}>{language==='ko'?'목적·조건 다시 선택':'Choose Goal and Preferences'}</button><button type="button" disabled={loading} onClick={()=>{const request=journeyRequest({goal:'ACCOMMODATION'},language);createRuntimeJourney(request.text,request.context,request.planned)}}>{language==='ko'?'숙소 찾기':'Find Lodging'}</button><button type="button" disabled={loading} onClick={()=>{const last=lastRequestRef.current;if(last)void send(last.text,last.structured,true)}}>{language==='ko'?'같은 조건으로 다시 찾기':'Retry Same Search'}</button></div>{emptyJourneyEditOpen&&<div className="runtime-empty-editor"><RuntimeJourneyEntry loading={loading} onCreate={createRuntimeJourney} onDirect={()=>{setEmptyJourneyEditOpen(false);openText()}}/></div>}</section>}
          {journeySteps.length>0&&<FullJourneySave
            itinerary={latestRecommendation.recommendation?.itinerary}
            durationLabel={
              tripSession.plannedContext?.duration === "1N2D"
                ? "1박2일"
                : tripSession.plannedContext?.duration === "2N3D"
                  ? "2박3일"
                  : undefined
            }
          />}
          {journeySteps.length>0&&<RuntimeJourneyResultActions result={latestRecommendation} loading={loading} otherOpen={otherRequestOpen} onAdjust={(text,context,planned)=>{track('RUNTIME_JOURNEY_REPLAN_REQUESTED',tripSession.id,{mode:tripMode});createRuntimeJourney(text,context,planned)}} onReplace={(step)=>{if(requestInFlightRef.current)return;track('RUNTIME_JOURNEY_REPLAN_REQUESTED',tripSession.id,{mode:tripMode,entityId:step.entityId||step.programUri||step.facilityUri});const label=step.programLabel||step.facilityLabel||step.label||step.name;void send(language==='ko'?`${label} 단계만 다른 검증된 장소로 바꾸고 나머지 여정과 조건은 유지해 주세요.`:`Replace only the ${label} step with another verified place and keep the rest of the journey and preferences.`,structuredDraft)}} onOther={()=>setOtherRequestOpen(true)} onVoice={()=>{setOtherRequestOpen(false);openVoice()}} onText={()=>{setOtherRequestOpen(false);openText()}} onCloseOther={()=>setOtherRequestOpen(false)}/>}
          {shouldOfferContextRefresh(currentResult,Boolean(locationFreshnessNotice))&&<section className="card runtime-journey-card">
            <GajoLiveStatus
              actionOnly
              disabled={loading}
              regionName={region.regionName}
              regionId={region.id}
              liveEnabled={regionalRuntimeView(region).weatherEnabled}
              onLiveRefresh={live=>send(RECOMMENDATION_REQUEST_COPY[language].automaticRequest,{...live.context,regionId:region.id})}
            />
            <details className="demo-tools">
              <summary>시연·테스트</summary>
              <p>발표용으로 13시 강한 비 상황을 재현합니다.</p>
              <button
                className="btn btn-outline btn-block"
                onClick={runDemo}
                disabled={loading}
              >
                13시 강한 비 상황 재현
              </button>
            </details>
          </section>}
          {loading && (
            <div className="loading">이어서 살펴보고 있습니다...</div>
          )}
        </div>
      )}

      {!hasRecommendation && currentResult && (currentResult.nearbyDiscoveryIntent || currentResult.nearbyRestaurantIntent) && (
        <div className="recommendation-journey-start nearby-fallback-action">
          <ResultPanel result={currentResult} onFindNearbyRestaurants={openNearby} />
        </div>
      )}

      {latestPrimaryResult?.discovery && (
        <div className="recommendation-journey-start">
          <UnderstoodContext result={latestPrimaryResult} />
          <PlaceDiscoveryPanel
            result={latestPrimaryResult}
            excludedEntityIds={excludedDiscoveryIds}
          />
          {loading && (
            <div className="loading">이어서 살펴보고 있습니다...</div>
          )}
        </div>
      )}
      {latestPrimaryResult?.distanceInfo && (
        <div className="recommendation-journey-start">
          <DistanceInfoPanel result={latestPrimaryResult} />
        </div>
      )}
      {currentResult && currentTurn?.status === "RESOLVED" && (
        <AiResponseActions
          rawMessage={currentTurn.requestText}
          result={currentResult}
          turnId={currentTurn.turnId}
          excludedEntityIds={excludedDiscoveryIds}
          onExcludedEntityIdsChange={ids=>{
            setExcludedDiscoveryIds(ids);
            const next=currentResult.discovery?.entities.find(entity=>entity.entityId&&!ids.includes(entity.entityId));
            if(next&&(!next.regionId||next.regionId===region.id)&&next.entityId){
              setConversationAnchor({entityId:next.entityId,regionId:region.id,label:next.programLabel||next.facilityLabel||next.label,
                latitude:next.latitude,longitude:next.longitude,sourceTurnId:currentTurn.turnId,role:"SELECTED"});
            }
          }}
        />
      )}
      <InstallExperience usefulResult={hasPrimaryResult} />

      {requestUi.voice&&<VoiceInputDialog state={voiceState} text={voiceDraft} reviewing={Boolean(voiceUnderstanding)}
        error={voiceError} locale={language}
        onChange={text=>{setVoiceDraft(text);track("VOICE_PARTIAL_EDIT_COMPLETED",tripSession.id,{inputMethod:"TEXT"});}}
        onStop={stopListening} onSpeakAgain={beginVoice} onCancel={dismissVoice} onType={voiceToText}
        onConfirm={()=>send(voiceDraft,undefined,false,voiceUnderstanding||undefined)}/>}
      {requestUi.followup&&!hasRecommendation&&<button type="button" className="btn btn-text" onClick={()=>setOtherRequestOpen(true)}>{language==='ko'?'다른 요청하기':'Make Another Request'}</button>}
      {requestUi.followup&&otherRequestOpen&&!hasRecommendation&&<div className="conversation-other-request" aria-label={language==="en"?"Another request":"다른 요청"}><button type="button" className="btn btn-text" onClick={openVoice}>{language==='ko'?'말하기':'Speak'}</button><button type="button" className="btn btn-text" onClick={openText}>{language==='ko'?'글로 입력하기':'Type'}</button><button type="button" className="btn btn-text" onClick={()=>setOtherRequestOpen(false)}>{requestCopy.cancel}</button></div>}
      {requestUi.text && (
        <div className={"concierge-input-panel concierge-unified-composer"}>
          {manualEntryMode!=="VOICE"&&<textarea
            ref={textInputRef}
            rows={5}
            aria-label={RECOMMENDATION_REQUEST_COPY[language].inputLabel}
            placeholder={requestCopy.help}
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}
          />}
          {manualEntryMode!=="VOICE"&&<button
            className="btn btn-primary btn-block concierge-submit"
            onClick={() => send()}
            disabled={loading||Boolean(voiceUnderstanding)}
            aria-label={requestCopy.send}
          >
            {hasCompletedTurn ? (
              <>
                <span aria-hidden="true">➤</span>
                <span className="sr-only">{requestCopy.send}</span>
              </>
            ) : (
              requestCopy.send
            )}
          </button>}
          <button type="button" className="btn btn-outline" onClick={()=>{setManualEntryMode(null);setFreeTextOpen(false)}}>{requestCopy.cancel}</button>
          {hasCompletedTurn && (
            <button
              type="button"
              className="btn btn-outline btn-block concierge-return-trip"
              onClick={() => navigate(regionLink("/itinerary"))}
            >
              내 여행으로 돌아가기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Builds a uri -> 한글 라벨 lookup from every source available on the
 * response (riskLabels/usedAgentLabels from the backend, plus every
 * subject/object label already present in the recommendation's evidence
 * chain). Falls back to a shortened URI (gajo:xxx / roo:xxx) when no
 * label can be found, so the chat panel never shows a bare full URI.
 */
function NowContinuationSummary({ planned, language }: { planned: PlannedContext; language:"ko"|"en" }) {
  const summary = buildNowContinuation(planned);
  if (!summary) return null;
  const english = [
    planned.companions?.[0]?.relationship === "parent" ? "With Parents" : planned.companions?.[0]?.relationship === "child" ? "With Children" : undefined,
    planned.transportMode === "CAR" ? "Car" : planned.transportMode === "WALK" ? "Walking" : planned.transportMode === "PUBLIC_TRANSPORT" ? "Public Transit" : undefined,
    planned.walkingLevel === "LOW" ? "Minimal Walking" : undefined,
  ].filter(Boolean);
  return (
    <section
      className="plan-continuity now-continuation"
      aria-labelledby="now-continuation-title"
    >
      <h2 id="now-continuation-title">{language==="en"?"Let’s continue your saved trip.":"준비해 둔 여행을 이어갈게요."}</h2>
      {summary.circumstances.length > 0 && (
        <p>{language==="en"?english.join(" · "):summary.circumstances.join(" · ")}</p>
      )}
      {summary.interests.length > 0 && <p>{language==="en"?summary.interests.map(value=>({FOOD:"Eat",CAFE:"Rest at a Café",NEXT_PLACE:"Find the Next Place",EVENT_TODAY:"Events Today"} as Record<string,string>)[value]||value).join(" · "):summary.interests.join(" · ")}</p>}
      <strong>{language==="en"?"Tell us what has changed.":"달라진 점만 알려주세요."}</strong>
    </section>
  );
}

function PlanSummary({ planned }: { planned: PlannedContext }) {
  const duration = {
    DAY: "당일",
    "1N2D": "1박 2일",
    "2N3D": "2박 3일",
    CUSTOM: "날짜 직접 선택",
  }[planned.duration || "CUSTOM"];
  const companion = planned.companions?.[0]?.relationship;
  return (
    <section className="plan-summary">
      <small>내 여행 준비</small>
      <h2>{duration}</h2>
      <p>
        {[
          companion === "parent"
            ? "부모님과 함께"
            : companion === "spouse"
              ? "부부 여행"
              : companion === "child"
                ? "아이와 함께"
                : companion
                  ? "가족 여행"
                  : "동행 미정",
          planned.transportMode === "CAR"
            ? "자동차"
            : planned.transportMode === "WALK"
              ? "도보"
              : planned.transportMode === "PUBLIC_TRANSPORT"
                ? "대중교통"
                : null,
          planned.walkingLevel === "LOW"
            ? "짧은 보행"
            : planned.walkingLevel === "HIGH"
              ? "걷기 여유"
              : planned.walkingLevel === "MODERATE"
                ? "보통 걷기"
                : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p>
        {planned.interests
          ?.map(
            (id) =>
              REGION_INTEREST_OPTIONS.find((x) => x.id === id)?.label || id,
          )
          .join(" · ")}
      </p>
      {planned.mustVisitPlaces?.length ? (
        <p>
          꼭 가고 싶은 곳:{" "}
          {planned.mustVisitPlaces.map((x) => x.label).join(", ")}
        </p>
      ) : null}
    </section>
  );
}

function UnderstoodContext({ result }: { result: ConciergeChatResponse }) {
  const rows = withRequestedDestinations(
    buildContextSummary(result.context || {}),
    result.requestedDestinations,
  );
  if (result.discovery)
    return (
      <section className="understood-context-card">
        <h2>{SHARED_VISITOR_COPY.understoodHeading}</h2>
        <p className="muted-line">{understoodSummary(result)}</p>
      </section>
    );
  return (
    <section className="understood-context-card">
      <h2>{SHARED_VISITOR_COPY.understoodHeading}</h2>
      {rows.length ? (
        <dl>
          {rows.map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="muted-line">{understoodSummary(result)}</p>
      )}
    </section>
  );
}

function ResultPanel({
  result,
  onFindNearbyRestaurants,
}: {
  result: ConciergeChatResponse;
  onFindNearbyRestaurants: (category?: ConciergeChatResponse["nearbyCategory"]) => void;
}) {
  const rec = result.recommendation;
  const itinerarySteps: any[] = rec?.itinerary?.steps || rec?.steps || [];

  return (
    <section className="recommendation-section">
      {rec && (
        <>
          <h2>{SHARED_VISITOR_COPY.recommendationHeading}</h2>
          {rec.reasonSummary && (
            <div className="visitor-reason-summary">
              <b>이렇게 추천한 이유</b>
              <p>{rec.reasonSummary}</p>
            </div>
          )}
        </>
      )}
      {(result.nearbyDiscoveryIntent || result.nearbyRestaurantIntent) && (
        <div
          style={{
            marginBottom: 12,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: 10,
            padding: 12,
          }}
        >
          <b style={{ fontSize: 13 }}>실제 내 위치 기준으로 찾아드릴까요?</b>
          <p
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              margin: "6px 0 10px",
            }}
          >
            현재 위치를 확인한 뒤 선택한 종류의 주변 장소를 보여드리고 지도·전화·길찾기로 이어드려요.
          </p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => onFindNearbyRestaurants(result.nearbyCategory)}
          >
            {result.nearbyCategory?.startsWith("LODGING") ? "주변 숙소 찾기" : "주변 장소 찾기"}
          </button>
        </div>
      )}

      {rec && itinerarySteps.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <b className="itinerary-label">추천 일정</b>
          {itinerarySteps.map((step: any, i: number) => (
            <RecommendationItineraryItem
              step={step}
              index={i}
              key={step.itemId || step.entityId || step.programUri || i}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlaceDiscoveryPanel({
  result,
  excludedEntityIds = [],
}: {
  result: ConciergeChatResponse;
  excludedEntityIds?: string[];
}) {
  const discovery = result.discovery!,
    visibleEntities = discovery.entities.filter((entity: any) => {
      const id = entity.entityId || entity.programUri || entity.facilityUri;
      return !id || !excludedEntityIds.includes(id);
    }),
    label =
      {
        CAFE: "카페",
        FOOD: "식당",
        LODGING: "숙소",
        ACTIVITY: "체험",
        TOURISM_NATURE: "관광지",
        CONVENIENCE: "편의시설",
        ESSENTIAL_SHOPPING: "생필품을 살 수 있는 곳",
        CONVENIENCE_STORE: "편의점",
        MART_SUPERMARKET: "마트·슈퍼마켓",
        PARKING: "주차장",
        PUBLIC_TOILET: "공중화장실",
        HEAT_SHELTER: "무더위쉼터",
        GAS_STATION: "주유소",
        EV_CHARGER: "전기차 충전소",
        TOURIST_INFORMATION: "관광안내소",
        PHARMACY: "약국",
        HOSPITAL: "병원",
        ATM: "ATM",
      }[discovery.category] || "장소";
  return (
    <section className="recommendation-section place-discovery-results">
      <h2>조건에 맞는 {label}</h2>
      <p className="text-muted">
        {result.discovery?.searchFallback?.used
          ? "지역 운영 데이터에 없는 장소는 검색 후보로 구분해 안내합니다. 현재 영업 여부는 방문 전에 확인해 주세요."
          : "검증된 지역 운영 데이터에서 맞는 장소만 보여드려요. 현재 영업 여부는 방문 전에 확인해 주세요."}
      </p>
      {discovery.categoryFallbackNotice && (
        <p className="text-muted">{discovery.categoryFallbackNotice}</p>
      )}
      {discovery.visitorMessage && (
        <p className="text-muted">{discovery.visitorMessage}</p>
      )}
      {visibleEntities.length ? (
        visibleEntities.map((entity: any, index: number) => (
          <div
            className="place-discovery-item"
            key={
              entity.entityId ||
              entity.programUri ||
              entity.facilityUri ||
              `unidentified-${index}`
            }
          >
            <RecommendationItineraryItem step={entity} index={index} />
            <PlaceGuidanceSummary guidance={entity.placeGuidance} />
            {entity.reasons?.length > 0 && (
              <p className="place-discovery-reasons">
                {entity.reasons.join(" · ")}
              </p>
            )}
          </div>
        ))
      ) : (
        <p className="text-muted">
          위 추천 외에 현재 조건에 맞는 추가 후보가 없습니다.
        </p>
      )}
    </section>
  );
}

function DistanceInfoPanel({ result }: { result: ConciergeChatResponse }) {
  const info = result.distanceInfo!;
  return (
    <section className="recommendation-section distance-info-result">
      <h2>거리 확인</h2>
      <p>
        {info.status === "RESOLVED"
          ? `${info.fromLabel}에서 ${info.toLabel}까지 직선거리로 약 ${info.distanceMeters}m입니다.`
          : info.message}
      </p>
      {info.status === "RESOLVED" && (
        <p className="text-muted">
          실제 이동 거리는 선택한 길과 교통수단에 따라 달라질 수 있어요.
        </p>
      )}
    </section>
  );
}
