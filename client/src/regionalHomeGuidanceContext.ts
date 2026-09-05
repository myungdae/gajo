import type { RegionConfig, RegionalHomeEnglish, RegionalPlace } from "./regionConfig";
import type { RegionalLanguage } from "./RegionalLanguageContext";
import type { TripSession } from "./tripSession";

export function selectedRegionalHomePlace(region: RegionConfig, session?: TripSession): RegionalPlace | undefined {
  const selectedEntityIds = [
    session?.execution?.currentEntityId,
    ...(session?.plannedContext?.mustVisitPlaces || []).filter((place) => place.resolved).map((place) => place.entityId),
  ].filter((entityId): entityId is string => Boolean(entityId));
  return region.places.find((place) => selectedEntityIds.includes(place.id));
}

export function regionalHomeGuidancePlace(region: RegionConfig, session: TripSession | undefined, language: RegionalLanguage, english: RegionalHomeEnglish) {
  const place = selectedRegionalHomePlace(region, session);
  if (!place) return {
    label: language === "en" ? english.regionName : region.regionName,
    characteristic: language === "en"
      ? "Create a journey to see verified guidance for each next experience."
      : "여정을 만들면 다음 경험에 필요한 검증된 안내를 확인할 수 있습니다.",
    source: "Regional Home context",
  };
  const label = language === "en" ? english.placeNames?.[place.id] || place.label : place.label;
  return {
    label,
    characteristic: language === "en" ? `Verified local information is available for ${label}.` : place.description || "확인된 장소 정보를 바탕으로 안내합니다.",
    source: place.website || "지역 검증 데이터",
  };
}
