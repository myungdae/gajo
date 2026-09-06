# 접수번호 34 — Windows 관리자 지역 범위 수정

## 원인과 수정

기존 Windows 브라우저 관리자 화면에는 지역의 기준이 두 개 있었다. 상단 제목·위치 관리·Spotlight는 `RegionContext`의 URL 지역을 사용했지만, 기존 데이터 검수의 지역 선택기는 내부 filters.regionId만 변경했다. 이 때문에 같은 화면에 다른 지역이 공존할 수 있었다. 화면 너비가 직접 원인은 아니었다.

- 관리 지역 선택기를 관리자 상단으로 통합한다. 선택하면 기존 라우팅 함수로 `/{regionId}/admin`에 이동한다. 가조도 명시적 `/gajo/admin`을 사용해 호스트·query fallback과 충돌하지 않는다.
- URL → RegionContext → 관리자 제목·위치 관리·검수·연결·Spotlight를 동일한 기준으로 사용한다. 검수 패널은 자체 지역 state를 갖지 않는다. 상태·유형·검증 필터만 지역 안에서 변경한다.
- 지역 전환 시 데이터 검수, Spotlight 및 지역 이용 통계의 state를 지역별 key로 초기화한다. 이전 지역 선택·편집·늦은 응답이 새 지역 화면에 남지 않는다.
- 검수 API는 records와 quality에 같은 query.regionId를 전달한다. 목록은 한 지역인데 KPI만 전체 지역 합계였던 불일치를 수정한다.
- 기존 별도 공통 운영 대시보드와 legacy 이벤트 통계는 원래의 참고 집계이며 관리 지역을 결정하는 입력으로 사용하지 않는다. 이번 수정 대상 KPI는 지역 데이터 검수 패널의 수치다.
- viewport, user-agent, 모바일 여부로 지역을 결정하는 분기를 추가하지 않았다. 화면 크기는 배치에만 영향을 준다. 기존 서버 인증·권한 정책은 변경하지 않았다.

## 검증

실제 App·Layout·AdminPage·RegionProvider를 렌더링하고 API를 격리 fixture로 대체한 Windows 브라우저에서 검증했다. 운영 URL·실제 운영 데이터에 연결하지 않았다.

| 조건 | 확인 결과 |
| --- | --- |
| Windows 데스크톱 1440×900 | 가조→합천→옥천의 URL, 제목, 위치 목록, 검수 표시, Spotlight 및 요청 regionId 일치 |
| 390×844 모바일 viewport | 같은 관리자 컴포넌트에서 옥천→합천 전환 시 동일한 범위 전달 |
| 1440→390 크기 변경 | `/okcheon/admin`과 옥천 scope 그대로 유지 |
| 390→1440 크기 변경 | `/hapcheon/admin`과 합천 scope 그대로 유지 |
| 뒤로 가기 및 이전 응답 지연 | 이전 지역 화면 데이터가 현재 지역에 나타나지 않음 (DOM 회귀 테스트) |

`adminRegionScope.test.mjs`는 실제 관리자 컴포넌트·라우터·API 클라이언트를 사용해 두 너비, 가조·합천·옥천 전환, 뒤로 가기, 선택 초기화, 지연 응답, 쓰기 없음, 요청 scope를 확인한다. `regional-data-scope.spec.ts`는 세 지역의 목록과 KPI가 다른 지역 문서를 포함하지 않는지 확인한다.

이번 수정은 로컬 코드·테스트만 적용했다. Git push, 운영 배포 및 운영 DB 쓰기는 수행하지 않았다. 사용자에게 보고된 운영 URL과 실제 지역 조합은 제공되지 않아 운영 화면 자체의 재현 완료를 주장하지 않는다.

최종 검증: 집중 Client 2건·서버 3건 통과, Client 전체 580건 통과, 서버 전체 112 suites·1,122건 통과, 서버·Client 빌드 및 git diff --check 통과. 서버의 기존 QR 생성 테스트가 30초 제한을 넘어 전체 테스트를 `--runInBand --testTimeout=60000`으로 재실행해 통과했다. Client의 기존 Node/Vite 권장 버전·inlineDynamicImports 경고는 유지된다.
