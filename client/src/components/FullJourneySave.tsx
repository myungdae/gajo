import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { track } from "../analytics";
import { regionalPath } from "../regionRouting";
import { saveFullJourney, type FullJourneySaveResult } from "../fullJourney";
export default function FullJourneySave({
  itinerary,
  durationLabel,
}: {
  itinerary: any;
  durationLabel?: string;
}) {
  const region = useRegion(),
    navigate = useNavigate(),
    [result, setResult] = useState<FullJourneySaveResult>();
  if (
    !itinerary ||
    !Array.isArray(itinerary.steps) ||
    itinerary.steps.length < 2
  )
    return null;
  const save = (update = false) => {
    const outcome = saveFullJourney(region.id, itinerary, localStorage, update);
    setResult(outcome);
    if (outcome.status === "saved" && outcome.session)
      track(
        update ? "FULL_ITINERARY_UPDATED" : "FULL_ITINERARY_SAVED",
        outcome.session.id,
        {
          journeyId:
            itinerary.itineraryNo || itinerary.journeyId || "generated",
          itemCount: outcome.itemCount,
          dayCount: outcome.dayCounts.length,
        },
      );
  };
  if (!result)
    return (
      <section className="card full-journey-save">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => save()}
        >
          이 일정 전체 저장
        </button>
      </section>
    );
  if (result.status === "different")
    return (
      <section className="card full-journey-save" aria-live="polite">
        <strong>기존 내 여행과 다른 일정입니다.</strong>
        <p>현재 저장된 여행을 바꿀까요?</p>
        <div className="grid-2">
          <button className="btn btn-primary" onClick={() => save(true)}>
            현재 일정으로 업데이트
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setResult(undefined)}
          >
            기존 일정 유지
          </button>
        </div>
      </section>
    );
  if (result.status === "error")
    return (
      <section className="card" role="alert">
        일정 전체를 저장하지 못했습니다. 다시 시도해 주세요.
      </section>
    );
  const counts = result.dayCounts
    .map((count, index) => `${index + 1}일차 ${count}곳`)
    .join(" · ");
  return (
    <section className="card full-journey-save" aria-live="polite">
      <strong>
        {result.status === "identical"
          ? "이미 저장된 일정입니다."
          : `✓ ${durationLabel ? `${durationLabel} ` : ""}${region.regionName} 여행 일정을 저장했습니다.`}
      </strong>
      <p>{counts}</p>
      <div className="entity-actions">
        <button
          className="btn btn-primary"
          onClick={() => navigate(regionalPath("/itinerary", region.id))}
        >
          내 여행 보기
        </button>
        <button
          className="btn btn-outline"
          onClick={() => navigate(regionalPath("/itinerary", region.id))}
        >
          첫 장소로 출발
        </button>
        <button
          className="btn btn-text"
          onClick={() =>
            navigate(regionalPath("/concierge?mode=now", region.id), {
              state: { freeTextOpen: true, tripMode: "NOW" },
            })
          }
        >
          일정 수정
        </button>
      </div>
    </section>
  );
}
