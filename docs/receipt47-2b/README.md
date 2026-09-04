# 접수번호 47-2B — 검수된 행동 채널

## 범위와 관리자 사용 방법

기존 RDM 장소를 선택하고 지역 관리자 인증 후 `예약·홈페이지·전화·지도 채널`에서 등록한다. 새 장소가 필요하면 기존 장소 후보 등록·승인 흐름을 먼저 사용한다. 채널 때문에 장소를 복제하지 않는다.

1. 종류, 한·영 표시명, 정확한 업체별 URL/전화, 공식 근거 URL, 재검수 기한(최대 1년)을 입력해 초안 등록.
2. **저장된 연결 시험**과 **공식 근거 확인**을 새 창에서 열어 업체명·주소·대상을 확인.
3. 확인 체크 후 **검수 완료**. 이 단계는 아직 비공개.
4. 작성 중 한·영 버튼 미리보기 확인 후 **공개**.
5. 수정하면 `REVIEW_REQUIRED`와 비공개로 전환. 다시 검수·공개해야 한다. **중지**는 `SUSPENDED`와 비공개로 전환.
6. 기한 경과는 DB 자동 갱신 없이 조회·연결 시 비공개 처리하고 관리자에게 재검수 필요로 표시한다.

토큰은 기존 `x-admin-token` 헤더 인증만 사용한다. 관리자 채널 목록·쓰기 모두 `allowedRegionIds` 명시적 지역 권한을 확인한다. 검수자는 Server의 불투명 actor ID이며 Client의 reviewedBy 값을 신뢰하지 않는다.

## 데이터와 API

`regionalactionchannels`: 문자열 UUID `_id`/`channelId`, `regionId`, canonical entity URI `placeKey`, `kind`, `labelKo/labelEn`, `target`, `sourceUrl`, `verificationStatus`, `published`, `reviewedAt/By`, `reviewDueAt`, `reviewedFingerprint`, `revision`, timestamps, audit.

종류: OFFICIAL_WEBSITE / PHONE / NAVER_PLACE / KAKAO_PLACE / DIRECT_BOOKING.

감사 이력에는 Server actor·시각·행동·revision·변경 필드를 보존한다. 수정·공개와 audit push는 같은 문서의 원자 갱신이고 revision 비교로 동시 수정 손실을 차단한다. 삭제 API는 없다. 장기간 감사 배열이 커지면 별도의 승인된 보존·아카이브 정책이 필요하다.

모든 API의 지역·장소는 등록된 effective dataset과 대조한다.

| API | 목적 |
|---|---|
| GET `/api/action-channels/admin?regionId=…&placeKey=…` | 인증된 지역별 채널과 감사 이력 |
| POST 동일 경로 | 초안 등록 |
| POST `/api/action-channels/admin/:id/:action` + 지역·장소 query | EDIT / VERIFY / PUBLISH / SUSPEND, revision 필요 |
| GET `/api/action-channels/public` + 지역·장소 query | 공개·검수·기한·fingerprint 통과 목록, 원시 URL/감사정보 제외 |
| POST `/api/action-channels/:id/click` + 지역·장소 query | 클릭 계측, 외부 이동 허가 아님 |
| POST `/api/action-channels/:id/outbound` + 지역·장소 query | 현재 채널을 다시 확인해 저장된 목적지 반환 |

Outbound 요청에는 URL이 없다. Server가 공개 상태·검수 기한·채널 revision·지역·장소·검수 당시 fingerprint를 확인하고, 저장된 HTTPS URL/전화번호만 반환한다. 관광객은 사용자 제스처로 연 빈 창을 해당 응답 목적지로 이동한다. 임의 redirect query/body는 거부한다. 기존 전화·홈페이지·길찾기·일정 저장은 유지하며, 검수 채널이 있으면 기존 동일 종류 전화·홈페이지를 중복 표시하지 않는다. 기존 원시 reserve URL은 관광객 버튼 생성에 사용하지 않는다.

HTTPS 자격정보·IP 리터럴·localhost/내부 suffix·비표준 포트·제어문자·비 HTTPS를 거부한다. 지도 채널은 Naver/Kakao 지도 호스트로 제한한다. Yapen은 `/external?ypIdx=숫자` 업체별 경로만 허용한다. Naver **예약** 호스트는 이번 단계에서 지원하지 않으며 지도 채널과 다르다. 외부 사이트의 이후 리다이렉트·콘텐츠 변경을 자동 검증하는 크롤러는 없다. 검수자가 최종 업체와 대상을 확인해야 한다.

## 스마일펜션 검토 자료

`smile-channels.json`은 사용자 제공 공식 확인 근거를 담은 **검토용 자료**이며 자동 DB 삽입·공개·backfill을 하지 않는다. RDM에서 합천호 스마일펜션을 선택하고 채널 검토 자료로 불러온 뒤 원하는 채널을 초안 등록한다.

- 장소: `hapcheon-lake-smile-pension`
- canonical: `https://hapcheon.example/ontology#hapcheonLakeSmilePension`
- 공식 근거: https://www.lakesmile.com/
- 우선 예약: https://rev.yapen.co.kr/external?ypIdx=24507
- 전화: 055-931-1638
- 제공된 주소: 경상남도 합천군 대병면 회양관광단지길 61

기존 master data의 일반 Yapen 루트는 정확한 업체별 URL로 교체했다. 그것만으로 새 채널을 공개하지 않는다. 다른 사업자의 Naver 예약 주소는 등록하지 않았다. 카카오 예약도 추가하지 않았다.

## 통계 의미와 개인정보

- `BOOKING_CLICKED`: 검수된 채널 버튼 선택. click endpoint는 fire-and-forget이며 outbound를 기다리게 하지 않는다.
- `BOOKING_OUTBOUND_DISPATCHED`: Server가 현재 승인된 목적지 반환을 허용한 결과. 브라우저의 외부 페이지 로딩 완료를 뜻하지 않는다.
- **예약 완료 측정 미지원**. `BOOKING_CONFIRMED`를 생성하거나 0건으로 표시하지 않는다.

동일 실행은 actionId와 원래 발생 시각을 재사용한다. Server는 `actionId + eventType`으로 결정적인 UUID eventId를 생성하며 기존 `_id`/eventId unique 중복 방지를 사용한다. click과 outbound는 서로 다른 eventId이다. outbound는 별도 click 전송 실패에 대비해 같은 click ID를 재전송하므로 저장상 중복되지 않는다. 최근 5초 재시도는 Client에서 동일 실행으로 묶고 진행 중 연속 클릭을 차단한다.

새 eventType은 일반 `/analytics/v2/events`로 자기신고할 수 없다. 채널 검증 경로에서만 생성한다. analytics 입력은 기존 엄격한 필드 계약을 통과해야 하며 `channelId`만 추가한다. URL, 질문, GPS, 원시 IP/UA, 관리자 토큰은 이벤트에 넣지 않는다. 잘못된 marker나 계측 저장 실패는 기록을 포기하되 승인된 외부 행동을 차단하지 않는다. 기존 테스트 분류·서울 시간·90일 보존·5개 고유 세션 및 합계 역산 보호를 그대로 사용한다. legacy/mock 예약은 합산·승격하지 않는다.

## 별도 운영 마이그레이션 계획 — 이번에는 실행하지 않음

1. 별도 운영 승인 후 기존 인덱스/백업 상태를 읽기 전용 확인.
2. `regionalactionchannels` 새 컬렉션을 준비하고 아래 선언과 동일한 인덱스를 별도 migration으로 생성·확인.
   - `{ channelId: 1 }` unique
   - `{ regionId: 1, placeKey: 1, verificationStatus: 1, published: 1 }`
   - `{ regionId: 1, reviewDueAt: 1 }`
   - Mongo 기본 `_id` unique
3. `visitoranalyticevents`는 선택 필드 `channelId` 및 두 eventType을 추가하며 기존 조회·unique·TTL 인덱스를 재사용한다. 새 analytics 인덱스나 backfill 없음.
4. 모든 새 스키마 `autoCreate:false`, `autoIndex:false`. 앱 시작/배포로 seed·index·기존 데이터 변경을 수행하지 않는다.
5. 배포 승인 이후 별도로 RDM에서 실제 관리자 검수·공개. 문제가 있으면 채널 중지로 공개를 차단한다. 코드 롤백 시에도 신규 데이터를 자동 삭제하지 않는다.

## 브라우저 확인과 한계

2026-09-04 Codex 내장 브라우저로 실제 RDM/관광객 컴포넌트를 DB 없는 메모리 HTTP fixture에서 확인했다. 테스트용 토큰만 사용했다.

- 기존 장소 선택 → 업체별 URL 초안 등록(DRAFT 비공개, 검수·공개 버튼 상태 확인) → 확인 체크 → VERIFIED 비공개 → 공개 → 새로고침 후 한국어 `실시간 예약하기` 표시.
- 버튼을 통해 새 탭의 정확한 Yapen 업체별 URL로 이동. `NOL 숙박예약시스템`, `합천 스마일펜션`, 객실 예약 달력 확인. 실제 예약·결제·고객정보 입력 없음.
- 영어 `Book Now` 표시. 390×844: 문서 폭 375px, 버튼 높이 44px, 관리자 입력 폭 275px/높이 44px 이상, 새 폼과 버튼 가로 넘침 없음. 키보드 초점과 접근성 이름 확인.
- 실제 Mongo 저장·동시성은 모델 경계 unit fixture로 검증했으며 운영 DB에 연결하지 않았다. DB 인덱스 실제 생성, 실기기 전화 앱, iOS/Android 외부 앱 전환과 현장 관리자 권한 설정은 승인된 후보/현장 검증에서 확인해야 한다.
- fixture 실행: Client Vite `--host 127.0.0.1 --port 5178 --strictPort`, 별도 `node scripts/receipt47-channel-fixture.mjs`, `http://127.0.0.1:5187/` 방문. dummy token은 fixture 코드에 명시되어 있고 실제 인증 자격정보가 아니다. 재시작하면 상태가 사라진다.

추천 모듈은 채널 저장소를 조회하지 않는다. 채널 추가 전후 context-based suitability 점수 동일 회귀 테스트를 포함한다. 기존 requiresReservation/runtime 예약 가능 상태의 의미는 변경하지 않았다.

## 검증 결과

- 관련 Client 테스트 38개 통과. 관련 Server 테스트 73개 통과.
- Client 전체 `npm run test:all`: 513/513 통과, skip/todo 0. 전체 실행 1회.
- Server 전체 `npm test -- --runInBand`: 103 suites, 967 tests 중 최초 964 통과, 3건은 기본 5초 시간 초과. 전체 실행은 1회만 수행했다.
- 실패한 두 파일만 30초 실행 제한으로 분리: QR 두 테스트 통과. 부트스트랩은 ActionChannelModule의 rate-limit 의존성 누락을 발견했고 기존 PartnerModule을 명시적으로 import해 수정했다. 검증 조건이나 테스트 소스는 약화하지 않았다.
- 수정 후 부트스트랩·채널 22개 통과. 최종적으로 967개 전체 항목의 통과를 확인했으며, 수정 후 전체 suite를 재실행했다고 주장하지 않는다. 신규 모듈을 포함한 앱 2회 시작 시 무쓰기·컬렉션·인덱스 불변 검증도 통과했다.
- Client production build 1회 성공. Server build는 최초 성공 후 위 런타임 의존성 수정 때문에 최종 소스로 한 번 더 확인했다. Client build는 반복하지 않았다.
- 기존 도구 경고: Node 22.11에 대한 Vite 버전 권고, bundle size, inlineDynamicImports deprecation, Mongoose `new` option deprecation. 검증을 막는 오류로 숨기지 않았다.
- 전체 테스트에서 실패 뒤 남아 있던 Jest 세션과 이번에 시작한 로컬 Vite/메모리 HTTP fixture를 종료했다. 운영 프로세스에는 접근하지 않았다.

## 변경 파일 전체 목록

```text
client/scripts/receipt47-channel-fixture.html
client/scripts/receipt47-channel-fixture.mjs
client/scripts/receipt47-channel-fixture.tsx
client/src/actionChannels.test.ts
client/src/actionChannels.ts
client/src/analyticsPresentation.test.ts
client/src/components/ActionChannelManager.tsx
client/src/components/EntityActions.tsx
client/src/components/RegionalDataManager.tsx
client/src/components/VerifiedChannelActions.tsx
client/src/components/VisitorAnalyticsDashboard.tsx
client/src/components/action-channels.css
client/src/pages/NearbyRestaurantsPage.tsx
client/src/visitorAnalytics.ts
docs/receipt47-2b/README.md
docs/receipt47-2b/smile-channels.json
server/src/action-channels/action-channel.controller.ts
server/src/action-channels/action-channel.module.ts
server/src/action-channels/action-channel.schema.ts
server/src/action-channels/action-channel.service.ts
server/src/action-channels/action-channel.spec.ts
server/src/action-channels/channel-outbound.service.ts
server/src/action-channels/channel-policy.ts
server/src/analytics/analytics.module.ts
server/src/analytics/visitor-analytics.service.ts
server/src/analytics/visitor-contract.ts
server/src/analytics/visitor-event.schema.ts
server/src/app.module.ts
server/src/recommendation/regional-recommendation.spec.ts
server/src/regions/hapcheon/master-data.ts
```
