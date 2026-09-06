# 접수번호 34: 위치정보 관리 로그인 세션 연결

> **후속 수정: 진입 화면별 인증 (현재 계약)**
>
> 실제 운영 진입 경로는 https://exkovia.com/hapcheon/admin 이다.
> 이전 JWT 전용 수정은 이 화면의 기존 관리자 인증을 무시하는 회귀를 만들었다.
> 아래 이전 진단의 JWT 전용 UI 설명은 이 후속 수정으로 대체된다.
> 잘못 전달된 copilot.html의 404는 실제 운영 관리자 경로와 무관하다.
> 추가 호스트 조사나 nginx 변경은 수행하지 않는다.
>
> - /:regionId/admin: AdminPage의 adminToken 상태를 RegionalDataManager를 통해
>   LocationReviewManager에 명시적으로 전달한다. 기존 “관리자 인증” 입력을 공유한다.
>   GET /api/admin/locations?missingOnly=true&regionId=hapcheon, x-admin-token 사용.
> - Copilot: 기존 JWT를 유지한다. /api/copilot/locations, Authorization Bearer 사용.
> - 저장된 다른 종류의 인증으로 자동 fallback하지 않는다. 지역 admin의 빈 인증은
>   JWT가 있어도 요청을 보내지 않으며 기존 관리자 인증 필요 안내를 표시한다.
> - 추가 위치 토큰 입력은 없다. 기존 인증 변경은 부모 상태로 전파되고,
>   인증 제거/지역 변경 시 기존 사적 목록과 선택, 지연 응답은 폐기된다.
> - 서버 인증 및 지역 권한 정책은 변경하지 않는다. legacy 권한은 서버가 정한
>   ADMIN_REGION_IDS, JWT는 기존 principal의 role/지역 할당으로 검증한다.
>   화면의 지역 선택 자체가 권한을 부여하지 않는다.
>
> 격리 검증: 실제 AdminPage에서 1440/390 너비로 인증 전 요청 0건,
> 기존 인증란 입력 후 legacy GET과 유성가든 fixture 표시, 인증 제거 후 목록 제거.
> 다른 지역의 legacy 인증으로 합천 GET/APPROVE는 403, DB writes=0.
> Copilot JWT/잘못된 JWT/타 지역 접근 및 401·403·빈 목록 구분 회귀도 유지한다.
> 최종 전체 테스트: Client 583개, 서버 112 suites / 1123 tests 통과.
> 서버·Client 빌드와 git diff --check 통과.
>
> 운영자가 직접 확인할 때는 실제 /hapcheon/admin의 기존 관리자 인증 후
> Network에서 locations의 URL, GET, status만 확인한다. Headers, 자격증명,
> 문서 원문이나 HAR는 공유하지 않는다. 이 후속 수정은 로컬 검증이며 운영 배포나
> 인증된 운영 유성가든 조회 완료를 의미하지 않는다.

## 확인한 원인과 운영 확인 한계

부모 커밋 3833710bc084e50d6ce65566a75734c10b9e218a의 일반 관리자
RegionalDataManager는 LocationReviewManager에 copilotToken을 전달하지 않았다.
컴포넌트는 이 경우 admin-write-token만 읽었다. 빈 값이면 fetch 전에 반환하므로
HTTP 200/401/403이 아니라 **목록 요청 미발생**이다. 추가 토큰 입력란도 이 분기에서 표시됐다.

반면 현재 로컬 copilot-main.tsx 전용 화면은 이미 JWT를 전달하고 있었다.
따라서 사용자가 보고한 운영 copilot.html 증상을 위 원인만으로 확정하지 않는다.
2026-09-07 연결 가능한 브라우저에는 기존 로그인 탭이 없었으며,
제공된 https://exkovia.com/copilot.html 은 새 브라우저와 curl GET 모두 HTTP 404였다.
사용자 Windows 탭의 캐시·서비스워커·배포 버전·실제 목록 HTTP 상태는 미확인이다.
캐시 제거, 로그아웃, 서비스워커 변경, 운영 설정 변경은 하지 않았다.
운영 유성가든 조회 성공을 주장하지 않는다.

## 최소 수정

- 위치정보 UI는 기존 copilot-access-token 또는 명시적으로 받은 JWT만 사용한다.
- 일반 위치정보 UI에서 별도 토큰 입력과 legacy 자동 fallback을 제거했다.
- 로그인/로그아웃 이벤트 및 창 복귀 시 세션을 다시 읽고, 세션·지역 변경 시
  기존 목록/선택과 지연 응답을 폐기한다. 명시적 빈 JWT는 로그아웃 상태로 취급한다.
- 서버의 JWT role/region 검증은 그대로 유지한다. 클라이언트 지역값은 권한을 부여하지 않는다.
- legacy /api/admin/locations 및 x-admin-token API는 그대로 유지한다.
- 로그인 필요, 조회 중, 401 재로그인, 403 지역 권한 부족, 연결 실패,
  잘못된 응답, 성공한 200 빈 목록을 각각 구분한다. 오류 HTTP 원문은 표시하지 않는다.

## 목록 필터 계약

GET /api/copilot/locations?regionId=hapcheon&missingOnly=true

서버는 JWT 검사 → region scope 검사 → 해당 지역 기존 문서 조회 →
공개 승인 위치 판정 → missingOnly 필터 → 관리자 projection 순서로 처리한다.
기존 검증/provenance 및 curated 공개 좌표 호환 규칙은 변경하지 않았다.
유효한 공개 승인 위치가 없는 유성가든 fixture는 이 필터에서 남는다.
실제 운영 문서가 필터에서 빠지는지는 아래 두 GET의 결과로 구분해야 한다.

## 운영자가 직접 수행할 읽기 전용 확인

이미 로그인된 Windows 탭을 그대로 사용한다. 새 탭은 sessionStorage 인증을 공유하지
않을 수 있다. F12 → Network에서 locations로 필터한 뒤 “좌표 없는 장소만”을
해제/선택한다. Request URL의 regionId, missingOnly와 Status만 확인한다.
요청이 없으면 “요청 미발생”, 401은 인증 실패, 403은 지역/역할 거절,
200만 실제 목록 결과이다. Headers/토큰/응답 원문/HAR는 복사하거나 공유하지 않는다.

다음 코드는 **현재 탭과 같은 origin에 GET 두 건만** 보낸다.
자격증명과 문서 원문을 출력하지 않는다. Console에서 직접 실행할 수 있다.
로그인, 좌표 변경, 승인, 반려, 복원, 설정 변경을 수행하지 않는다.

```javascript
void (async () => {
  const token = sessionStorage.getItem('copilot-access-token');
  if (!token) {
    console.info('STOP: 현재 탭에 Copilot 로그인 세션이 없습니다. 요청하지 않았습니다.');
    return;
  }
  const canonical = 'https://hapcheon.example/ontology#yuseongGardenRestaurant';
  const summaries = [];
  for (const missingOnly of [false, true]) {
    try {
      const url = new URL('/api/copilot/locations', location.origin);
      url.search = new URLSearchParams({regionId:'hapcheon',missingOnly:String(missingOnly)});
      const response = await fetch(url, {
        method:'GET', headers:{Authorization:'Bearer '+token},
        redirect:'error', cache:'no-store', signal:AbortSignal.timeout(15000)
      });
      const summary = {region:'hapcheon',missingOnly,status:response.status};
      if (response.ok) {
        const body = await response.json();
        if (!Array.isArray(body?.records)) {
          summary.result = 'INVALID_LIST_RESPONSE';
        } else {
          const matches = body.records.filter(r => r.canonicalEntityId === canonical);
          summary.total = body.records.length;
          summary.targetCount = matches.length;
          summary.targetMapVisible = matches.length === 1 ? matches[0].mapVisible === true : null;
        }
      }
      summaries.push(summary);
      if (!response.ok) break;
    } catch {
      summaries.push({region:'hapcheon',missingOnly,result:'NETWORK_OR_RESPONSE_ERROR'});
      break;
    }
  }
  console.table(summaries);
})();
```

기대: 두 요청 모두 200, targetCount=1, targetMapVisible=false.
전체 목록에 1건/좌표 없는 목록에 0건이면 공개 승인 위치 판정으로 제외된 것이다.
전체 목록부터 0건이면 인증 성공 이후 지역 문서 집합/저장 canonical 확인이 필요하며,
이 결과만으로 문서가 삭제됐다고 단정하지 않는다. 2건 이상이면 중복 조사 대상으로 중단한다.
404이면 API 배포/라우팅을 확인한다. 실패 시 자동 재시도·복원·수정을 하지 않는다.

## 검증

- Client 전체 581개 통과. 실제 AdminPage DOM 1440/390에서 JWT 전용 요청,
  가조→합천→옥천·뒤로가기·resize·오래된 응답 폐기 검증.
- 로그인 없음(legacy 토큰이 있어도 fallback 금지), 조회 중, 401, 403,
  네트워크 오류, JSON 오류, 잘못된 목록 형식, 200 빈 목록, 유성가든 표시,
  로그아웃 시 사적 목록 제거 검증.
- 서버 전체 112 suites / 1122 tests 통과. 격리 fixture HTTP에서 합천
  REGIONAL_MANAGER JWT GET missingOnly=true에 유성가든 정확히 1건,
  canWrite=true/mapVisible=false, DB writes=0. 잘못된 JWT 401,
  타 지역 읽기/변경 403 및 기존 legacy API 회귀 통과.
- Windows 실제 브라우저 로컬 Copilot fixture 1440×900, 390×844:
  추가 위치 토큰 입력 없음, 합천 유지, GET/Bearer만 사용, 유성가든 목록 표시,
  가로 넘침 없음. 지도 공개 승인/제안/반려/복원 요청은 하지 않음.
- 서버/Client 빌드 및 git diff --check 통과.
- 운영 인증 목록 응답은 위 한계로 미확인. push·배포·운영 DB 쓰기 미수행.

이 기능은 검증된 현장정보를 공급하는 Regional Data Manager 기능이다.
상황 발생 시 선제 REPLAN 카드와 ACTION으로 연결하는 접수번호 33 완료 기준은 별도다.
