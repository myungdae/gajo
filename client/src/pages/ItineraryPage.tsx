import { useEffect, useState } from "react";
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
import { regionalPath } from "../regionRouting";
import { SHARED_VISITOR_COPY } from "../visitorCopy";
import {
  liveRuntimeForRegion,
  runtimeContextForRegion,
} from "../liveRuntimeGuard";
import { regionalRuntimeView } from "../regionalRuntime";
import {
  currentAndNext,
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

export default function ItineraryPage() {
  const region = useRegion();
  const [, setRevision] = useState(0);
  const tripSession = ensureTripSession(region.id);
  const regionLink = (path: string) => regionalPath(path, region.id);
  const location = useLocation() as {
    state?: { result?: ConciergeChatResponse };
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
      location.state?.result ||
      (hasFullJourney
        ? ({
            context: tripSession.runtimeContext,
            recommendation: {
              itinerary: tripSession.itinerary,
              reasonSummary: "저장한 여행 일정을 순서대로 보여드려요.",
            },
          } as ConciergeChatResponse)
        : undefined),
  );
  const [proposal, setProposal] = useState<ReplanningProposal | null>(null);
  const [runtimeMessage, setRuntimeMessage] = useState("");
  const [observing, setObserving] = useState(false);
  const [knownRuntimeContext, setKnownRuntimeContext] = useState<any>(
    () =>
      runtimeContextForRegion(location.state?.result?.context, region.id) ||
      runtimeContextForRegion(tripSession.runtimeContext, region.id),
  );
  useEffect(() => {
    track("ITINERARY_VIEWED", tripSession.id, {
      source: location.state?.result ? "recommendation" : "saved-itinerary",
    });
    track("MY_TRIP_OPENED", tripSession.id, {
      hasFullJourney,
      savedPlaceCount: savedPlaces.length,
    });
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
      </div>
    );

  if (!result || !result.recommendation) {
    return (
      <div><TripManagement onSavedPlacesCleared={setSavedPlaces} /><div className="card">
        <h2>표시할 일정이 없습니다</h2>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          AI 컨시어지와 대화하여 맞춤 일정을 먼저 생성해주세요.
        </p>
        <button
          className="btn btn-primary btn-block"
          onClick={() => navigate(regionLink("/concierge"))}
        >
          AI 컨시어지로 이동
        </button>
      </div></div>
    );
  }

  const rec = result.recommendation;
  const itinerarySteps: any[] = rec.itinerary?.steps || rec.steps || [];
  const journey = currentAndNext(
    itinerarySteps,
    tripSession.execution?.currentEntityId,
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
        `런타임 관측 실패: ${error?.message || "알 수 없는 오류"}`,
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
        <h2>추천 근거 요약</h2>
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
          <small>현재 일정:</small>
          <h2>{recommendationItemLabel(journey.current)}</h2>
          {verifiedNavigation(journey.current) && (
            <p>
              장소를 열어 ‘출발하기’를 누르면 사용할 내비를 선택할 수 있습니다.
            </p>
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
            일정 변경
          </button>
        </section>
      )}

      <div className="card">
        <h2>런타임 상황 확인</h2>
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
        <div className="demo-runtime-control">
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
        </div>
      </div>

      {proposal && (
        <div className="card replanning-card">
          <h2>상황이 바뀌었습니다</h2>
          <div className="replanning-section">
            <b>무엇이 바뀌었나요?</b>
            <p>강한 비가 시작되었습니다.</p>
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
              변경하기
            </button>
            <button className="btn btn-outline" onClick={reject}>
              기존 일정 유지
            </button>
          </div>
        </div>
      )}

      {itinerarySteps.length > 0 && (
        <div className="card">
          <h2>일정 단계</h2>
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
                  ).size > 1) && <h3>{day}일차</h3>}
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
          <h2>설명 가능한 근거 (Evidence Chain)</h2>
          <p
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              marginBottom: 10,
            }}
          >
            아래는 온톨로지 그래프에서 실제로 추적된 RDF 트리플입니다. 이
            서비스의 모든 추천은 프롬프트 규칙이 아닌 그래프 순회(graph
            traversal)를 통해 도출됩니다.
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
        ← AI 컨시어지로 돌아가기
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
                내 여행에서 빼기
              </button>
            </details>
          </article>
        );
      })}
    </section>
  );
}
