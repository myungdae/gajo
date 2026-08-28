# EXKO 지역지식 연결 사전검사

## 확인한 현재 구조

- 공개 웹은 `https://exko.kr/`의 SPA이며 viewport 메타와 `/resource/:resource` 라우트를 가진다.
- 공개 검색 API `/api/sitemap?keyword=합천` 응답에서 `http://sight.eventpool.kr/resource/합천군` 등 stable resource URI가 확인됐다.
- 현재 프런트엔드는 URI의 마지막 resource 이름을 `/resource/{resource}`로 연결한다. 따라서 `합천군` 지역 후보의 구조상 URL은 `https://exko.kr/resource/%ED%95%A9%EC%B2%9C%EA%B5%B0`이다.
- 장소 Entity도 같은 형태로 연결할 수 있는 구현은 존재하지만, EXKOVIA Entity와 EXKO resource URI 사이의 검증된 1:1 매핑이 없는 장소에는 URL을 추정해서는 안 된다.

## 이번 구현 판단

합천군·거창군·옥천군 resource deep link는 실제 모바일 브라우저의 시군구 상세 화면으로 검증한 allowlist 값으로 확정됐다. EXKOVIA는 합천 홈과 주변 찾기 결과 아래에서 낮은 우선순위의 외부 링크를 제공하며, 아직 AI 여행안내가 준비 중인 거창군·옥천군은 Portal 카드에서 EXKO 지역지식 링크만 독립적으로 제공한다. GPS 좌표, TripSession ID, 검색어 같은 방문자 문맥은 URL에 전달하지 않는다. 가조를 거창군으로 치환하지 않으며 다른 지역은 stable resource URI가 별도로 검증되기 전까지 노출하지 않는다.

## 단계별 연결안

1. 단순 외부 링크: EXKO 운영자가 보장하는 regionId → stable resource URI allowlist를 받은 뒤, 낮은 시각적 우선순위의 `이 지역을 더 깊이 알아보기` 링크를 새 탭으로 연다. `target="_blank"`와 `rel="noopener noreferrer"`를 사용하고 위치·세션 query는 붙이지 않는다. CORS는 필요 없다.
2. 데이터 연동: 장소별 Entity URI 매핑, 응답 출처·갱신일·오류 계약을 합의한 뒤 서버 대 서버 adapter 또는 명시적 CORS allowlist로 연동한다. 브라우저에서 공개 API를 임의 호출하거나 기존 Entity를 복제하지 않는다.

배포 전에는 합천군과 대표 장소 URL의 200 응답, 모바일 360px 화면, canonical resource 유지, 외부 분석·쿠키 안내를 별도로 확인한다.
