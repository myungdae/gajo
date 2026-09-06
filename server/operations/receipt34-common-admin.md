# 접수번호 34 — 전국 공통 관리자

대표 진입점은 https://exkovia.com/admin 이다.
/:regionId/admin은 같은 AdminEntry의 초기 지역 선택 deep link다.
이 문서가 이전 위치 인증 준비서의 지역별 진입점 설명을 대체한다.

## 인증과 지역

1. 공통 관리자 인증란 하나가 기존 admin-write-token을 관리한다.
2. 인증된 GET /api/admin/regions는 서버에 등록된 지역과 ADMIN_REGION_IDS의
   교집합만 반환한다. 인증 전에는 지역별 데이터 요청을 보내지 않는다.
3. /admin에서 사용자가 허용 지역을 선택하면 /admin?regionId=선택지역으로 이동한다.
   deep link의 지역도 이 목록에 있을 때만 초기 선택된다.
4. AdminRegionProvider 하나를 데이터 검수·위치정보·업소·Spotlight·지역 통계가 공유한다.
   지역/인증 변경 시 기존 사적 화면을 해제한다. 지연 응답은 새 지역에 표시하지 않는다.
5. URL은 선택값이며 권한 증명이 아니다. 위치·업소·Spotlight의 기존 서버 권한 검사를
   유지하고, 기존 데이터 검수 API에도 공통 지역 가드를 적용했다.
   조회 query, 가져오기 package, 변경 대상 문서의 지역을 허용 지역과 대조한다.
6. Copilot 진입 화면의 기존 JWT 경로는 변경하지 않는다.

관리자 화면은 방문객 레이아웃과 분리되어, 선택 지역과 무관한 방문객 지역명이
헤더에 나타나지 않는다. 별도의 합천 관리자나 유성가든 처리 분기는 없다.

## 신규 지역과 기존 데이터 호환

- 업소 UI의 query, 표시명, ActionChannel은 공통 context를 사용한다.
- 서버 업소 duplicate 후보는 요청 지역 dataset/문서만 사용한다.
- 업소 ID와 registrationKeys는 요청 regionId로 구분한다.
  기존 합천 key 형식은 그대로이므로 재시드·키 교체·마이그레이션이 필요하지 않다.
- 신규 지역은 서버 환경의 ADDITIONAL_REGION_CONFIG_JSON에 **설정 데이터**로 추가할 수 있다.
  배열의 항목은 id, regionName, ontologyNamespace가 필수이며
  serviceName, center, bounds는 선택이다. 기존 지역 덮어쓰기 및 잘못된 설정은 거부한다.
  ADMIN_REGION_IDS에 별도로 권한을 부여해야 선택할 수 있다.
  관리 UI·라우트·업소 서비스는 지역 추가를 위해 수정할 필요가 없다.
- 지역 설정 등록 자체는 장소 데이터나 좌표를 만들지 않는다.
  경계 정보가 없거나 잘못됐으면 기존 위치 승인 안전장치가 승인을 차단한다.
- 이번 작업에서는 환경변수 설정 변경, 운영 데이터 추가, 운영 배포를 수행하지 않았다.

## 검증 근거

- 격리 DOM: /admin → 인증 → 합천 선택 → 좌표 없는 장소 → 유성가든 표시와
  /hapcheon/admin → 인증의 동일 결과를 1440/390 너비에서 검증했다.
- 가조·합천·옥천·무안·계룡·새로운 fixture 지역의 업소·데이터·Spotlight·위치
  요청 지역 일치, history/resize 유지, 지연 상세 응답 폐기, 인증 제거를 검증했다.
- Windows 실제 브라우저: 로컬 fixture 서버를 사용해 1440×900과 390×844에서
  두 진입 경로, 인증란 1개, 동일 합천 위치 목록과 가로 넘침 없음을 확인했다.
  로컬 서버에는 GET /api/admin/locations, regionId=hapcheon, admin header=true,
  bearer header=false, HTTP 200으로 기록됐다. 자격증명 값은 로그에 남기지 않았다.
- 실제 Nest HTTP: 무인증·잘못된 인증, 허용되지 않은 지역 목록/조회/쓰기,
  URL 지역과 대상 문서 지역 불일치를 403으로 차단했다.
- 신규 지역 설정, 지역별 업소 생성 fixture 및 기존 합천 ID/key 호환을 검증했다.
- 최종 Client 전체 583개, 서버 전체 114 suites / 1135 tests 통과.
  서버·Client 빌드와 git diff --check 통과.
- 신규 지역의 검수된 업소는 빈 기본 dataset 위에 기존 공개 규칙으로 반영된다.
  검수 전에는 공개되지 않으며 기존 문서의 canonical을 유지한다.

운영 데이터에 대한 확인 결과로 해석하면 안 된다. 운영 인증 목록 조회·DB 쓰기·
push·배포·nginx 변경은 수행하지 않았다.
이 기능은 Regional Data Manager의 현장정보 검수 기반이며,
접수번호 33의 선제 REPLAN/ACTION 완료 기준은 별도다.
