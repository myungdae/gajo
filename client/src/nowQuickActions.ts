export const NOW_QUICK_ACTIONS = [
  { id: "food", label: "식당 찾기", kind: "NEARBY", category: "FOOD" },
  { id: "cafe", label: "카페 찾기", kind: "NEARBY", category: "CAFE" },
  { id: "attraction", label: "관광지 찾기", kind: "NEARBY", category: "TOURIST_ATTRACTION" },
  { id: "lodging", label: "숙소 찾기", kind: "NEARBY", category: "LODGING" },
  { id: "next", label: "다음 일정 추천", kind: "ASK", prompt: "현재 위치와 여행 상황에 맞는 다음 일정을 추천해 주세요" },
  { id: "change", label: "일정 바꾸기", kind: "ITINERARY" },
] as const;

export const NOW_HEADING = "무엇을 도와드릴까요?";
export const NOW_HEADING_LINES = ["무엇을", "도와드릴까요?"] as const;
