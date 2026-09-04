# 47-2C 합천 신규 업소 등록

## 현행 조사와 구현

기존 `POST /api/admin/regional-data/candidates`는 후보·중복 동일성·변경 제안을 지원했지만 일반 매니저가 작성할 폼은 없었다. 기존 APPROVE는 ACTIVE/VERIFIED를 한 번에 적용했다. 기존 데이터에는 이 의미를 유지하고, 새 업소에는 같은 RegionalDataRecord와 effectiveDataset을 사용하면서 검수(APPROVED)와 공개(ACTIVE)를 분리했다.

합천 RDM의 첫 화면은 `등록된 업소 관리`와 `새 업소 등록`이다. 전체 목록은 자동 펼치지 않고 업소명 검색으로 최대 50개를 조회한다. 기존 후보·변경 검수 도구는 접힌 영역에 보존했다. 일반 등록에는 JSON이나 내부 ID 입력이 필요하지 않다. 연결 자료 JSON 가져오기도 선택 영역으로 접었다.

## 관리자 사용 순서

1. 기존 관리자 인증을 입력한다. 토큰의 합천 지역 권한이 필요하다.
2. 새 업소 등록에서 이름·업종·주소·소개·공식 근거·정보 확인일을 입력한다. 영어명은 선택이고 미입력 상태를 명시한다. 전화·홈페이지·네이버/카카오 장소·좌표도 입력할 수 있다.
3. 중복 업소 확인에서 이름·주소·전화·공식 URL이 일치하는 후보를 확인한다. 중복 후보가 있으면 신규 생성하지 않는다. Server도 제출 시 다시 검사한다.
4. 검증 대기로 등록한다. 관광객 데이터와 연결 관리에는 아직 나타나지 않는다.
5. 공식 근거와 기본정보를 확인하고 체크한 뒤 검수 완료한다. 이 상태도 비공개다.
6. 장소 공개를 별도로 선택한다. 이때만 관광객의 지역 데이터·검색/추천 대상에 반영되며 기존 추천 점수 원칙을 사용한다.
7. 같은 화면에서 기존 Action Channel 폼으로 전화·홈페이지·지도·예약 초안→저장된 연결 시험→공식 근거 확인→검수→공개를 수행한다. 연결은 자동 생성하지 않는다.
8. 업소 정보 수정은 장소를 비공개·재확인 상태로 되돌린다. 운영 중지도 비공개 처리한다. 해당 장소가 공개되지 않으면 기존 연결의 public/outbound도 차단된다. 연결 문서의 감사 이력·revision·fingerprint는 수정하지 않는다.

주소·좌표 확인이 없으면 좌표와 길찾기를 관광객 데이터에 내보내지 않는다. 입력 전화·홈페이지는 원시 장소 행동으로 공개하지 않고 별도 검수 채널을 통해서만 제공한다. 영문 이름은 입력·검수된 값만 사용한다.

## 모델·API·권한

새 컬렉션 없이 기존 RegionalDataRecord 컬렉션을 재사용한다.

- `registration`: 입력 원본, revision, 검수자·검수시각, 검수 fingerprint.
- `registrationKeys`: 정규화된 이름·주소·전화·홈페이지의 SHA-256 중복 식별 키 배열.
- 기존 `id`: Server 생성 `hapcheon-business-{UUID}`.
- `canonicalEntityId`: Server 생성 `urn:regional-business:hapcheon-business-{UUID}`.
- 기존 source, proposedFacts, lifecycleStatus, verificationStatus, auditTrail을 재사용한다.
- 수정은 revision을 조건으로 원자적으로 갱신하고 Server 인증 주체로 감사 이력을 남긴다.
- 새 관리 경로는 합천으로 제한하며 다른 지역 요청·권한을 거부한다. Client 입력의 ID·상태·검수자 등 허용되지 않은 필드를 거부한다.
- 기존 후보 생성·승인·가져오기 경로로 새 등록 문서의 검수 단계를 우회하지 못하도록 차단한다. 새 등록 문서는 인증 없는 기존 관리 목록에서 제외한다.

모든 새 API는 기존 `x-admin-token` 인증과 지역 권한을 사용한다.

| 경로 | 용도 |
|---|---|
| GET `/api/admin/businesses?regionId=hapcheon&search=…` | 기존·신규 업소 검색 |
| POST `/api/admin/businesses/duplicates?regionId=hapcheon` | 중복 후보 조회 |
| POST `/api/admin/businesses?regionId=hapcheon` | 검증 대기 등록 |
| POST `/api/admin/businesses/:id/:action?regionId=hapcheon` | VERIFY / PUBLISH / EDIT / STOP, revision 필요 |

URL 정책은 기존 Action Channel의 HTTPS·외부 호스트 정책을 재사용한다. 내부 주소 형태, IP 리터럴, 자격정보, 일반 Yapen 루트, 미지원 네이버 예약 URL을 차단한다. 공식 정보의 진위나 외부 사이트 변경을 자동 크롤링해 보증하지 않는다. 관리자가 업체와 목적지를 확인해야 한다.

## 통계

기존 Analytics v2의 세션·분류·개인정보·서울 시간·소규모 보호를 유지하고 이벤트 종류와 업체별 표에 다음을 추가했다.

- `PLACE_RECOMMENDATION_SHOWN`: 여행안내 추천 항목이 실제 viewport에 진입했을 때. 사람의 주의·열람 완료를 의미하지 않는다.
- `PLACE_DETAIL_OPENED`, `PHONE_CLICKED`, `DIRECTIONS_CLICKED`: 기존 이벤트 재사용.
- `WEBSITE_OUTBOUND_DISPATCHED`, `NAVER_PLACE_OUTBOUND_DISPATCHED`, `KAKAO_PLACE_OUTBOUND_DISPATCHED`: Server가 승인된 연결 목적지를 반환한 결과.
- `BOOKING_CLICKED`, `BOOKING_OUTBOUND_DISPATCHED`: 기존 예약 선택·이동 의미 유지.
- 예약 완료는 계속 **측정 미지원**이며 이벤트를 생성하거나 0건으로 표현하지 않는다.

채널 귀속과 outbound 이벤트는 일반 Client 이벤트 자기신고로 저장할 수 없다. 같은 실행의 actionId와 종류별 eventId를 재사용한다. 계측 오류는 승인된 행동을 막지 않는다. 관리자 연결 시험은 관광객 계측을 호출하지 않고 미리보기 버튼은 실행되지 않는다. 관광객 화면에서 검증할 때는 기존 인증된 내부 검증 표식을 사용한다. 내부 검증·자동 점검 기본 제외, 서로 다른 5개 세션 기준과 합계 역산 보호를 유지한다. 과거 데이터는 재분류·backfill하지 않는다.

업소별 표는 검색·선택한 업소 식별자를 이름으로 표시하며 아직 조회하지 않은 업소는 식별자가 보일 수 있다. 수집은 향후 승인된 배포 이후 발생하는 신규 이벤트부터 시작한다. 표시·이동 이벤트는 예약 완료나 실제 사람 수의 증거가 아니다.

## 운영 마이그레이션 계획 — 미실행

1. 운영 승인 이후 기존 RegionalDataRecord 컬렉션과 인덱스·백업 상태를 확인한다.
2. 신규 등록을 운영에서 사용하기 **전에** `{ registrationKeys: 1 }`, `unique:true`, `sparse:true` 인덱스를 별도 승인된 마이그레이션으로 생성·확인한다. 정확히 일치하는 키의 동시 중복 등록 방지는 이 인덱스가 전제다. 키가 없는 기존 문서는 변경하지 않는다.
3. 서버 자동 인덱스 생성에 의존하지 않는다. 이번 작업에서는 인덱스·DB·환경변수·Docker를 변경하지 않았다.
4. 추가 컬렉션, analytics 신규 인덱스, 기존 데이터 변환·seed·backfill은 없다. 기존 스마일펜션 장소와 공개 채널을 복제하거나 재등록하지 않는다.
5. 명칭·주소 변경 등으로 같은 업체의 키가 달라지는 사례는 관리자가 중복 후보를 검토해야 한다. 법적 사업자 동일성을 자동 증명하는 기능은 아니다.

## 검증

- 관련 Client: 27/27 통과.
- 관련 Server: 최종 75/75 통과. 초기 신규 중복 후보 검사에서 baseline의 빈 id를 제외 ID와 혼동하던 오류를 수정했다.
- 최종 Client 전체: **520/520**, 실패·skip·todo 0.
- 최종 Server 전체: **104 suites / 980 tests**, 실패·skip·todo 0. `--runInBand --testTimeout=30000`, 종료 코드 0.
- Client·Server production build 각각 성공. 기존 Vite Node 버전 권고·번들/플러그인 경고는 남아 있다.
- 신규 skip/only/todo 없음. `git diff --check` 통과.
- 스마일펜션 master data·47-2B 검토 JSON, ConciergePage·voice 세션 코드 변경 없음. 운영 DB에 접속하거나 공개 채널 3건을 수정하지 않았다.

### 브라우저

실제 React 관리자 컴포넌트 + 로컬 메모리 HTTP fixture(5189), Vite(5178)에서 확인했다. 더미 인증만 사용했고 운영 데이터·실제 예약·결제는 사용하지 않았다.

- 390×844 모바일: 신규 업소 입력→중복 확인→검증 대기→확인 체크→검수 완료·비공개→장소 공개→연결 초안→검수→공개→새로고침 후 관광객 예약 버튼 표시.
- 검수 전 장소 공개 버튼과 연결 등록은 비활성/미노출이다.
- 최신 한글 상태·접힌 선택 JSON 도구 확인. 입력 높이 44px 이상.
- 390 viewport의 실제 문서 폭/스크롤 폭 375/375, 320×400에서 305/305, 844×390에서 829/829: 가로 넘침 없음.
- `mobile-entry-public.png`, `mobile-business-published.png` 증빙 보존.
- 실제 Mongo 저장·인덱스 생성·동시 요청의 DB 실행은 이번 브라우저 fixture 범위 밖이다. 서비스·정책 테스트와 선언 인덱스로 검증했으며 운영 마이그레이션 확인은 별도다.
- 실제 iPhone Safari/Android, 실물 키보드·전화 앱 전환, 현장 지역매니저 계정의 권한 설정은 후보/현장 확인이 필요하다.

## 변경 파일

Server: `regional-data/business-registration.{controller,policy,service}.ts`, `business-registration.spec.ts`, `regional-data.{module,schema,service}.ts`; `action-channels/channel-outbound.service.ts`, `action-channel.spec.ts`; `analytics/visitor-{contract,report}.ts`, `visitor-analytics.service.ts`.

Client: `BusinessRegistrationManager.tsx`, `business-registration.css`, `RegionalDataManager.tsx`, `ActionChannelManager.tsx`, `VerifiedChannelActions.tsx`, `VisitorAnalyticsDashboard.tsx`, `RecommendationExposure.tsx`, `RecommendationItineraryItem.tsx`, `visitorAnalytics.ts`, `businessRegistration.test.ts`; `scripts/receipt47c-business-fixture.{html,tsx,mjs}`; 이 문서와 PNG 증빙.
