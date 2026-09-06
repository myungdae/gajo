# 접수번호 34 — 전국 공통 관리자

대표 진입점은 https://exkovia.com/admin 이다.
/:regionId/admin은 같은 AdminEntry의 초기 지역 선택 deep link다.
이 문서가 이전 위치 인증 준비서의 지역별 진입점 설명을 대체한다.

## 인증과 지역

1. 공통 관리자 화면은 기존 Copilot 계정의 아이디·비밀번호로 로그인한다.
   POST /api/copilot/auth/login이 발급한 8시간 JWT만 브라우저 sessionStorage에 저장한다.
   운영용 ADMIN_WRITE_TOKEN을 화면에 입력하거나 저장하지 않는다.
2. 인증된 GET /api/admin/regions는 서버에 등록된 지역 중 사용자 역할에 허용된 지역만
   반환한다. PLATFORM_ADMIN은 등록된 전체 지역, REGIONAL_MANAGER는 배정 지역의
   교집합을 받으며 VIEWER는 관리자 화면을 사용할 수 없다.
3. /admin에서 사용자가 허용 지역을 선택하면 /admin?regionId=선택지역으로 이동한다.
   /:regionId/admin의 지역도 권한 목록에 있을 때만 초기 선택된다. URL은 권한 증명이 아니다.
4. AdminRegionProvider 하나를 데이터 검수·위치정보·업소·Spotlight·지역 통계가 공유한다.
   지역/인증 변경 시 기존 화면을 해제하고 지연 응답을 새 지역에 표시하지 않는다.
5. 기존 /api/admin 관리 API는 Authorization: Bearer JWT를 검증한다. 감사 actor는
   COPILOT:<sub>로 기록하고 지역 가드가 query, payload와 대상 문서 지역을 다시 대조한다.
6. 기존 x-admin-token + ADMIN_WRITE_TOKEN은 운영 자동화의 하위 호환 경로로만 유지한다.
   브라우저 공통 관리자 화면은 이 경로를 사용하지 않는다. 두 인증값 모두 로그나 응답에
   출력하지 않는다.

관리자 화면은 방문객 레이아웃과 분리되어 선택 지역과 무관한 방문객 지역명이
헤더에 나타나지 않는다. 별도의 합천 관리자나 유성가든 처리 분기는 없다.

## 보안 계약

- JWT 서명은 COPILOT_JWT_SECRET과 HS256을 사용하며 만료·변조·잘못된 서명을 거부한다.
- PLATFORM_ADMIN도 URL의 임의 문자열이 아니라 서버에 등록된 지역만 선택할 수 있다.
- REGIONAL_MANAGER의 토큰에 등록되지 않은 지역이 있어도 관리 목록에서 제외한다.
- VIEWER, 무인증, 만료/위조 JWT, 잘못된 legacy token은 관리 기능을 사용할 수 없다.
- 화면 로그아웃과 인증 실패 시 Copilot 세션 및 오래된 admin-write-token 저장값을 제거한다.

## 신규 지역과 기존 데이터 호환

- 업소 UI의 query, 표시명, ActionChannel은 공통 context를 사용한다.
- 서버 업소 duplicate 후보는 요청 지역 dataset/문서만 사용한다.
- 업소 ID와 registrationKeys는 요청 regionId로 구분한다. 기존 합천 key 형식은 유지한다.
- 신규 지역은 ADDITIONAL_REGION_CONFIG_JSON 설정으로 추가할 수 있다.
  id, regionName, ontologyNamespace가 필수이며 serviceName, center, bounds는 선택이다.
  기존 지역 덮어쓰기 및 잘못된 설정은 거부한다.
- 지역 설정 등록 자체는 장소 데이터나 좌표를 만들지 않는다. 경계 정보가 없거나
  잘못됐으면 기존 위치 승인 안전장치가 승인을 차단한다.

## 검증 계약

- Client 격리 DOM은 /admin과 /hapcheon/admin 모두 아이디·비밀번호 로그인,
  Bearer 지역 목록 조회, 합천/계룡 전환 및 단일 지역 scope를 검증한다.
- 서버 HTTP 계약은 legacy 자동화 호환, PLATFORM_ADMIN 전체 등록 지역,
  REGIONAL_MANAGER 배정 지역, VIEWER/위조 JWT 차단과 지역 가드를 검증한다.
- 전체 Client/서버 테스트 및 빌드는 운영 반영 전 승인된 checkout에서 다시 실행한다.
  GitHub 커넥터 편집 환경에서는 로컬 의존성이나 운영 인증으로 실행하지 않았다.

운영 데이터 확인, push to main, 배포, 운영 DB 쓰기, nginx 변경은 수행하지 않는다.
이 기능은 Regional Data Manager의 현장정보 검수 기반이며 접수번호 33의 선제
REPLAN/ACTION 완료 기준은 별도다.
