import { useNavigate } from "react-router-dom";
import { useRegion } from "../RegionContext";
import { localizedRegionalPath as regionalPath } from '../visitorRouting';
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
        {result.errorReason === "INVALID_ACCOMMODATION_ID" ? "이 숙소의 정보를 확인할 수 없어 저장하지 못했습니다. 다른 숙소를 선택해 주세요." : result.errorReason === "SESSION_OR_STORAGE_FAILURE" ? "숙소를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." : "내 여행에 담지 못했습니다. 다시 시도해 주세요."}
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
        {result.status === "saved"
            ? `${objectName(name)} 내 여행 숙소로 저장했습니다.`
            : result.status === "unchanged"
              ? "이미 내 여행에 저장된 숙소입니다."
              : result.status === "added"
            ? `${objectName(name)} 내 여행에 담았습니다.`
            : "이미 내 여행에 담겨 있습니다."}
      </strong>
      {(result.status === "added" || result.status === "saved") && canStart && onStart && (
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
          내 여행 전체 보기
        </button>
        {canStart && onStart && (result.status === "duplicate" || result.status === "unchanged") && (
          <button type="button" className="btn btn-primary" onClick={onStart}>
            출발하기
          </button>
        )}
        {(result.status === "added" || result.status === "saved") && onReset && (
          <button type="button" className="btn btn-text" onClick={onReset}>
            계속 장소 찾기
          </button>
        )}
      </div>
    </section>
  );
}
