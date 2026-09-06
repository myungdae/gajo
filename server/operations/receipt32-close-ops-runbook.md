# Receipt 32: single-script close operations

이 문서는 `server/scripts/receipt32-close-ops.mjs`의 운영 명령이다. 기존 준비서의 인라인 코드를 대체한다. 로컬 코드/fixture 검증이며 운영 배포·DB 쓰기 승인이 아니다. 이번 작업에서 push, 운영 pull/build/restart, 운영 DB 연결, 실제 action은 실행하지 않는다.

고정 대상: `_id=6a851cbab346fbf150ee371f`, service ID `seed-hapcheon-garden-theme-park`, region `hapcheon`, canonical `https://hapcheon.example/ontology#hapcheonGardenThemePark`. 대상 인수나 collection/DB/output 경로 변경 옵션은 없다. 영상테마파크·황매산 억새축제·씨파크는 해시 불변 검증 대상이다.

## 운영 세션 준비

별도로 승인된 코드 전달 이후 `/var/www/gajo`의 Bash에서 준비한다. 승인된 **스크립트가 포함된 checkout commit**과 **기존 API 이미지 content digest**를 입력한다. 두 값은 비밀정보가 아니다. digest는 `docker inspect ... .Image`의 `sha256:...` 형식이며 registry `RepoDigest`와 구별한다. 스크립트는 이 값을 manifest에 고정하고 모든 후속 단계에서 동일성을 요구한다. 컨테이너에는 Docker socket이나 Git을 제공하지 않으므로, 실제 HEAD/digest 검증은 아래 실행 함수가 호스트에서 수행하고 스크립트는 전달값의 형식·승인값·manifest 일치를 검증한다.

```bash
set -euo pipefail
set +x
umask 077
cd /var/www/gajo
read -r -p 'Approved checkout commit (40 hex): ' R32_EXPECTED_HEAD
read -r -p 'Approved API image content digest (sha256:...): ' R32_EXPECTED_IMAGE
export R32_EXPECTED_HEAD R32_EXPECTED_IMAGE
test ! -L server/.maintenance-private/receipt32
install -d -m 0700 -- server/.maintenance-private/receipt32
test "$(stat -c %a server/.maintenance-private/receipt32)" = 700

r32() {
  test "$(pwd -P)" = /var/www/gajo || return 1
  test -z "$(git status --porcelain=v1)" || return 1
  export R32_HEAD="$(git rev-parse HEAD)"
  test "$R32_HEAD" = "$R32_EXPECTED_HEAD" || return 1
  local api_id project
  api_id=$(docker compose ps -q api)
  test -n "$api_id" || return 1
  test "$(docker inspect -f '{{.State.Health.Status}}' "$api_id")" = healthy || return 1
  export R32_IMAGE="$(docker inspect -f '{{.Image}}' "$api_id")"
  test "$R32_IMAGE" = "$R32_EXPECTED_IMAGE" || return 1
  project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$api_id")
  test "$(docker image inspect -f '{{.Id}}' "${project}-api")" = "$R32_IMAGE" || return 1
  docker compose run --rm --no-deps -T -e R32_HEAD -e R32_EXPECTED_HEAD -e R32_IMAGE -e R32_EXPECTED_IMAGE -e R32_APPROVED -v "$PWD/server/scripts:/app/scripts:ro" -v "$PWD/server/.maintenance-private/receipt32:/app/.maintenance-private/receipt32:rw" -w /app api node scripts/receipt32-close-ops.mjs --mode "$1"
}
```

이 checkout의 Compose `api`는 별도 `image:`가 없는 build 서비스이므로 `${project}-api` 로컬 태그를 검사한다. Compose override로 이미지 선택 방식을 바꾼 환경에는 이 절차를 그대로 적용하지 않는다. 태그/실행 digest/HEAD가 다르거나 이미지가 없으면 중단하며, build/pull/up/restart로 해결하지 않는다. 운영자는 명령 실행 사이에 Compose 설정·이미지 태그를 변경하지 않는다. 함수는 DB 환경변수와 토큰을 출력하지 않는다. `docker compose config` 전체 출력이나 `.env` 출력은 하지 않는다.

`run --no-deps`는 이미지를 사용하는 일회성 Node 프로세스만 만든다. Nest bootstrap을 호출하지 않고 실행 중 API/Client/Mongo를 재시작하지 않는다. 승인값은 모드별 명령에만 지정한다. `R32_APPROVED`를 세션 전체에 export하지 않는다. 명령이 실패하면 그 자리에서 STOP한다.

## 모드별 정확한 한 줄 명령

위 20줄 실행 함수를 한 번 정의한 후 아래 명령을 각각 사용한다. 함수 안의 최종 줄이 사용자가 요청한 Docker one-off 명령이며, 모드만 바뀐다.

| 모드 | 한 줄 명령 | 구분 | 정상 기대 결과 | 중단 조건 |
|---|---|---|---|---|
| read | `r32 read` | DB 읽기 | 세 canonical 문서의 허용된 요약·전체/보호 해시 | 고정 대상/이웃 0·2건, 중복 service/canonical, 읽기 오류 |
| capture | `r32 capture` | DB 읽기·백업 파일 생성 | typed EJSON 한 건, manifest, 체크섬; `backupVerified=true` | 상태/인덱스/대상 수 부적합, 채집 중 변경, 기존 디렉터리/파일 존재 |
| check | `r32 check` | DB 읽기 | `IGNORE_CHANGE_DRY_RUN`, `valid=true` | 원본/파일/manifest/현재 문서/비대상 해시 불일치 |
| preflight | `r32 preflight` | DB·API 읽기·request 파일 생성 | API hash/version=백업, 고정 requestId 저장 | stale precondition, 기존 request.json, HTTP 실패 |
| apply | `R32_APPROVED=IGNORE_CHANGE_RECEIPT32 r32 apply` | **정원 한 문서 운영 쓰기** | 같은 `_id` 반환, requestId 감사 1건, V+1 | 승인 누락/오류, 재검증 실패, HTTP 409/오류/timeout |
| post | `r32 post` | DB 읽기·검증 파일 생성 | `verified=true`, target/이웃/전체 비대상 불변, 복원 manifest 생성 | 보호 필드/감사/버전/시각/이웃/다른 문서 변경, 기존 post 파일 |
| public | `r32 public` | **HTTP GET만**, DB 연결 없음 | 공개 facilities의 영상·정원·씨파크 각각 canonical/표시명 1건 | HTTP 실패, 누락·중복·명칭 불일치 |
| restore-dry | `r32 restore-dry` | DB 읽기 | `RESTORE_DRY_RUN`, `valid=true` | post manifest 없음, post 해시/버전·보호 사실·비대상 불일치 |
| restore-apply | `R32_APPROVED=RESTORE_RECEIPT32 r32 restore-apply` | **정원 한 문서 복원 쓰기** | 한 문서 반환, 세 검토 필드 복원, 이력 보존·복원 감사 추가 | 승인 누락/오류, full BSON CAS 0건, 후속 검증 실패 |

실행 순서: `read → capture → check → preflight`. 운영 적용이 별도로 승인된 경우에만 `apply → post → public`. 복원은 자동으로 호출하지 않으며 별도 결정 시에만 `restore-dry → restore-apply`.

함수 없이 직접 실행할 때도 같은 환경변수 전달이 필요하다. 아래 예는 `read`의 완전한 한 줄 명령이다. 호스트 HEAD/digest 검증을 생략할 목적으로 사용하지 않는다.

```bash
docker compose run --rm --no-deps -T -e R32_HEAD -e R32_EXPECTED_HEAD -e R32_IMAGE -e R32_EXPECTED_IMAGE -e R32_APPROVED -v "$PWD/server/scripts:/app/scripts:ro" -v "$PWD/server/.maintenance-private/receipt32:/app/.maintenance-private/receipt32:rw" -w /app api node scripts/receipt32-close-ops.mjs --mode read
```

## 백업과 안전 계약

- 저장 경로: `server/.maintenance-private/receipt32/close-c0bf34b/`. 이 이름은 기존 준비서와 같은 고정 경로이며 새 checkout HEAD는 manifest에 별도로 저장한다. 이전 디렉터리가 있으면 중단한다. 자동 삭제/덮어쓰기/다른 경로 우회는 없다.
- 부모·백업 디렉터리 0700, 파일 0600. Linux 운영 CLI는 `/app`에서 실행한다. 기존 symlink 파일/디렉터리를 거부한다. Windows fixture 파일 테스트는 POSIX 권한 검증을 적용할 수 없으며 운영 권한 증거를 대신하지 않는다.
- 정원 원문만 `garden-pre-image.ejson`에 `EJSON.stringify(..., {relaxed:false})`로 저장한다. BSON ObjectId/Date/숫자 타입을 보존하고 파일 SHA-256·EJSON roundtrip SHA-256·`__v`를 검증한다.
- `garden-ignore-manifest.json`: collection, 고정 identity, checkout HEAD, 실행 이미지 digest, capture 시각, pre hash/version, 보호 필드 해시, 영상/축제/씨파크 및 비대상 해시 기준.
- `SHA256SUMS`, `three-documents-before.json`, `other-documents-hashes.json`은 원본을 노출하지 않고 검증 증거를 저장한다. 다른 애플리케이션 컬렉션은 문서 원문 대신 ID 해시·문서 해시만 보관한다.
- 출력 허용: 고정 식별자, 표시명, lifecycle/verification, proposedFacts/detectedChanges 존재·개수, 버전·시각·해시·성공 여부. 토큰/URI/주소·전화/제안 원문/감사 원문/HTTP 응답 원문/오류 stack은 출력하지 않는다. 오류는 일반화된 `STOP`과 종료 코드 1이다.

파일 검증 한 줄 명령(읽기 전용):

```bash
(cd /var/www/gajo/server/.maintenance-private/receipt32/close-c0bf34b && sha256sum -c SHA256SUMS)
```

### 적용과 전후 비교

`apply`는 저장된 request.json의 hash/version과 백업 및 현재 문서가 같은지 다시 확인한 뒤 기존 admin HTTP domain action을 한 번 호출한다. `IGNORE_CHANGE`는 전체 BSON equality `$expr: {$eq: ['$$ROOT', {$literal: captured}]}`와 `_id`, service ID, 버전, lifecycle/verification을 조건으로 단일 `findOneAndUpdate`를 실행한다. upsert/multi는 사용하지 않는다. 새 필드 추가 등 버전을 올리지 않은 경쟁 쓰기도 충돌한다.

성공 after: lifecycle ACTIVE, proposedFacts 필드 제거, detectedChanges `[]`, 감사 이력 보존 + IGNORE_CHANGE 정확히 1건, `__v=V+1`, updatedAt=감사 시각. canonical/대표명/주소·전화·좌표/verification VERIFIED 등 여섯 허용 필드 외 전체 필드는 불변이다. 보호 해시는 새 필드 추가도 탐지한다.

HTTP는 matchedCount를 반환하지 않는다. 유일한 정원 `_id`의 non-null 반환, 해당 requestId audit 1건과 V+1 확인 후 `post`가 전체 계약을 검증한다. `post`는 audit actor/hash/version/source/changes/result/conflict/시각 및 기존 이력 보존도 확인한다. 성공할 때만 `garden-restore-manifest.json`과 `three-documents-after.json`을 독점 생성한다.

모든 비대상 문서의 ID·내용 해시를 비교하므로 다른 정상 업무 쓰기도 STOP 원인이 된다. 단독 MongoDB의 다중 컬렉션 읽기는 한 시점의 snapshot이 아니다. 차이를 이번 action 탓으로 단정하지 않으며, 자동 재시도·precondition 갱신·문서 복원·삭제·병합을 하지 않는다. 다른 프로세스를 중지하거나 서비스를 재시작하지 않는다.

409/timeout/5xx이면 즉시 STOP. timeout은 미적용을 의미하지 않는다. 저장된 requestId와 `post`로 상태를 확인하고 적용 명령을 맹목적으로 다시 실행하지 않는다. domain API 자체의 idempotency가 있어도 이 스크립트는 자동 재전송하지 않는다. 기존 request/post 파일을 덮어쓰지 않으므로 해당 저장 모드 재실행도 STOP한다.

### 복원

복원은 기존 `planReceipt32Restore`의 고정 target/post hash/version/이웃 조건을 검증한다. 실제 갱신에는 전체 BSON equality와 `_id`/service ID/버전을 함께 사용한다. lifecycle/proposedFacts/detectedChanges만 pre-image로 복원하고 `RESTORE_IGNORE_CHANGE`를 추가하며 `__v`와 updatedAt을 진행시킨다. 기존 감사 이력과 승인 사실을 보존한다. post manifest 누락/불일치 또는 경쟁 변경은 STOP이다. 다른 문서는 복원하지 않는다. 전체 문서 replace/import는 하지 않는다.

복원 후 full hash는 이전 pre-image와 같을 필요가 없다. 감사/버전/시각은 되감지 않기 때문이다.

## 공개 검증 범위

`public`은 `GET http://client/api/facilities?regionId=hapcheon`만 수행하며 DB에 연결하거나 chat을 호출하지 않는다. 영상테마파크/정원테마파크/씨파크가 각기 독립 canonical과 승인된 이름으로 나오는지 확인한다. 이 검사는 실제 자연어 resolver/Client 상호작용의 통과 증거가 아니다. chat은 문맥 기록 쓰기를 유발하므로 이번 범위에서 실행하지 않는다.

## 로컬 fixture 검증

```bash
cd server
node --test scripts/receipt32-close-ops.test.mjs
```

실제 MongoDB나 HTTP 서버를 시작하지 않는다. 현재 domain TypeScript 소스를 메모리에서 컴파일해 승인/preflight/IGNORE_CHANGE를 fixture에 적용하고 전체 BSON CAS 경쟁 변경을 검증한다. 파일 권한·독점 생성은 임시 디렉터리에서만 검사한다. 운영 스크립트를 운영 환경변수로 실행하는 테스트는 없다.
