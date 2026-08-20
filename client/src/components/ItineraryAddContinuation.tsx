import { useNavigate } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { regionalPath } from "../regionRouting";
import { recommendationItemLabel } from "../recommendationItem";
import {
  verifiedNavigation,
  type ItineraryAddResult,
} from "../journeyExecution";
import { ensureTripSession } from "../tripSession";
import { track } from "../analytics";
const objectName = (name: string) =>
  `${name}${/[가-힣]/.test(name.at(-1) || "") && (name.charCodeAt(name.length - 1) - 0xac00) % 28 !== 0 ? "을" : "를"}`;
export default function ItineraryAddContinuation({
  entity,
  result,
  onStart,
  onReset,
}: {
  entity: any;
  result: ItineraryAddResult;
  onStart?: () => void;
  onReset?: () => void;
}) {
  const region = useRegion(),
    navigate = useNavigate(),
    name = recommendationItemLabel(entity),
    canStart = Boolean(verifiedNavigation(entity));
  if (result.status === "error")
    return (
      <div className="itinerary-add-error" role="alert">
        일정에 담지 못했습니다. 다시 시도해 주세요.
      </div>
    );
  const itinerary = () => {
    track("ITINERARY_VIEWED", ensureTripSession(region.id).id, {
      source: "entity-add",
    });
    navigate(regionalPath("/itinerary", region.id));
  };
  return (
    <section className="entity-add-continuation" aria-live="polite">
      <strong>
        ✓{" "}
        {result.status === "added"
            ? `${objectName(name)} 내 여행에 담아두었습니다.`
            : "이미 내 여행에 담겨 있습니다."}
      </strong>
      {result.status === "added" && canStart && onStart && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={onStart}
        >
          {name}으로 출발
        </button>
      )}
      <div className="entity-add-secondary">
        <button type="button" className="btn btn-outline" onClick={itinerary}>
          내 여행 보기
        </button>
        {canStart && onStart && result.status === "duplicate" && (
          <button type="button" className="btn btn-primary" onClick={onStart}>
            출발하기
          </button>
        )}
        {result.status === "added" && onReset && (
          <button type="button" className="btn btn-text" onClick={onReset}>
            다른 곳 더 찾기
          </button>
        )}
      </div>
    </section>
  );
}
