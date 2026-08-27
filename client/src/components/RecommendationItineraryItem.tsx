import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import EntityActions from "./EntityActions";
import { useRegion } from "../RegionContext";
import { regionalPath } from "../regionRouting";
import {
  canonicalEntityId,
  isInteractiveRecommendationItem,
  itemBelongsToRegion,
  recommendationItemLabel,
} from "../recommendationItem";
import { ensureTripSession, saveTripSession } from "../tripSession";
import { track } from "../analytics";
import { executionState, verifiedNavigation, visitorExecutionLabel } from "../journeyExecution";
import type { NearbyCategory } from "../api/client";
export default function RecommendationItineraryItem({
  step,
  index,
  execution = false,
  collection = false,
}: {
  step: any;
  index: number;
  execution?: boolean;
  collection?: boolean;
}) {
  const region = useRegion(),
    session = ensureTripSession(region.id),
    navigate = useNavigate(),
    [open, setOpen] = useState(execution);
  const entityId = canonicalEntityId(step),
    interactive =
      isInteractiveRecommendationItem(step) &&
      itemBelongsToRegion(step, region.id),
    name = recommendationItemLabel(step),
    canonicalName=step.canonicalLabel||step.programLabel||step.facilityLabel,
    shoppingCategory = ({
      CONVENIENCE_STORE: "편의점",
      MART: "마트",
      SUPERMARKET: "슈퍼마켓",
      MART_SUPERMARKET: "마트·슈퍼마켓",
      PARKING: "주차장",
      PUBLIC_TOILET: "공중화장실",
      HEAT_SHELTER: "무더위쉼터",
      GAS_STATION: "주유소",
      EV_CHARGER: "전기차 충전소",
      TOURIST_INFORMATION: "관광안내소",
      GROCERY: "식료품점",
      GROCERY_STORE: "식료품점",
    } as Record<string, string>)[step.category] || ({
      CONVENIENCE_STORE: "편의점",
      MART: "마트",
      SUPERMARKET: "슈퍼마켓",
      GROCERY_STORE: "식료품점",
    } as Record<string, string>)[step.entityType],
    destination = verifiedNavigation(step),
    [executionStatus, setExecutionStatus] = useState(() => entityId ? session.execution?.statusByEntityId?.[entityId] || step.status || "PLANNED" : step.status || "PLANNED");
  const toggle = () => {
    if (!interactive) return;
    setOpen((value) => {
      if (!value)
        track("ENTITY_DETAIL_OPENED", session.id, {
          entityId: entityId!,
          entityType: step.entityType || "UNKNOWN",
          actionType: "DETAIL",
        });
      return !value;
    });
  };
  const nearby = (category: NearbyCategory) => {
    if (!destination || !entityId) return;
    track("NEARBY_FROM_ITINERARY", session.id, { entityId, category });
    navigate(regionalPath("/nearby-discovery", region.id), {
      state: {
        category,
        anchor: {
          entityId,
          label: name,
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
      },
    });
  };
  const started = (provider: string) => {
    if (!entityId) return;
    saveTripSession(
      executionState(ensureTripSession(region.id), entityId, "EN_ROUTE"),
    );
    track("JOURNEY_START_ACTION", session.id, {
      entityId,
      provider,
      source: "itinerary",
    });
  };
  const replan = () => {
    track("REPLAN_FROM_ITINERARY", session.id, { entityId });
    navigate(regionalPath("/concierge?mode=now", region.id), {
      state: { freeTextOpen: true, tripMode: "NOW" },
    });
  };
  const recordExecution = (status: "COMPLETED" | "SKIPPED") => {
    if (!entityId || collection) return;
    const updated = saveTripSession(executionState(ensureTripSession(region.id), entityId, status));
    setExecutionStatus(updated.execution?.statusByEntityId?.[entityId] || status);
  };
  return (
    <div className={`itinerary-step${interactive ? " interactive" : ""}`}>
      {!collection && (
        <div className="step-index">{step.order ?? index + 1}</div>
      )}
      <div className="step-body">
        {interactive ? (
          <button
            type="button"
            className="recommendation-row-trigger"
            aria-expanded={open}
            onClick={toggle}
          >
            <span>{name}</span>
            <span aria-hidden="true">{open ? "⌃" : "›"}</span>
          </button>
        ) : (
          <h3>{name}</h3>
        )}
        {shoppingCategory && <small>{shoppingCategory}</small>}
        {execution && !collection && <span className={`execution-status status-${String(executionStatus).toLowerCase()}`}>{visitorExecutionLabel(executionStatus)}</span>}
        {step.durationMinutes && <p>소요 시간: 약 {step.durationMinutes}분</p>}
        {open && (
          <section
            className="recommendation-inline-detail"
            aria-label={`${name} 상세 정보`}
          >
            <small>{step.areaLabel || step.entityType || "지역 장소"}</small>
            <h3>{name}</h3>
            {canonicalName&&canonicalName!==name&&<p className="text-muted">등록명: {canonicalName}</p>}
            {step.accessStatus==='NEEDS_VERIFICATION'&&<p className="text-muted">운영 정보 확인이 필요한 요청 장소입니다.</p>}
            {step.description && <p>{step.description}</p>}
            <dl>
              {step.address && (
                <>
                  <dt>주소</dt>
                  <dd>{step.address}</dd>
                </>
              )}
              {step.telephone && (
                <>
                  <dt>전화</dt>
                  <dd>{step.telephone}</dd>
                </>
              )}
              {step.website && (
                <>
                  <dt>공식 홈페이지</dt>
                  <dd>{step.website}</dd>
                </>
              )}
            </dl>
            <EntityActions
              entity={step}
              hideDetail
              navigationLabel={execution ? "출발하기" : undefined}
              onNavigate={execution ? started : undefined}
              showItineraryAdd={!execution && step.operationalEvidence?.tripEligible !== false}
            />
            {step.actions?.navigate && (
              <Link
                className="btn btn-text"
                to={regionalPath(
                  `/map?entityUri=${encodeURIComponent(entityId!)}`,
                  region.id,
                )}
              >
                지도에서 보기
              </Link>
            )}
            {execution && (
              <div className="itinerary-context-actions">
                {!collection && !["COMPLETED", "SKIPPED"].includes(executionStatus) && (
                  <div className="visit-state-actions">
                    <button className="btn btn-primary" onClick={() => recordExecution("COMPLETED")}>방문 완료</button>
                    <button className="btn btn-outline" onClick={() => recordExecution("SKIPPED")}>건너뛰기</button>
                  </div>
                )}
                {destination && (
                  <details>
                    <summary>주변 찾기</summary>
                    <div>
                      <button onClick={() => nearby("FOOD")}>주변 맛집</button>
                      <button onClick={() => nearby("CAFE")}>주변 카페</button>
                      <button onClick={() => nearby("TOURISM_NATURE")}>
                        주변 관광지
                      </button>
                    </div>
                  </details>
                )}
                {!collection && (
                  <button className="btn btn-text" onClick={replan}>
                    일정 변경
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
