# EXKOVIA 전국 플랫폼 전환 Phase 2.0

기준 커밋: `0bd5ae3b190ea2c7cebb994d569e7425ccf91cae`
작업 브랜치: `feature/exkovia-platform-foundation`

## 현행 구조 조사

- 방문자 앱은 하나의 React/Vite 엔트리와 `RegionConfig` 레지스트리를 공유한다. 지역은 URL 첫 path segment, `?region=`, 지역별 `*.odex.kr` hostname 순으로 결정된다. 지역 경로가 hostname보다 우선한다. 가조 기본값은 hostname이 없는 단위 테스트와 localhost 개발 환경에만 남기고, 알 수 없는 운영 hostname·`copilot.odex.kr`·`guide.odex.kr`는 지역으로 임의 연결하지 않는다.
- `gajo.odex.kr` 루트와 지역 prefix 없는 `/concierge`, `/nearby-discovery`는 가조 호환 경로다. `/hapcheon` 등 명시적 prefix는 같은 화면·엔진에 다른 config를 주입한다.
- Home은 실제 여행 시작 액션에서만 `ensureTripSession`을 호출한다. Concierge, Nearby, Itinerary, GPS/현재시간, PLAN → NOW → RE-PLAN → ACTION은 주입된 `region.id`를 API와 TripSession에 전달한다.
- TripSession key는 `regional-concierge-trip-session-v1:{regionId}`, archive key도 region prefix를 쓴다. localStorage 실패 시 sessionStorage를 보조로 쓰며 payload의 다른 `regionId`는 거부한다. 브라우저 저장소와 CacheStorage는 origin 단위이므로 `gajo.odex.kr` 세션을 `exkovia.com`에서 직접 읽을 수 없다.
- PWA는 `/sw.js` scope `/`의 방문자 전용 service worker 하나와 지역별 manifest를 쓴다. Copilot/Guide/기존 Portal HTML은 precache shell에서 제외된다. 새 deep link는 Nginx의 `try_files ... /index.html` 정책으로 새로고침 가능하다.
- API는 상대 `/api`를 사용하고 방문자 내부 링크도 대체로 상대 path다. QR은 DB에 hostname을 저장하지 않고 생성 시 `PUBLIC_BASE_URL`과 `/go/:slug` 또는 `/visit/:slug`를 결합한다.
- 파트너 공개 API는 OPERATING + ACTIVE QR + VERIFIED 조건을 만족한 projection만 반환하며 projection에 `regionId`가 포함된다. 클라이언트는 그 지역으로 TripSession을 만든다. 따라서 QR 경로에 지역 prefix가 필요 없다. DRAFT 파트너(예: smile)는 공개 조회에서 404다.
- 인쇄 QR은 운영 파트너이고 `PUBLIC_BASE_URL` hostname이 `exkovia.com` 또는 하위 도메인일 때만 허용된다. test QR은 인쇄물이 아니며 별도 표시된다.
- MongoDB 모델과 조회는 TripSession, Partner, Benefit, Activity, regional data 전반에서 `regionId`를 저장·검증한다. 파트너는 `(regionId, canonicalEntityId)`, 익명 여행은 `(anonymousTripId, regionId)` 복합 격리를 사용한다. 지역 데이터 fallback을 새로 만들지 않는다.
- `copilot.odex.kr`와 `guide.odex.kr`는 별도 HTML 엔트리이며 방문자 service worker에서 격리되어 있다. 이번 변경은 해당 엔트리, 인증, API, Nginx를 수정하지 않는다.
- 서버 CORS는 현재 `origin: true, credentials: true`다. Phase 2.0 저장소 변경에는 운영 allowlist를 추측해 넣지 않는다. 실제 도메인 연결 전 명시적 origin allowlist로 좁혀야 한다.

## 선택한 구조

별도 앱이나 엔진 복제 없이 기존 방문자 Router에 얇은 플랫폼 화면을 추가한다. `exkovia.com`(및 하위 도메인)의 `/`만 EXKOVIA Portal로 분기하고 `gajo.odex.kr`의 `/`는 기존 Home을 그대로 렌더링한다. 로컬 QA에서는 `?platform=exkovia`를 명시적으로 사용한다. 알 수 없는 hostname의 `/`는 지원하지 않는 주소로 닫힌다. Portal, 지역 선택, 참여 설명은 TripSession 모듈을 import하지 않는다.

지역 여행 화면은 기존 `RegionProvider`, `RegionConfig`, Concierge/Nearby/TripSession을 그대로 쓴다. `/hapcheon/nearby`는 기존 `/hapcheon/nearby-discovery`와 같은 컴포넌트의 명확한 별칭이다. 기존 `/partners/apply`, `/partners/:slug/manage`도 유지하면서 요구 경로 `/partner/apply`, `/partner/console`을 추가한다.

브랜드는 Portal·참여 화면에서만 EXKOVIA를 전면에 두고, `/hapcheon` 진입 이후에는 기존 `합천 여행안내`와 합천 Hero를 유지한다.

## 개인정보와 상담 경계

도입 상담 화면은 예정 필드만 보여주고 submit/API/DB를 만들지 않는다. 공개 전에 처리 목적, 법적 근거와 동의문, 암호화, 최소 접근권한, 관리자 감사로그, 보존·파기 기간, 열람·삭제 절차를 확정해야 한다.

파트너 콘솔의 management key는 파일럿 자격 증명임을 UI에 표시한다. 일반 공개 전 업주 계정, MFA, 복구·회수, 세션 관리, 역할/감사 정책이 필요하다.

## TripSession Phase 2.1 제안

사용자가 `기존 여행 가져오기`를 명시적으로 선택하면 기존 origin이 짧은 수명의 1회용 opaque transfer token을 서버에서 발급한다. 새 origin은 token만 전달받아 서버 간 교환하고, 여행 ID 전체·좌표·자유입력·개인정보는 URL에 넣지 않는다. 서버는 source/target region, 세션 소유 증명, 만료, nonce, 1회 사용 여부를 검증한다. 최소 구조화 여행 context만 새 origin의 새 세션으로 복사하고 즉시 token을 폐기하며 양쪽에 감사 이벤트를 남긴다. 구현 전 threat model, CSRF/open redirect, 재사용, 동의 철회 테스트가 선행되어야 한다.

## 도메인 연결 전 운영 작업

1. Route 53에 `exkovia.com`/필요 서브도메인 레코드 설계 및 변경 승인
2. ACM 또는 Certbot 인증서 발급·갱신·HSTS 정책 검증
3. Nginx virtual host와 SPA fallback, API proxy, canonical redirect 정책 검증
4. 서버 CORS allowlist와 trusted proxy/forwarded host 정책 확정
5. manifest 이름·아이콘·start_url 및 service worker 캐시 버전의 EXKOVIA 실기기 검증
6. `PUBLIC_BASE_URL=https://exkovia.com` 설정 후에만 승인 파트너 인쇄 QR 생성
7. 상담 개인정보 처리체계와 업주 계정/MFA 완료 전 해당 기능을 공개 운영하지 않음
8. 합천 데이터·추천·GPS·시간·deep-link 회귀와 기존 세 도메인 격리 smoke test

이번 단계에서는 DNS, TLS, AWS, Nginx, 운영 데이터, redirect, 파트너 승인, 실제 QR 인쇄를 수행하지 않는다.
