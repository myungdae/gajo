# 지역 운영자 읽기 전용 성과 리포트

이 리포트의 원칙은 사람을 추적하지 않고 지역 관광의 연결 성과를 집계하는 것이다. 기존 [개인정보·위치정보·관광 흐름 감사](./privacy-location-tourism-flow-audit.md)의 미해결 위험을 해소하기 위한 별도 외부 열람 경계이며, 코드만으로 법률 준수를 단정하지 않는다.

## 권한과 운영 설정

`GET /api/regional-report?period=today|7d|30d`만 제공한다. `x-regional-report-token` header를 사용하며 URL, analytics, 응답 또는 오류에 token을 넣지 않는다. `REGIONAL_REPORT_CREDENTIALS_JSON`은 `[ { "regionId": "hapcheon", "token": "<independently generated secret>" } ]` 형태다. 서버가 token→regionId를 결정하며 설정 누락·JSON 오류·짧은 token은 fail closed다. 실제 secret은 저장소에 기록하지 않는다. Client는 `sessionStorage`에만 보관한다.

Regional Manager는 자신의 지역 고정 기간 집계만 읽는다. Platform Admin의 `x-admin-token`/`ADMIN_WRITE_TOKEN`과 기존 승인·수정·삭제·전체 analytics summary는 별도다. 어느 token도 다른 경계에서 유효하지 않다.

## Metric dictionary

| 지표 | event mapping | 단위/해석 |
|---|---|---|
| 익명 이용 세션 | 기간 내 PilotEvent의 distinct `sessionId` | 익명 세션 수. 사람 수가 아님 |
| AI 여행안내 시작 | `SESSION_STARTED`, `SESSION_RESUMED`, `PLAN_SESSION_STARTED`, `NOW_SESSION_STARTED` | 시작 이벤트 횟수 |
| 추천 노출 | `RECOMMENDATION_SHOWN` | 노출 횟수 |
| 상세조회 | `PLACE_DETAIL_OPENED`, `ENTITY_DETAIL_OPENED` | 조회 횟수 |
| 이동 의도 | `MAP_OPENED`, `NAVIGATION_HANDOFF`, `JOURNEY_START_ACTION`, `PHONE_HANDOFF`, `BOOKING_HANDOFF`, `WEBSITE_HANDOFF` | 연결/클릭 횟수. 방문이 아님 |
| Quick Intent | `QUICK_INTENT_SELECTED` | 선택 횟수 |
| 검색 실패 | `SEARCH_FALLBACK_USED`, `RETRY_ERROR` | 검색 대체 안내/재시도 오류 횟수 |
| 유입 경로 | `ENTRY_SOURCE.metadata.source` | 이벤트 횟수, 소표본 억제 |
| 현장 QR 확인 | 공개 운영 partner의 `QR_VISIT_CONFIRMED` | 정적 QR 확인 건수. GPS 도착 증명이 아님 |
| 실제 이용 | `BENEFIT_USE_CONFIRMED` | 직원 확인된 혜택 이용 건수 |

관심 단계는 추천 노출+상세조회, 이동 의도는 위 handoff 합계다. 현장 QR과 실제 이용은 앞 단계에서 추정하지 않는다. 공개 운영 partner가 없으면 `0`이 아니라 `측정 준비 중`이다. 이벤트 count와 unique session은 분리한다.

## QR·파트너 감사 결과

`/go/:slug`는 public partner projection을 먼저 읽은 뒤 `POST /api/partners/public/:slug/entries`로 `PARTNER_QR_ENTRY`를 남기는 여행 시작용 유입 QR route다. `/visit/:slug`는 `POST /api/partners/public/:slug/visits`로 `QR_VISIT_CONFIRMED`를 남기는 현장 QR route다. 단순 서버 GET, JavaScript를 실행하지 않는 bot·link preview는 count되지 않지만, 전체 Client를 실행하는 preview나 공유된 QR 접근은 포함될 수 있다. 새로고침은 같은 익명 TripSession+partner dedupe key로 중복 제거되지만 사람·기기 기준 unique visit는 아니다.

둘 다 partner slug 외 개인·세션 query를 사용하지 않고 body의 익명 TripSession으로 중복을 막는다. 서버의 `operating()` 공개 projection 때문에 DRAFT는 차단된다. 안정 `canonicalEntityId`, 동일 region, `OPERATING`+`ACTIVE`+`VERIFIED` partner만 업소별 집계 후보가 된다. QR 복사·공유는 현장 밖 스캔도 만들 수 있으므로 현장 QR은 실제 도착, 실제 방문자 또는 실제 이용의 절대 증명이 아니다. `BENEFIT_USE_CONFIRMED`는 공개 analytics allowlist가 아니라 승인된 PUBLIC benefit, 선행 현장 QR, 만료 전 redemption, 유효한 partner management key, 확인 시점의 `OPERATING`+`ACTIVE`+`VERIFIED` 상태를 거쳐 partner가 확인한 경우에만 생성된다. redemption 상태 조건과 idempotency/dedupe index가 재전송을 막는다. 이번 변경은 partner 상태 변경, QR 발급, 쿠폰 생성, check-in 생성 또는 추천 순위 변경을 하지 않는다.

## 최소 표본과 응답 경계

`REGIONAL_REPORT_MIN_CELL_SIZE` 기본값은 5(최저 허용 2)다. 지역 top-line은 그대로 표시하지만 유입처와 업소별 cell은 서버에서 억제해 client에 원시 count를 보내지 않는다. 미만은 `5건 미만`, 지원되지 않는 연결은 `측정 준비 중`, 실제 0은 `0`으로 구분한다. 고정 today/7d/30d와 Asia/Seoul 자정 경계만 허용한다. 기본값 5는 초기 보호 기본값이지 법률 준수 보증이 아니다.

응답은 region, period 경계, generatedAt, privacy 정책, summary, funnel, categories, features, entrySources, errors, 공개 partner 집계만 포함한다. 개별 이벤트, TripSession/anonymousTripId/journey/turn/QR 원문, 좌표·경로, 이름·전화번호, 질문·검색어, 개별 timestamp, IP/User-Agent/기기 식별자는 반환하지 않는다.

상위 지역 합계와 억제된 세부 합계를 함께 제공하면 다른 기간 또는 알려진 외부 수치와의 비교로 작은 집단을 추론할 가능성을 완전히 제거할 수 없다. 고정 기간과 cell suppression은 우회를 어렵게 하는 초기 방어이며, 공개 전 dimension 수·기간 조합·보유 정책을 별도 검토한다. `/regional-report` 응답에는 `X-Robots-Tag: noindex, nofollow`를 설정하고 일반 관광객 메뉴에는 연결하지 않는다.

정식 쿠폰·체크인·회원계정 또는 위치정보를 결합하기 전 처리 목적·법적 근거·고지·동의·보유·파기·정보주체 권리·외부 제공에 대한 별도 법률 및 개인정보 검토가 필요하다.
