# 접수번호 32 최신 main 통합 검증

검증일: 2026-09-06. 운영 변경 없이 로컬 통합/테스트/빌드만 수행했다.

## 원격과 계보

- `git fetch origin` 후 origin/main: `b7c76a81e370e6092c2c4e16061bc5593248a36a`.
- SSH 읽기 전용 확인 운영 checkout도 같은 HEAD, main, clean.
- local main: `0aefe28d3173815fe80883d2431264b1c7974fd6`, 변경하지 않았다.
- local main 대 origin/main: ahead 0 / behind 80. 운영 대 origin/main: 0 / 0.
- 운영의 80개 커밋 모두 origin/main 및 통합 브랜치의 조상이다.
- 기존 승인 브랜치 `codex/receipt32-final-identity-safety` HEAD `915cb626c430a0a30a5b24e88ee8f8bef9e7ee08`도 유지했다.
- 로컬 worktree는 한 개이며 통합 브랜치를 checkout했다. checkout하지 않은 브랜치에 별도 작업 트리는 없다.

## 순서대로 cherry-pick

통합 브랜치: `codex/receipt32-main-integration`.

| 승인 커밋 | 통합 커밋 | 직접 부모 |
|---|---|---|
| 87cf963be34bfa432ed696f9ad5770bb6d383e34 | 3b3ecf9839cdc7503e39ff0dc5948fa9dfa13b67 | b7c76a81e370e6092c2c4e16061bc5593248a36a |
| 893b16ce4a6b4f9222b6d58d4e62e06c4d4d98c0 | 982488dd5c8352526a50e2f35ea13767f5a85b34 | 3b3ecf9839cdc7503e39ff0dc5948fa9dfa13b67 |
| 915cb626c430a0a30a5b24e88ee8f8bef9e7ee08 | 6475adf9e51b81e0e2c253b4fa7d7750bdb7b5d5 | 982488dd5c8352526a50e2f35ea13767f5a85b34 |

충돌 없음. RegionalDataManager.tsx 자동 병합 후 실제 양쪽 diff를 검토했다.
운영 80개 커밋의 변경 파일 73개와 통합 변경의 교집합은 이 파일 하나다.
운영의 한국어 상태/유형 표시, regionalActionError, initialRegionId 및 지역 전환 초기화,
BusinessRegistrationManager 경로는 보존했다. 그 밖의 운영 변경 파일과 지역 데이터는 origin/main과 동일하다.
통합 승인 변경은 19개 파일, +824/-52이며 추가 검증 커밋은 테스트 2개 파일과 이 보고서만 변경한다.

## 인증 및 API 호환성

- 기존 Legacy 관리자 계약인 `ADMIN_WRITE_TOKEN` / `x-admin-token` 및 sessionStorage의 `admin-write-token`을 그대로 사용한다.
- 새로 보호한 목록과 operational-readiness는 무인증/잘못된 토큰 403, 기존 토큰 200을 HTTP 테스트로 검증했다.
- 목록 응답의 records/quality 구조 및 proposedFacts를 유지한다. Legacy 상세는 선택한 records 항목을 표시하므로 별도 상세 API 규약 변경은 없다.
- `fetchRegionalData`의 유일한 호출자인 RegionalDataManager가 토큰을 전달한다. 나머지 기존 인자 및 API 호출 규약은 유지한다.
- Copilot 로그인은 별개의 Bearer JWT 체계다. 관련 auth/service/controller/Client 코드는 origin/main 대비 변경하지 않았다.
  로그인, 할당 지역 권한, 상세 조회 및 승인 흐름의 기존 테스트와 지역 권한 matrix가 통과했다.
- JWT만으로 Legacy 관리자 토큰 경로를 사용할 수는 없다. 기존 쓰기 토큰을 가진 관리자는 호환되지만,
  이전에 익명 조회하던 외부 소비자는 이제 토큰을 제공해야 한다.
- Legacy AdminTokenGuard는 공용 운영 토큰 모델이며 allowedRegionIds를 principal에 넣지만 목록 필터에 지역 권한을 강제하지 않는다.
  이는 기존 권한 구조의 한계이며 지역별 JWT 권한은 Copilot 경로에서 적용한다. 이번 통합에서 권한 체계를 확장하지 않았다.
- 운영 자격증명으로 새 API를 호출하거나 실제 브라우저 로그인을 수행한 검증은 아니다. 로컬 HTTP 및 코드/테스트 호환성 확인이다.

## 기존 문서와 반복 ingestion

- identityCandidates는 required가 아닌 배열/default []이다. 새 optional 필드가 없는 기존 문서를 실제 Mongoose schema로 hydrate/validate하고,
  서비스 list 및 exact resolver로 읽는 테스트를 추가했다. 기존 원본 문서에 필드를 쓰지 않는다.
- 같은 ID 없는 입력을 3회 제출하면 서로 다른 후보 3건이 생기는 것을 재현했다. 승인 canonical은 byte-equivalent 객체 비교로 불변이다.
- 새 후보는 UNVERIFIED이며 identityCandidates는 승인 canonical을 검토 대상으로 제안할 뿐 자동 병합하지 않는다.
- 현재 create 경로에 중복 제한이 없어 반복 수집이 계속되면 검토 대기열/저장량이 누적될 수 있다. 이를 해결하는 코드는 추가하지 않았다.
- 최소 후속안: canonical ID와 독립된 ingestion request/source record key를 도입하고 regionId + sourceType + source record key에
  unique partial index와 원자 upsert를 적용한다. 동일 요청은 기존 미승인 후보를 반환하고 변경된 관찰은 별도 검토 정책을 적용한다.
  이름 하나를 중복 키로 쓰거나 승인 canonical에 자동 귀속시키지 않는다. 기존 후보 정리와 인덱스 운영 적용은 별도 승인 대상이다.

## 최종 검증

| 항목 | 결과 |
|---|---|
| receipt32/public identity/exact/atomic/admin/Copilot 집중 | 7 suites, 119 tests 통과 |
| 서버 전체 | 108 suites, 1051 tests 통과 |
| Client 전체 | 571 tests 통과 |
| receipt32 스크립트 | 36 tests 통과 |
| 서버 빌드 | 성공 |
| Client 빌드 | 성공 |
| git diff --check (작업 변경 및 origin/main 대비) | 통과 |
| 새 공통 코드의 합천/가조/옥천 전용 분기 검색 | 추가 없음 |

공개/비공개 경계, 가조/합천/옥천 및 미래 지역, 여러 canonical 모호성, 부분 승인 이름 차단,
IGNORE_CHANGE 경쟁 조건/재시도/보호 필드/이웃 문서 불변을 포함한다. 원자성 테스트 DB는 MongoMemoryServer의 격리 fixture다.
스크립트 테스트의 첫 샌드박스 실행은 Node EPERM으로 시작하지 못했으며 승인된 로컬 실행에서 36개 모두 통과했다.
빌드는 Node 22.11.0이 Vite 권장 최소 22.12보다 낮다는 경고, 큰 chunk 및 inlineDynamicImports deprecation 경고를 남겼다.
테스트의 Mongoose validateSync deprecation 경고도 있다. 실패는 없으며 환경/의존성은 변경하지 않았다.

## 승인 전 남은 사항

- push 직전 원격이 이 기준에서 움직였는지 재확인 필요. 현재 기준으로 origin/main에서 통합 HEAD까지 fast-forward 가능한 계보다.
- ID 없는 반복 수집의 후보 누적 위험 수용 또는 별도 idempotency 작업 승인 필요.
- 서버/Client 동시 배포 및 관리자 토큰 제공 확인 필요. 새 서버만 배포하면 옛 Client 목록 조회가 403일 수 있다.
- 배포 후 관리자 UI/login smoke test와 런타임 버전 확인은 별도 운영 승인 후 수행한다.
- push, 운영 배포, 실제 IGNORE_CHANGE 및 DB 작업은 각각 별도 승인 대상이다. 이번에는 수행하지 않았다.
- 유성가든 데이터는 변경하지 않았으며 기존 후속 작업 문서를 유지한다.
