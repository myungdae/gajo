# 참여업체 QR·혜택·특별 이벤트 및 NOW UX 개선 Phase 1

## 조사 결과와 재사용 설계

- React/Vite 방문객 앱, NestJS/Mongoose API, MongoDB 영속 볼륨 구조를 유지한다.
- 익명 TripSession은 지역별 브라우저 저장 키와 서버 동기화 구조를 그대로 사용한다. 파트너 QR은 활성 합천 세션에 최소 진입 Context만 추가한다.
- 파트너는 기존 Regional Data Manager의 `canonicalEntityId`에 연결한다. 스마일펜션은 기존 검증 엔티티 `https://hapcheon.example/ontology#hapcheonLakeSmilePension`에 연결된 `DRAFT`만 생성한다.
- 기존 관리자 쓰기 토큰을 승인 API에 재사용한다. 파트너 셀프 관리는 신청 시 한 번만 표시되는 임의 키의 SHA-256 해시로 보호한다.
- 추천 파이프라인은 변경하지 않는다. 혜택·할인·참여비는 추천 후보나 점수 입력에 포함되지 않는다.

## 공개 및 증거 경계

- 파트너 공개에는 `OPERATING + ACTIVE QR + VERIFIED`가 모두 필요하다.
- 혜택 공개에는 `PUBLIC + APPROVED + 미소진 + Asia/Seoul 적용시간`이 모두 필요하다.
- `/go/:partnerSlug`와 `/visit/:partnerSlug`는 현재 Origin의 상대경로만 사용한다.
- 현장 QR은 `QR 방문확인` 및 `verificationMethod=QR_SCAN`으로만 저장하며 GPS 방문으로 표현하지 않는다.
- 모든 파트너·혜택·활동·사용 요청은 `regionId`와 익명 TripSession ID로 격리한다.

## 운영 전 필요한 실제 확인

`/go/smile` 공개 전 관리자가 스마일펜션의 실제 참여 의사, 공개 필드, 관리 담당자, 혜택 내용(선택), QR 부착 위치를 확인하고 생명주기를 승인 → AI 등록 → QR 발급 → 운영 중 순으로 전환해야 한다. 운영 할인율·금액·혜택은 fixture로 만들지 않았다.

## API 권한 경계

| 분류 | Endpoint | 호출 주체와 보호 | 스코프·응답 경계 |
|---|---|---|---|
| 공개 관광객 | `POST /api/partners/applications` | 누구나 신청 가능. 필드 길이·URL·동의 검증. 별도 rate limit은 Phase 2 필요 | 신청자가 안정 Entity나 예약 slug를 지정할 수 없고 후보 ID만 생성. 관리 키는 최초 응답에 한 번만 표시 |
| 공개 관광객 | `GET /api/partners/public/:slug` | 인증 없음 | `OPERATING + ACTIVE QR + VERIFIED`만 공개 projection으로 반환. 검토 메모·키 해시 비공개 |
| 공개 관광객 | `POST /api/partners/public/:slug/entries` | 유효한 익명 TripSession ID | slug의 region과 요청 region 일치 검증. 업체·세션당 중복 집계 방지 |
| 공개 관광객 | `POST /api/partners/public/:slug/visits` | 유효한 익명 TripSession ID | 운영 파트너만 가능. `QR_SCAN` 근거만 기록하며 GPS·결제 증거가 아님 |
| 공개 관광객 | `POST /api/partners/benefits/:id/redemptions` | QR 방문확인 + UUID idempotency key | benefit region 일치, 공개·승인·시간·수량 조건 검증. 관광객은 항상 `REQUESTED`만 생성 |
| 공개 텔레메트리 | `POST /api/partners/recommendations` | 방문객 앱 | 운영 파트너의 canonical Entity만 수집. 업체·세션 단위 dedupe. 공개 호출이므로 매출 증거로 사용 금지 |
| 업주 | `POST /api/partners/:slug/benefits` | `x-partner-key` SHA-256 비교 | 인증된 자기 업체에 DRAFT만 생성. 공개·승인은 불가 |
| 업주 | `PATCH /api/partners/:slug/redemptions/:id` | `x-partner-key` | redemption의 partnerId가 자기 업체인지 서버에서 확인. 15분 내 `CONFIRM/DECLINE`만 허용 |
| 업주 | `GET /api/partners/:slug/metrics` | `x-partner-key` | 자기 업체의 익명 count만 반환. TripSession ID·위치·동행자·매출 미반환 |
| 업주 | `GET /api/partners/:slug/qr` | `x-partner-key` | 테스트 QR은 현재 Origin 설정으로 생성. 인쇄 QR은 운영 상태와 `exkovia.com` base URL을 모두 요구 |
| 관리자 | `/api/admin/partners/**` | 기존 `ADMIN_WRITE_TOKEN` guard | 생명주기 순서, 혜택 승인, 관리 키 발급. 토큰은 플랫폼 단일 권한이므로 세분화는 Phase 2 과제 |

## MongoDB 정합성과 신뢰 한계

- `partnerId`, `partnerSlug`, `benefitId`, `redemptionId`, `idempotencyKey`, 일별 counter ID는 unique index다.
- `(regionId, canonicalEntityId)`와 `(benefitId, anonymousTripId)`도 unique다. Phase 1은 TripSession당 1회 사용만 허용한다.
- QR 진입·방문·추천 이벤트는 deterministic `dedupeKey`의 sparse unique index로 재전송 중복을 막는다.
- 전체 수량은 Benefit의 `reservedCount` 조건부 원자 증가, 일별 수량은 `benefitId:서울날짜` 원자 counter로 예약한다. 실패하면 획득한 counter를 보상 감소한다.
- redemption은 15분 만료이며 새 요청 또는 업주 확인 때 만료 요청을 회수한다. 완전한 트랜잭션·상시 만료 worker·replica-set transaction은 Phase 2 과제다.
- 정적 현장 QR은 공유될 수 있으므로 위치나 결제를 입증하지 않는다. 현재 관리 키는 강한 임의값이지만 정식 업주 계정·MFA·회수 UI·rate limiting은 아직 없다.
- 삭제 API는 없고 상태 전환과 감사 이벤트를 사용한다. 새 필드는 기존 문서를 파괴하거나 DB 초기화를 요구하지 않는다.

## QR 도메인 독립성

- hostname은 DB에 저장하지 않는다. 생성 시 `PUBLIC_BASE_URL`을 읽어 `/go/:slug`, `/visit/:slug`를 결합한다.
- SVG·PNG는 표준 QR encoder와 오류정정 M으로 생성한다.
- 테스트 QR은 `X-QR-Mode: TEST`이며 운영 인쇄에 사용할 수 없다.
- 인쇄 QR은 파트너가 운영 중이고 public base hostname이 `exkovia.com` 또는 그 하위 도메인일 때만 생성한다.

## Phase 2 필수 보완

- 업주 계정 로그인, MFA, 관리 키 회전·폐기·복구 및 역할별 감사 주체
- 분산 rate limiting, 신청 CAPTCHA/스팸 방어, 텔레메트리 서명 또는 서버 측 수집
- MongoDB transaction을 사용하는 redemption·counter·event 단일 원자 처리
- 만료 redemption 상시 worker 및 운영 모니터링/알림
- Regional Manager JWT 역할과 지역 assignment로 관리자 토큰 대체
- QR 인쇄 승인 이력, QR 버전·폐기 목록, 현장 부착 검수
