import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { shortUri } from "../utils/uri";
import {
  approveReplanning,
  hydrateRuntimeLocation,
  observeRuntime,
  rejectReplanning,
  type ConciergeChatResponse,
  type LiveRuntimeResponse,
  type ReplanningProposal,
} from "../api/client";
import RecommendationItineraryItem from "../components/RecommendationItineraryItem";
import GajoLiveStatus from "../components/GajoLiveStatus";
import VisitorLocationControl from "../components/VisitorLocationControl";
import MovementPlan from "../components/MovementPlan";
import { ensureTripSession, saveTripSession } from "../tripSession";
import { track } from "../analytics";
import { useRegion } from "../RegionContext";
import { useRegionalLanguage } from '../RegionalLanguageContext';
import { VISITOR_FLOW_COPY } from '../visitorFlowCopy';
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
import { SHARED_VISITOR_COPY } from "../visitorCopy";
import {
  liveRuntimeForRegion,
  runtimeContextForRegion,
} from "../liveRuntimeGuard";
import { regionalRuntimeView } from "../regionalRuntime";
import {
  currentAndNext,
  executionState,
  removeSavedPlace,
  savedPlaceItems,
  verifiedNavigation,
} from "../journeyExecution";
import {
  canonicalEntityId,
  recommendationItemLabel,
} from "../recommendationItem";
import TripManagement from "../components/TripManagement";
import ItineraryItemEditor from "../components/ItineraryItemEditor";
import ArchivedTrips from "../components/ArchivedTrips";
import EntityActions from "../components/EntityActions";
import {
  journeySoundMuted,
  playJourneySound,
  setJourneySoundMuted,
} from "../journeySound";

export default function ItineraryPage() {
  const {language} = useRegionalLanguage();
  const region = useRegion();
  const [, setRevision] = useState(0);
  const tripSession = ensureTripSession(region.id);
  const regionLink = (path: string) => regionalPath(path, region.id);

  const location = useLocation() as {
  state?: {
    result?: ConciergeChatResponse;
    safetyReview?: {
      status?: string;
      source?: string;
      checkedAt?: string;
      alerts?: any[];
    };
  };
};

  const navigate = useNavigate();
  const hasFullJourney = Boolean(
    (tripSession.itinerary as any)?.savedAsFullJourney ||
    location.state?.result,
  );
  const [savedPlaces, setSavedPlaces] = useState(() =>
    savedPlaceItems(tripSession),
  );
  const [result, setResult] = useState<ConciergeChatResponse | undefined>(
    () =>
      ((tripSession.itinerary as any)?.savedAsFullJourney
        ? ({
            context: tripSession.runtimeContext,
            recommendation: {
              itinerary: tripSession.itinerary,
              reasonSummary: "저장한 여행 일정을 순서대로 보여드려요.",
            },
          } as ConciergeChatResponse)
        : location.state?.result),
  );
  const [proposal, setProposal] = useState<ReplanningProposal | null>(null);
  const [runtimeMessage, setRuntimeMessage] = useState("");
  const [observing, setObserving] = useState(false);
  const [soundMuted, setSoundMutedState] = useState(() => journeySoundMuted());
  const [knownRuntimeContext, setKnownRuntimeContext] = useState<any>(
    () =>
      runtimeContextForRegion(location.state?.result?.context, region.id) ||
      runtimeContextForRegion(tripSession.runtimeContext, region.id),
  );
  const safetyReviewHandled = useRef(false);
  useEffect(() => {
    track("ITINERARY_VIEWED", tripSession.id, {
      source: location.state?.result ? "recommendation" : "saved-itinerary",
    });
    track("MY_TRIP_OPENED", tripSession.id, {
      hasFullJourney,
      savedPlaceCount: savedPlaces.length,
    });
  }, []);
  useEffect(() => {
    if (proposal)
      playJourneySound("ready", `replan-ready:${proposal.proposalNo}`, {
        muted: soundMuted,
      });
  }, [proposal?.proposalNo, soundMuted]);
  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent).detail?.regionId === region.id) setRevision((value) => value + 1);
    };
    window.addEventListener("regional-trip-saved", refresh);
    return () => window.removeEventListener("regional-trip-saved", refresh);
  }, [region.id]);

  useEffect(() => {
    const review = location.state?.safetyReview;

    if (!review || safetyReviewHandled.current) return;
    safetyReviewHandled.current = true;

    if (review.status !== "READY") {
      setRuntimeMessage(
        language === "ko"
          ? "현재 기상청 공식 특보 정보를 확인할 수 없어 안전 여부를 단정하지 않습니다."
          : "KMA official alert information is currently unavailable, so safety is not being assumed.",
      );
      return;
    }

    const alerts = review.alerts || [];

    if (alerts.length === 0) {
      setRuntimeMessage(
        language === "ko"
          ? "기상청 공식특보 확인 결과 현재 일정에 영향을 주는 추가 안전 변화가 없습니다. 기존 일정을 유지합니다."
          : "KMA confirms no additional official safety change affecting the current itinerary. The existing itinerary is maintained.",
      );
      return;
    }

    const itinerary =
      result?.recommendation?.itinerary ||
      (tripSession.itinerary as any);

    if (!itinerary?.steps?.length) {
      setRuntimeMessage(
        language === "ko"
          ? "공식특보는 확인했지만 현재 영향평가할 여행 일정이 없습니다."
          : "Official alerts were confirmed, but there is no current itinerary to assess.",
      );
      return;
    }

    const previousContext =
      knownRuntimeContext ||
      result?.context ||
      tripSession.runtimeContext ||
      { regionId: region.id };

    const currentContext = {
      ...previousContext,
      regionId: region.id,
      observedAt: review.checkedAt || new Date().toISOString(),
    };

    const events = alerts.map((alert: any) => ({
      eventType: "OFFICIAL_SAFETY_ALERT",
      observedAt:
        alert.issuedAt ||
        review.checkedAt ||
        new Date().toISOString(),
      severity: alert.severity || "HIGH",
      evidence: [`기상청 공식 특보: ${alert.title}`],
      currentValue: {
        alertType: alert.alertType,
        title: alert.title,
        source: alert.source || "KMA",
        rawRegionName: alert.rawRegionName,
      },
    }));

    setObserving(true);

    observeRuntime({
      regionId: region.id,
      previousContext,
      currentContext,
      itinerary,
      events,
    })
      .then((response) => {
        setKnownRuntimeContext(currentContext);
        setProposal(response.proposedRevision);

        setRuntimeMessage(
          response.replanningRecommended
            ? ""
            : language === "ko"
              ? "기상청 공식특보를 현재 일정과 비교했지만 변경이 필요한 영향은 확인되지 않았습니다. 기존 일정을 유지합니다."
              : "The KMA alerts were assessed against the current itinerary, but no change requiring replanning was identified.",
        );
      })
      .catch((error: any) => {
        setRuntimeMessage(
          language === "ko"
            ? `공식특보의 여행 영향을 확인하지 못했습니다. ${error?.message || "잠시 후 다시 시도해 주세요."}`
            : `Could not assess the trip impact of the official alert. ${error?.message || "Please try again shortly."}`,
        );
      })
      .finally(() => setObserving(false));
  }, []);
  const removePlace = (entityId: string) => {
    const updated = removeSavedPlace(region.id, entityId);
    if (!updated) return;
    setSavedPlaces(savedPlaceItems(updated));
    track("SAVED_PLACE_REMOVED", updated.id, { entityId });
  };
  const applyPartialEdit = (session:any) => {
    const itinerary=session.itinerary;
    setResult((current:any)=>({...current,recommendation:{...current.recommendation,itinerary}}));
    setRevision(value=>value+1);
    track("FULL_ITINERARY_UPDATED",session.id,{journeyId:itinerary?.journeyId||itinerary?.itineraryNo||"saved",itemCount:itinerary?.steps?.length||0,editScope:"single-item"});
  };
  if (!hasFullJourney && savedPlaces.length)
    return (
      <div>
        <header className="card my-trip-heading">
          <h1>내 여행</h1>
          <p>담아둔 곳에서 오늘 가고 싶은 장소를 자유롭게 선택하세요.</p>
        </header>
        <TripManagement onSavedPlacesCleared={setSavedPlaces} />
        <SavedPlacesSection places={savedPlaces} onRemove={removePlace} />
        <ArchivedTrips />
      </div>
    );

if (!result || !result.recommendation) {
  const safetyReview = location.state?.safetyReview;
  const safetyReady = safetyReview?.status === "READY";
  const safetyAlerts = safetyReview?.alerts || [];
  const noActiveAlerts = safetyReady && safetyAlerts.length === 0;

  return (
    <div>
      <TripManagement onSavedPlacesCleared={setSavedPlaces} />

      {safetyReview && (
        <div className="card" style={{ marginBottom: 16 }}>
          <small>🛡️ EXKOVIA RUNTIME SAFETY</small>

          <h2 style={{ marginTop: 10 }}>
            {language === "ko"
              ? "안전정보 확인 완료"
              : "Safety information checked"}
          </h2>

          {noActiveAlerts ? (
            <>
              <p>
                {language === "ko"
                  ? "현재 합천에 활성 기상특보가 없습니다."
                  : "There are currently no active KMA weather alerts for Hapcheon."}
              </p>
              <p>
                {language === "ko"
                  ? "아직 진행 중인 여행 일정이 없어 영향을 비교할 일정은 없습니다."
                  : "There is no active itinerary yet, so there is no trip to assess for impact."}
              </p>
            </>
          ) : safetyReady && safetyAlerts.length > 0 ? (
            <>
              <p>
                {language === "ko"
                  ? `현재 공식 기상특보 ${safetyAlerts.length}건이 확인되었습니다.`
                  : `${safetyAlerts.length} active official weather alert(s) were confirmed.`}
              </p>

              {safetyAlerts.map((alert: any) => (
                <div key={alert.id} style={{ margin: "10px 0" }}>
                  <strong>{alert.title}</strong>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    {alert.sourceName}
                    {alert.rawRegionName ? ` · ${alert.rawRegionName}` : ""}
                  </div>
                </div>
              ))}

              <p>
                {language === "ko"
                  ? "여행을 만들 때 이 공식 안전정보를 우선 반영합니다."
                  : "These official alerts will be considered when creating a trip."}
              </p>
            </>
          ) : (
            <p>
              {language === "ko"
                ? "현재 공식 기상특보 정보를 확인할 수 없습니다. 안전하다고 단정하지 않고 보수적으로 여행을 계획합니다."
                : "Official weather alert information is currently unavailable. The trip will be planned conservatively rather than assuming conditions are safe."}
            </p>
          )}

          <button
            className="btn btn-primary btn-block"
            onClick={() =>
              navigate(regionLink("/concierge"), {
                state: {
                  tripMode: "NOW",
                  freeTextOpen: true,
                  initialMessage: noActiveAlerts
                    ? "현재 합천에 활성 기상특보가 없다는 공식 안전정보를 반영해서 지금 가능한 여행 일정을 만들어 주세요."
                    : "현재 확인된 공식 기상특보와 안전정보를 우선 반영해서 안전한 여행 일정을 만들어 주세요.",
                  autoSubmit: false,
                },
              })
            }
          >
            {language === "ko"
              ? "안전정보를 반영해 여행 시작하기"
              : "Start a trip with safety information"}
          </button>
        </div>
      )}

      <div className="card">
        <h1>내 여행</h1>
        <h2>현재 여행</h2>
        <p>현재 진행 중인 여행 일정이 없습니다.</p>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          AI 여행도우미에게 원하는 여행을 말씀해 주세요.
        </p>

        <button
          className="btn btn-primary btn-block"
          onClick={() => navigate(regionLink("/concierge"))}
        >
          AI 여행도우미에게 물어보기
        </button>
      </div>

      <ArchivedTrips />
    </div>
  );
}

  const rec = result.recommendation;
  const itinerarySteps: any[] = rec.itinerary?.steps || rec.steps || [];
  const journey = currentAndNext(
    itinerarySteps,
    tripSession.execution?.currentEntityId,
    tripSession.execution?.statusByEntityId,
  );
  const visitorLabel = (uri: string, fallback: string) => {
    const step = itinerarySteps.find(
      (item: any) => item.programUri === uri || item.facilityUri === uri,
    );
    if (step)
      return step.programUri === uri
        ? step.programLabel || fallback
        : step.facilityLabel || fallback;
    const evidence = (rec.evidence || []).find(
      (item: any) => item.subject === uri || item.object === uri,
    );
    return evidence?.subject === uri
      ? evidence.subjectLabel || fallback
      : evidence?.objectLabel || fallback;
  };

  const observeHeavyRain = async () => {
    track("REPLAN_REQUESTED", tripSession.id, {
      source: "demo-weather-change",
    });
    setObserving(true);
    setRuntimeMessage("");
    try {
      const previousContext = runtimeContextForRegion(
        result.context,
        region.id,
      ) || { regionId: region.id };
      const demoSteps = itinerarySteps.map((step: any) => ({
        ...step,
        status: step.status || "PLANNED",
      }));
      const currentContext = {
        ...previousContext,
        regionId: region.id,
        contextNo: `${previousContext.contextNo || "runtime"}-heavy-rain`,
        observedAt: new Date().toISOString(),
        currentTime: "13:00",
        precipitation: 20,
        weather: "gajo:heavyRain",
        environmentConditions: [
          ...(previousContext.environmentConditions || []),
          "gajo:heavyRain",
        ],
        runtimeProvenance: {
          kind: "SYNTHETIC_DEMO",
          liveWeatherConfirmed: false,
        },
      };
      const response = await observeRuntime({
        regionId: region.id,
        previousContext,
        currentContext,
        itinerary: { ...rec.itinerary, steps: demoSteps },
      });
      setProposal(response.proposedRevision);
      setRuntimeMessage(
        response.suppressed
          ? "같은 조건의 제안이 이미 거절되어 다시 알리지 않습니다."
          : response.replanningRecommended
            ? ""
            : "현재 미래 일정에는 재계획이 필요한 영향이 없습니다.",
      );
    } catch (error: any) {
      setRuntimeMessage(
        `여행 상황을 확인하지 못했습니다. ${error?.message || "잠시 후 다시 시도해 주세요."}`,
      );
    } finally {
      setObserving(false);
    }
  };

  const approve = async () => {
    if (!proposal) return;
    const response = await approveReplanning(proposal.proposalNo);
    setResult((current: any) => ({
      ...current,
      recommendation: {
        ...current.recommendation,
        itinerary: response.itinerary,
      },
    }));
    const active = ensureTripSession(region.id),
      wasFull = (active.itinerary as any)?.savedAsFullJourney,
      updatedItinerary = {
        ...((active.itinerary as object) || {}),
        ...response.itinerary,
        ...(wasFull
          ? {
              savedAsFullJourney: true,
              journeyId: (active.itinerary as any).journeyId,
            }
          : {}),
      };
    const saved = saveTripSession({ ...active, itinerary: updatedItinerary });
    if (wasFull)
      track("FULL_ITINERARY_UPDATED", saved.id, {
        journeyId: (updatedItinerary as any).journeyId,
        itemCount: response.itinerary?.steps?.length || 0,
        dayCount: new Set(
          (response.itinerary?.steps || []).map(
            (step: any) => step.dayIndex || 1,
          ),
        ).size,
      });
    setProposal(null);
    playJourneySound("success", `replan-approved:${proposal.proposalNo}`, {
      muted: soundMuted,
    });
    setRuntimeMessage(
      wasFull
        ? "변경된 일정을 내 여행에 반영했습니다. 완료된 일정은 그대로 유지됩니다."
        : "승인된 미래 일정만 반영했습니다. 완료된 일정은 그대로 유지됩니다.",
    );
  };

  const observeLiveRuntime = async (live: LiveRuntimeResponse) => {
    const owned = liveRuntimeForRegion(live, region.id);
    if (!owned) return;
    track("REPLAN_REQUESTED", tripSession.id, { source: "live-runtime" });
    const previousContext = knownRuntimeContext || result.context || {};
    const response = await observeRuntime({
      regionId: region.id,
      previousContext,
      currentContext: owned.context,
      itinerary: rec.itinerary,
    });
    setKnownRuntimeContext(owned.context);
    setProposal(response.proposedRevision);
    setRuntimeMessage(
      response.replanningRecommended
        ? ""
        : "현재 일정에 영향을 주는 변화는 없습니다.",
    );
  };

  const reject = async () => {
    if (!proposal) return;
    await rejectReplanning(proposal.proposalNo);
    setProposal(null);
    setRuntimeMessage(
      "기존 일정을 유지합니다. 같은 조건은 다시 알리지 않습니다.",
    );
  };

  return (
    <div>
      <TripManagement onSavedPlacesCleared={setSavedPlaces} />
      <div className="card">
        <h2>추천 이유</h2>
        <p style={{ fontSize: 13 }}>{rec.reasonSummary}</p>
        {typeof rec.confidenceScore === "number" && (
          <div className="tag-row">
            <span className="badge">
              신뢰도 {(rec.confidenceScore * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      <MovementPlan result={result} />

      {journey.current && (
        <section className="card journey-execution-card">
          <small>지금 갈 곳</small>
          <h2>{recommendationItemLabel(journey.current)}</h2>
          {verifiedNavigation(journey.current) && (
            <EntityActions
              entity={journey.current}
              hideDetail
              navigationLabel="출발하기"
              showItineraryAdd={false}
              onNavigate={(provider) => {
                const entityId = canonicalEntityId(journey.current);
                if (entityId)
                  saveTripSession(
                    executionState(
                      ensureTripSession(region.id),
                      entityId,
                      "EN_ROUTE",
                    ),
                  );
                track("JOURNEY_START_ACTION", tripSession.id, {
                  entityId,
                  provider,
                  source: "itinerary-summary",
                });
              }}
            />
          )}
          {journey.next && (
            <div className="next-stop">
              <small>다음:</small>
              <strong>{recommendationItemLabel(journey.next)}</strong>
              <button
                className="btn btn-text"
                onClick={() =>
                  document
                    .getElementById(
                      `itinerary-${canonicalEntityId(journey.next)}`,
                    )
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                다음 일정 보기
              </button>
            </div>
          )}
          <button
            className="btn btn-outline btn-block"
            onClick={() => {
              track("REPLAN_FROM_ITINERARY", tripSession.id, {
                source: "itinerary-summary",
              });
              navigate(regionLink("/concierge?mode=now"), {
                state: { freeTextOpen: true, tripMode: "NOW" },
              });
            }}
          >
            다른 곳으로 변경
          </button>
        </section>
      )}

      <div className="card">
        <h2>여행 중 달라진 상황 확인</h2>
        <p className="text-muted">
          날씨나 이동 상황이 달라지면 남은 일정에 미치는 영향만 알려드려요.
        </p>
        <button
          type="button"
          className="btn btn-text"
          aria-pressed={soundMuted}
          onClick={() => {
            const next = !soundMuted;
            setJourneySoundMuted(next);
            setSoundMutedState(next);
          }}
        >
          {soundMuted ? "알림 소리 켜기" : "알림 소리 끄기"}
        </button>
        <VisitorLocationControl
          onLocation={async (gps) =>
            observeLiveRuntime(
              await hydrateRuntimeLocation(
                knownRuntimeContext ||
                  runtimeContextForRegion(result.context, region.id) || {
                    regionId: region.id,
                  },
                gps,
                region.id,
              ),
            )
          }
        />
        <GajoLiveStatus
          contextNo={result.context?.contextNo}
          regionName={region.regionName}
          regionId={region.id}
          liveEnabled={regionalRuntimeView(region).weatherEnabled}
          onLiveRefresh={observeLiveRuntime}
        />
        {runtimeMessage && <p style={{ fontSize: 12 }}>{runtimeMessage}</p>}
        {import.meta.env.DEV && <div className="demo-runtime-control">
          <small>시연·테스트 기능</small>
          <p>
            완료된 앞의 두 일정을 보존하고 13:00, 강수량 20mm 상황을 재현합니다.
          </p>
          <button
            className="btn btn-outline btn-block"
            onClick={observeHeavyRain}
            disabled={observing}
          >
            {observing ? "데모 실행 중…" : "데모: 13시 강한 비 발생"}
          </button>
        </div>}
      </div>

      {proposal && (
        <div className="card replanning-card">
          <small>새 일정 제안</small>
          <h2>여행 상황이 바뀌었어요</h2>
          <div className="replanning-section">
            <b>무엇이 바뀌었나요?</b>
            <p>날씨나 이동 조건이 달라져 남은 일정을 다시 확인했어요.</p>
          </div>
          <div className="replanning-section">
            <b>영향받는 일정</b>
            {proposal.removedItems.map((step: any) => (
              <span className="badge risk" key={step.itemId || step.order}>
                {step.programLabel || step.facilityLabel || step.label}
              </span>
            ))}
          </div>
          <div className="replanning-section">
            <b>제안하는 대안</b>
            {proposal.proposedNewItems.map((step: any) => (
              <span className="badge" key={step.itemId || step.order}>
                {step.programLabel || step.facilityLabel || step.label}
              </span>
            ))}
          </div>
          <div className="replanning-section">
            <b>추천 이유</b>
            <p>{proposal.explanation}</p>
          </div>
          <div className="sequence-comparison">
            <div>
              <b>기존 남은 일정</b>
              <p>
                {itinerarySteps
                  .filter(
                    (step: any) =>
                      step.status !== "COMPLETED" && step.status !== "SKIPPED",
                  )
                  .map(
                    (step: any) =>
                      step.programLabel || step.facilityLabel || step.label,
                  )
                  .join(" → ") || "-"}
              </p>
            </div>
            <div>
              <b>{SHARED_VISITOR_COPY.replanningProposal}</b>
              <p>
                {proposal.proposedFutureSteps
                  .map(
                    (step: any) =>
                      step.programLabel || step.facilityLabel || step.label,
                  )
                  .join(" → ") || "-"}
              </p>
            </div>
          </div>
          {proposal.preservedHistory?.length > 0 && (
            <p className="preserved-history">
              🔒 완료된 {proposal.preservedHistory.length}개 일정은 그대로
              보존됩니다.
            </p>
          )}
          <div className="grid-2">
            <button className="btn btn-primary" onClick={approve}>
              새 일정으로 바꾸기
            </button>
            <button className="btn btn-outline" onClick={reject}>
              기존 일정 유지
            </button>
          </div>
        </div>
      )}

      {itinerarySteps.length > 0 && (
        <div className="card">
          <h2>여행 일정</h2>
          {[
            ...new Set(
              itinerarySteps.map((step: any) => Number(step.dayIndex) || 1),
            ),
          ]
            .sort((a, b) => a - b)
            .map((day) => (
              <section className="itinerary-day-group" key={day}>
                {((rec.itinerary as any)?.savedAsFullJourney ||
                  new Set(
                    itinerarySteps.map(
                      (step: any) => Number(step.dayIndex) || 1,
                    ),
                  ).size > 1) && <h3>{VISITOR_FLOW_COPY.dayNumber[language].replace('{day}',String(day))}</h3>}
                {itinerarySteps
                  .filter((step: any) => (Number(step.dayIndex) || 1) === day)
                  .map((step: any, i: number) => (
                    <div
                      className="editable-itinerary-item"
                      id={`itinerary-${canonicalEntityId(step)}`}
                      key={step.itemId || step.programUri || step.entityId || i}
                    >
                      <RecommendationItineraryItem
                        step={step}
                        index={i}
                        execution
                      />
                      <ItineraryItemEditor step={step} index={itinerarySteps.indexOf(step)} total={itinerarySteps.length} regionId={region.id} onChanged={applyPartialEdit}/>
                    </div>
                  ))}
              </section>
            ))}
        </div>
      )}
      <ArchivedTrips />
      {savedPlaces.length > 0 && (
        <SavedPlacesSection places={savedPlaces} onRemove={removePlace} />
      )}

      {rec.risks && rec.risks.length > 0 && (
        <div className="card">
          <h2>안전 · 위험 안내</h2>
          <div className="tag-row">
            {rec.risks.map((r: string) => (
              <span className="badge risk" key={r}>
                ⚠️ {visitorLabel(r, "안전 주의사항")}
              </span>
            ))}
          </div>
        </div>
      )}

      {rec.evidence && rec.evidence.length > 0 && (
        <div className="card">
          <h2>이 추천을 만든 정보</h2>
          <p
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              marginBottom: 10,
            }}
          >
            추천에 사용한 장소와 조건의 연결 정보를 보여드려요.
          </p>
          {rec.evidence.map((e: any, i: number) => (
            <div className="evidence-item" key={i}>
              <b>{shortUri(e.subjectLabel || e.subject)}</b> —{" "}
              <i>{shortUri(e.predicateLabel || e.predicate)}</i> →{" "}
              <b>{shortUri(e.objectLabel || e.object)}</b>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn btn-primary btn-block"
        style={{ marginBottom: 10 }}
        onClick={() => navigate(regionLink("/nearby-discovery"))}
      >
        🧭 주변 즐길거리 찾기
      </button>

      <button
        className="btn btn-outline btn-block"
        onClick={() => navigate(regionLink("/concierge"))}
      >
        ← AI 여행도우미로 돌아가기
      </button>
    </div>
  );
}

function SavedPlacesSection({
  places,
  onRemove,
}: {
  places: any[];
  onRemove: (entityId: string) => void;
}) {
  return (
    <section className="card saved-places-section">
      <h2>담아둔 곳</h2>
      <p className="text-muted">
        모두 방문하지 않아도 괜찮아요. 원하는 곳에서 바로 출발할 수 있습니다.
      </p>
      {places.map((place, index) => {
        const entityId = canonicalEntityId(place)!;
        return (
          <article className="saved-place-card" key={entityId}>
            <RecommendationItineraryItem
              step={place}
              index={index}
              execution
              collection
            />
            <details className="saved-place-menu">
              <summary aria-label={`${recommendationItemLabel(place)} 더보기`}>
                ⋯
              </summary>
              <button
                type="button"
                className="btn btn-text"
                onClick={() => onRemove(entityId)}
              >
                담아둔 곳에서 빼기
              </button>
            </details>
          </article>
        );
      })}
    </section>
  );
}
