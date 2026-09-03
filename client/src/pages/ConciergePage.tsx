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
import StructuredVisitorIntake from "../components/StructuredVisitorIntake";
import PlanVisitorIntake from "../components/PlanVisitorIntake";
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
import { NOW_HEADING, NOW_HEADING_LINES, NOW_QUICK_ACTIONS } from "../nowQuickActions";
import VoiceConfirmation from "../components/VoiceConfirmation";
import { acceptVoiceResult, understandVoice, type VoiceResultFingerprint, type VoiceUnderstanding } from "../voice/voiceUx";
import { VOICE_COPY, localizedVoiceState } from "../voice/voiceCopy";
import { useRegionalLanguage } from "../RegionalLanguageContext";

interface Message {
  role: "user" | "ai";
  text: string;
  result?: ConciergeChatResponse;
  requestText?: string;
  turnId?: string;
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
    conversationSnapshot?: {
      messages: Message[];
      currentTurn: CurrentTurnResult<ConciergeChatResponse> | null;
      input: string;
      freeTextOpen: boolean;
    };
  } | null;
  const queryMode = new URLSearchParams(location.search)
    .get("mode")
    ?.toUpperCase();
  const tripMode: "PLAN" | "NOW" | "GENERIC" =
    entryState?.tripMode ||
    (queryMode === "PLAN" || queryMode === "NOW" ? queryMode : "GENERIC");
  const preset = getQuickStartPreset(entryState?.quickStartPreset);
  const tripSession = ensureTripSession(region.id);
  const [messages, setMessages] = useState<Message[]>(entryState?.conversationSnapshot?.messages || [
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
  const [input, setInput] = useState(entryState?.conversationSnapshot?.input || entryState?.initialMessage || "");
  const [currentTurn, setCurrentTurn] =
    useState<CurrentTurnResult<ConciergeChatResponse> | null>(entryState?.conversationSnapshot?.currentTurn || null);
  const [conversationAnchor, setConversationAnchor] = useState<NonNullable<
    CreateContextInput["conversationalAnchor"]
  > | null>(null);
  const [discoveryContext, setDiscoveryContext] =
    useState<CreateContextInput["discoveryContext"]>();
  const [explicitJourney, setExplicitJourney] =
    useState<ExplicitJourneyContext>();
  const [excludedDiscoveryIds, setExcludedDiscoveryIds] = useState<string[]>(
    [],
  );
  const currentAnswerRef = useRef<HTMLDivElement>(null);
  const currentTurnConversationRef = useRef<HTMLDivElement>(null);
  const followCurrentTurnRef = useRef(true);
  const responseStabilizerCleanupRef = useRef<() => void>(() => {});
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [locationFreshnessNotice,setLocationFreshnessNotice]=useState<{label?:string;confirmedAt?:string}|null>(null);
  const [freeTextOpen, setFreeTextOpen] = useState(
    entryState?.conversationSnapshot?.freeTextOpen ?? Boolean(entryState?.freeTextOpen),
  );
  const [manualEntryMode,setManualEntryMode]=useState<"VOICE"|"TEXT"|null>(null);
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
  const voiceButtonRef = useRef<HTMLButtonElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const lastRequestRef = useRef<{
    text: string;
    structured?: CreateContextInput;
  } | null>(null);
  const allowStaleLocationOnceRef=useRef(false);
  const [voiceUnderstanding,setVoiceUnderstanding]=useState<VoiceUnderstanding|null>(null);
  const [voiceDraft,setVoiceDraft]=useState("");
  const voiceCopy=VOICE_COPY[language];
  const voiceStartedAtRef=useRef(0);
  const lastVoiceResultRef=useRef<VoiceResultFingerprint|null>(null);
  const openNearby=(category?:ConciergeChatResponse["nearbyCategory"])=>{
    navigate(`${location.pathname}${location.search}`,{replace:true,state:{...entryState,autoSubmit:false,conversationSnapshot:{messages,currentTurn,input,freeTextOpen}}});
    queueMicrotask(()=>navigate(regionLink("/nearby-discovery"),{state:{category}}));
  };
  const onVoiceFinal=(text:string)=>{
    const gate=acceptVoiceResult(lastVoiceResultRef.current,text,Date.now(),requestInFlightRef.current);
    lastVoiceResultRef.current=gate.next;
    if(!text.trim()||!gate.accepted||requestInFlightRef.current){track("VOICE_DUPLICATE_BLOCKED",tripSession.id,{source:"FINAL_RESULT"});return;}
    setVoiceDraft(text);setVoiceUnderstanding(understandVoice(text));setVoiceState("CONFIRMING");
  };
  const {
    listening,
    voiceSupported,
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
  const dismissVoice=()=>{cancelListening();setVoiceUnderstanding(null);setVoiceDraft("");setVoiceState("IDLE");setManualEntryMode("TEXT");track("VOICE_INPUT_SWITCHED",tripSession.id,{to:"TEXT_OR_TOUCH"});requestAnimationFrame(()=>textInputRef.current?.focus());};
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
  useEffect(() => {
    setConversationAnchor(null);
    setDiscoveryContext(undefined);
    setExplicitJourney(undefined);
  }, [region.id]);
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
      const partnerCandidateIds = [
        ...(result.discovery?.entities || []),
        ...(result.recommendation?.itinerary?.steps || []),
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
      if(tripMode==="NOW"){
        setFreeTextOpen(false);
        setManualEntryMode(null);
      }
    } catch (e: any) {
      console.error("[concierge] request failed", e);
      setRequestError(true);
      track("RETRY_ERROR", tripSession.id, { stage: "recommendation" });
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
      if(activeVoice){setVoiceUnderstanding(null);setVoiceDraft("");setVoiceState("IDLE");}
    }
    } finally { requestInFlightRef.current=false; }
  };

  useEffect(() => {
    if (
      entryState?.autoSubmit &&
      entryState.initialMessage &&
      !homeSubmittedRef.current
    ) {
      homeSubmittedRef.current = true;
      send(entryState.initialMessage);
    }
  }, []);

  const hasCompletedTurn = messages.some((message) => Boolean(message.result));
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
      {tripMode === "PLAN" && <SavedTripEntry />}
      {tripMode !== "PLAN" && (
        <div ref={liveStoryRef} className="journey-live-context">
          {tripMode === "NOW" && (
            <header className="journey-mode-header now">
              <small>NOW · 여행 중</small>
              <h1 aria-label={NOW_HEADING}>{NOW_HEADING_LINES.map(line=><span className="now-heading-line" key={line}>{line}</span>)}</h1>
              <p>지금 할 일을 선택하면 현재 위치와 여행 상황을 이어서 바로 찾아드려요.</p>
              {entryState?.entryDescription && entryState.entryMessage && (
                <strong className="partner-entry-title">{entryState.entryMessage}</strong>
              )}
              {entryState?.entryDescription && (
                <p className="partner-entry-description">{entryState.entryDescription}</p>
              )}
            </header>
          )}
          {tripMode === "NOW" && !hasCompletedTurn && (
            <NowImmediateActions
              onNearby={openNearby}
              onAsk={(prompt)=>send(prompt)}
              onItinerary={()=>navigate(regionLink("/itinerary"))}
              onVoice={()=>{setManualEntryMode("VOICE");setFreeTextOpen(true);}}
              onText={()=>{setManualEntryMode("TEXT");setFreeTextOpen(true);requestAnimationFrame(()=>textInputRef.current?.focus())}}
            />
          )}
          <GajoLiveStatus
            regionName={region.regionName}
            regionId={region.id}
            liveEnabled={regionalRuntimeView(region).weatherEnabled}
          />
        </div>
      )}
      {tripMode === "NOW" && tripSession.plannedContext && (
        <NowContinuationSummary planned={tripSession.plannedContext} />
      )}
      {tripMode === "NOW" && <LocationContextBar mode="NOW" refreshNeeded={Boolean(locationFreshnessNotice)} onConfirmed={()=>setLocationFreshnessNotice(null)} />}
      {tripMode==="NOW"&&locationFreshnessNotice&&<section className="card location-freshness-choice" role="status"><b>마지막으로 확인한 위치가 오래됐어요. 현재 위치를 다시 확인할까요?</b><p>{locationFreshnessNotice.label||"이전 확인 위치"}{locationFreshnessNotice.confirmedAt?` · ${new Date(locationFreshnessNotice.confirmedAt).toLocaleString("ko-KR")}`:""}</p><button type="button" className="btn btn-outline" onClick={()=>{const request=lastRequestRef.current;if(!request)return;allowStaleLocationOnceRef.current=true;setLocationFreshnessNotice(null);void send(request.text,request.structured,true)}}>이 위치 기준으로 검색</button></section>}
      <div className="chat-window">
        {messages.map((m, i) => {
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
          <div className="loading">
            말씀하신 상황에 맞는 일정을 살펴보고 있습니다...
          </div>
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

      {!hasCompletedTurn && tripMode !== "NOW" && (
        <>
          <section
            className="natural-language-entry"
            aria-labelledby="natural-language-title"
          >
            <small>AI에게 바로 물어보기</small>
            <h2 id="natural-language-title">말하거나 입력해서 알려주세요</h2>
            <p>“부모님과 왔는데 지금 어디 가지?”처럼 편하게 말씀하셔도 돼요.</p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              aria-expanded={freeTextOpen}
              onClick={() => {
                const next = !freeTextOpen;
                setFreeTextOpen(next);
                if (next) {
                  track("NATURAL_LANGUAGE_ENTRY_SELECTED", tripSession.id, {
                    mode: tripMode,
                  });
                  requestAnimationFrame(() =>
                    textInputRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    }),
                  );
                  requestAnimationFrame(() => textInputRef.current?.focus());
                }
              }}
            >
              말하거나 입력해서 물어보기
            </button>
          </section>
          <div className="planning-choice-divider">
            <span>또는</span>
            <strong>조건을 선택해서 일정 만들기</strong>
          </div>
          {tripMode === "PLAN" ? (
            <><LocationContextBar mode="PLAN"/><PlanVisitorIntake
              loading={loading}
              initial={tripSession.plannedContext}
              onSubmit={(structured, planned: PlannedContext) => {
                saveTripSession({
                  ...tripSession,
                  mode: "PLAN",
                  plannedContext: planned,
                });
                send("", structured);
              }}
            /></>
          ) : (
            <StructuredVisitorIntake
              loading={loading}
              initialValues={preset?.intakeValues}
              initialPreferences={preset?.selectedPreferences}
              entryMessage={preset?.entryMessage}
              onChange={setStructuredDraft}
              onSubmit={(structured) => send("", structured)}
            />
          )}
        </>
      )}

      {hasRecommendation && latestRecommendation && (
        <div className="recommendation-journey-start">
          {tripMode === "PLAN" && tripSession.plannedContext && (
            <PlanSummary planned={tripSession.plannedContext} />
          )}
          <UnderstoodContext result={latestRecommendation} />
          <ResultPanel
            result={latestRecommendation}
            onFindNearbyRestaurants={openNearby}
          />
          <FullJourneySave
            itinerary={latestRecommendation.recommendation?.itinerary}
            durationLabel={
              tripSession.plannedContext?.duration === "1N2D"
                ? "1박2일"
                : tripSession.plannedContext?.duration === "2N3D"
                  ? "2박3일"
                  : undefined
            }
          />
          <section className="card runtime-journey-card">
            <h2>상황이 바뀌면</h2>
            <p>
              날씨와 현재 상황이 달라지면 남은 일정을 다시 확인할 수 있어요.
            </p>
            <button
              className="btn btn-primary btn-block"
              onClick={() =>
                navigate(regionLink("/itinerary"), {
                  state: { result: latestRecommendation },
                })
              }
            >
              지금 상황에 맞게 다시 추천
            </button>
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
          </section>
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
          onExcludedEntityIdsChange={setExcludedDiscoveryIds}
        />
      )}
      <InstallExperience usefulResult={hasPrimaryResult} />

      {(tripMode !== "NOW" ? (hasCompletedTurn || freeTextOpen) : freeTextOpen) && (
        <div className={"concierge-input-panel concierge-unified-composer"}>
          <div className="input-panel-heading">
            <h2>{hasCompletedTurn ? (language==="en"?"Continue the conversation":"이어서 물어보기") : voiceCopy.start}</h2>
          </div>
          <div className="voice-mode-actions">
            <button type="button" className="btn btn-outline" disabled={loading||listening} onClick={()=>{setManualEntryMode("VOICE");}}>{voiceCopy.start}</button>
            <button type="button" className="btn btn-outline" disabled={loading} onClick={dismissVoice}>{voiceCopy.text}</button>
          </div>
          {manualEntryMode!=="VOICE"&&<textarea
            ref={textInputRef}
            rows={5}
            aria-label={hasCompletedTurn ? "이어서 물어보기" : "여행 조건 입력"}
            placeholder="필요한 내용을 입력하세요"
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}
          />}
          {manualEntryMode==="VOICE"&&<div className="voice-input-panel" onKeyDown={event=>{if(event.key==="Escape"&&!loading){event.preventDefault();dismissVoice();}}}>
            {!voiceUnderstanding&&<button
              ref={voiceButtonRef} type="button"
              className={`speech-session-button${listening?" is-listening":""}`}
              onClick={beginVoice} disabled={loading||voiceState==="REQUESTING_PERMISSION"||voiceState==="TRANSCRIBING"}
              aria-pressed={listening} aria-label={listening?voiceCopy.stop:voiceCopy.start}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
              <strong>{listening?voiceCopy.stop:voiceCopy.start}</strong>
            </button>}
            <p className="voice-helper">{voiceCopy.privacy}</p>
            {(!voiceSupported||voiceError)&&<p className="voice-error" role="alert">{voiceError}</p>}
            {!voiceUnderstanding&&<p className="voice-state" role="status" aria-live="polite">{localizedVoiceState(voiceState,language)}</p>}
            {listening&&<p className="voice-live-transcript" aria-label={voiceCopy.transcript}>{voiceDraft}</p>}
            {!voiceUnderstanding&&<button type="button" className="btn btn-outline voice-cancel" onClick={dismissVoice}>{voiceCopy.cancel}</button>}
            {voiceUnderstanding&&<VoiceConfirmation state={voiceState} text={voiceDraft}
              onChange={text=>{setVoiceDraft(text);track("VOICE_PARTIAL_EDIT_COMPLETED",tripSession.id,{inputMethod:"TEXT"});}}
              onSpeakAgain={beginVoice} onCancel={dismissVoice}
              onConfirm={()=>send(voiceDraft,undefined,false,voiceUnderstanding)}/>}
          </div>}
          {manualEntryMode!=="VOICE"&&<button
            className="btn btn-primary btn-block concierge-submit"
            onClick={() => send()}
            disabled={loading||Boolean(voiceUnderstanding)}
            aria-label={hasCompletedTurn ? "질문 전송" : "대화로 찾기"}
          >
            {hasCompletedTurn ? (
              <>
                <span aria-hidden="true">➤</span>
                <span className="sr-only">전송</span>
              </>
            ) : (
              "대화로 찾기"
            )}
          </button>}
          {tripMode==="NOW"&&!hasCompletedTurn&&<button type="button" className="btn btn-outline btn-block" onClick={()=>{cancelListening();setVoiceUnderstanding(null);setVoiceState("IDLE");setManualEntryMode(null);setFreeTextOpen(false)}}>취소</button>}
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
function NowContinuationSummary({ planned }: { planned: PlannedContext }) {
  const summary = buildNowContinuation(planned);
  if (!summary) return null;
  return (
    <section
      className="plan-continuity now-continuation"
      aria-labelledby="now-continuation-title"
    >
      <h2 id="now-continuation-title">준비해 둔 여행을 이어갈게요.</h2>
      {summary.circumstances.length > 0 && (
        <p>{summary.circumstances.join(" · ")}</p>
      )}
      {summary.interests.length > 0 && <p>{summary.interests.join(" · ")}</p>}
      <strong>달라진 점만 알려주세요.</strong>
    </section>
  );
}

function NowImmediateActions({
  onNearby,onAsk,onItinerary,onVoice,onText,
}: {
  onNearby:(category:ConciergeChatResponse["nearbyCategory"])=>void;
  onAsk:(prompt:string)=>void;
  onItinerary:()=>void;
  onVoice:()=>void;
  onText:()=>void;
}) {
  return (
    <section className="now-needs" aria-labelledby="now-needs-title">
      <h2 id="now-needs-title">지금 무엇을 할까요?</h2>
      <p>말하지 않아도 바로 시작할 수 있어요.</p>
      <div className="now-primary-actions">{NOW_QUICK_ACTIONS.map((action) => (
        <button
          type="button"
          key={action.id}
          aria-label={action.label}
          onClick={() => action.kind==="NEARBY"?onNearby(action.category):action.kind==="ASK"?onAsk(action.prompt):onItinerary()}
        >
          {action.label}
        </button>
      ))}</div>
      <div className="now-secondary-actions" aria-label="직접 요청하기"><button type="button" onClick={onVoice}>직접 말하기</button><button type="button" onClick={onText}>직접 입력하기</button></div>
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
