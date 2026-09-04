const FEATURE_LABELS: Readonly<Record<string, string>> = {
  quickIntent: "빠른 여행 목적 선택",
  freeLanguage: "자유 문장 요청",
  intentRouted: "여행 의도 분류 완료",
  recommendation: "AI 추천 표시",
  map: "지도 열기",
  navigation: "길찾기 연결",
  phone: "전화 연결",
  booking: "예약 연결",
  website: "홈페이지 연결",
};

const ENTRY_SOURCE_LABELS: Readonly<Record<string, string>> = {
  direct: "직접 접속",
  appinstalled: "앱 설치 후 시작",
  standalone: "설치된 앱에서 시작",
  recommendation: "추천 화면에서 시작",
  "planning-entry": "여행 계획에서 시작",
  "trip-management": "내 여행에서 시작",
  local: "지역 서비스에서 시작",
  server: "서버 연결에서 시작",
  "saved-itinerary": "저장한 일정에서 시작",
  "demo-weather-change": "날씨 변경 시연에서 시작",
  "live-runtime": "현장 정보에서 시작",
  "itinerary-summary": "일정 요약에서 시작",
  restaurant: "음식점 유입 QR",
  pension: "숙소 유입 QR",
  parking: "주차장 유입 QR",
  festival: "축제 유입 QR",
  attraction: "관광지 유입 QR",
};

export const featureLabel = (key: string) => FEATURE_LABELS[key] || "기타 기능";
export const entrySourceLabel = (key: string) =>
  ENTRY_SOURCE_LABELS[key] || "기타 유입";
