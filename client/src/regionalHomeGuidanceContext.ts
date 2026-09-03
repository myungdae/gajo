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
      ? "No destination is selected yet. Choose a destination to see location-specific guidance."
      : "현재 선택된 목적지가 없습니다. 장소를 선택하면 목적지별 안내를 확인할 수 있습니다.",
    source: "Regional Home context",
  };
  const label = language === "en" ? english.placeNames?.[place.id] || place.label : place.label;
  return {
    label,
    characteristic: language === "en" ? `Verified local information is available for ${label}.` : place.description || `${label}의 현장 조건은 장소마다 다를 수 있습니다.`,
    source: place.website || "지역 검증 데이터",
  };
}
