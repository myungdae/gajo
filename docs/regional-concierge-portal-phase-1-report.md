# Regional Concierge Portal — Phase 1

## 목적과 경계

Portal은 Regional Concierge를 발견하고 이해한 뒤 지역을 선택하는 로컬 우선 진입면이다. 실제 여행의 PLAN → NOW → RE-PLAN → ACTION은 기존 Local Concierge가 담당한다. Portal은 TripSession, 지역 분리, 추천·행동 로직, Copilot 또는 RDM을 소유하거나 복제하지 않는다.

## 정보 구조

1. 간결한 서비스 포지셔닝과 시작 CTA
2. 거창/가조, 합천, 옥천 지역 선택
3. TMAP·ChatGPT에 대한 실제 이의 제기와 승인된 답변
4. 자연어 사용 예시와 시스템 연결 흐름
5. Hyper-local Knowledge 범위와 데이터 자격 고지
6. 데이터 거버넌스와 공공안전 활용
7. 여행객, 지역 업체, 공공기관, 지역 운영자의 네 진입점
8. 승인된 Guide Knowledge 기반 FAQ

## 지역 라우팅

`portal.html`은 발견 전용이며 카드 CTA는 각각 `/gajo`, `/hapcheon`, `/okcheon`으로 연결한다. 별도 컨시어지 구현은 만들지 않았다. 지역 카드는 가벼운 발견 브리지이며 관광 홈페이지를 중복 구성하지 않는다.

## Guide Knowledge 재사용

Portal의 이의 제기 카드와 FAQ 아코디언은 기존 읽기 전용 `POST /api/guide/questions`를 사용한다. 질문을 열 때 현재 `GUIDE_KNOWLEDGE`의 승인된 답변을 불러오므로 장문의 설명을 Portal에 복제하지 않는다. 서버를 사용할 수 없는 경우 사용자가 재시도할 수 있는 중립 오류만 표시한다.

## SEO 준비

독립 title, description, Open Graph와 X metadata 필드를 `portal.html`에 둔다. 생산 도메인이 결정되지 않았으므로 canonical과 `og:image`는 의도적으로 만들지 않았다. 향후 `/portal`, `/portal/geochang`, `/portal/hapcheon`, `/portal/okcheon` 같은 발견 경로가 필요할 때 동일한 지역 메타데이터 모델을 확장하되 운영 Concierge는 기존 경로를 유지한다.

## 대상별 진입점

여행객, 지역 업체, 지자체·관광기관, Regional Manager/지역 운영자 카드가 있다. Phase 1에서는 분석 가능한 정보성 버튼만 제공하며 가입, 결제, 업체 포털, 온보딩은 없다.

## 모바일 디자인

모바일 우선 단일 열 전환, 44px 이상의 주요 조작 영역, 가로 overflow 차단, 펼침 상태를 알리는 FAQ 버튼, 콘텐츠를 가리지 않는 CTA를 적용했다. 360px, 390px, 430px 및 데스크톱 대응 규칙을 둔다. 과도한 애니메이션이나 이미지 의존성 없이 타이포그래피와 카드 계층으로 편집형 인상을 만든다.

## 분석 이벤트

외부 분석 업체 없이 `regional-portal-analytics` 브라우저 이벤트로 다음 이름을 준비했다: `portal_region_selected`, `portal_concierge_started`, `portal_faq_opened`, `portal_audience_selected`, `portal_tmap_objection_opened`, `portal_chatgpt_objection_opened`.

## 향후 단계

- 생산 도메인 확정 후 canonical, 절대 Open Graph 이미지와 sitemap 연결
- 지역별 독립 검색 수요가 확인되면 얇은 지역 발견 랜딩 추가
- 네 대상별 문의/참여 흐름을 승인된 운영 정책에 맞춰 설계
- Portal 행동 이벤트를 선택한 분석 수집기로 연결
- 지역별 데이터 커버리지와 검증 상태를 읽기 전용으로 표시
