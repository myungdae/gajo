# 접수번호 34 — 장소 위치정보 검토

기준 main: `5a5c214267944789b9207913c1aab9b700d105a4`. 구현 브랜치: `codex/receipt34-location-review`.
이 작업은 코드·격리 fixture 검증만 수행한다. 운영 데이터 변경, 재시드, 신규 장소 생성, Git push 및 운영 배포는 수행하지 않는다.

## 구조와 공개 계약

- 공통 `LocationReviewService`와 정책을 Admin 및 Copilot 컨트롤러에서 공유한다. 지역별 업무 로직이나 유성가든 하드코딩은 없다.
- `locationReview`는 latitude, longitude, normalizedAddress, sourceType, sourceReference, proposedBy, proposedAt, reason, verificationStatus 및 검토자·검토 시각을 보관한다. 제안자와 시각은 서버가 정한다.
- `approvedLocation`은 공개 좌표 스냅샷이다. 첫 제안 시 기존 승인 좌표를 고정하고, 승인 좌표가 없으면 UNVERIFIED 상태를 고정한다. 이후 기존 일반 편집에서 평면 latitude/longitude를 바꾸더라도 공개 스냅샷을 바꾸지 않는다.
- 공개 dataset과 facility/operational places는 승인 스냅샷만 사용한다. 가조의 기존 시설 메타데이터는 유지하면서 동일한 위치 계약을 적용한다. 승인 전에는 검색·전화·상세를 보존하고 지도·거리·가까운 곳·navigate에 제안을 사용하지 않는다.
- canonical ID, 대표명, 주소·전화, 다른 문서 및 이름 검토용 proposedFacts는 위치 action에서 변경하지 않는다. normalizedAddress는 위치 근거이며 기존 주소를 자동 교체하지 않는다.
- 위치 제안·복원 정보와 해당 감사 상세는 지역 권한을 검사하는 위치 API로만 제공한다. 기존 지역 권한 없는 목록 응답에는 추가하지 않는다.

## 관리자 사용 흐름

1. Regional Data Manager의 장소 위치정보 관리에서 기존 관리자 토큰을 입력한다. Copilot에서는 기존 로그인과 선택 지역을 사용한다.
2. 기본 목록은 좌표 미확인 장소다. 잘못된 기존 좌표는 필터를 해제해 찾는다. 현재 공개 대표명, DB 이름, 주소·전화, 좌표, 공개 여부·사유, 근거·상태, 수정자를 확인한다.
3. **위치정보 보완** → 주소 기반 후보 확인 → 지도에서 후보 선택·핀 조정 또는 위도·경도 입력 → 출처·변경 사유 → **변경 전·후 비교** → **검토 요청**.
4. 검토자는 저장된 제안, 주소·근거, 지도, 이동 거리와 중복 경고를 확인한다. 검토 사유와 확인 체크 후 **승인** 또는 사유를 입력해 **반려**한다.
5. 잘못된 승인은 **이전 좌표로 조건부 복원**한다. 승인 이후 다른 변경이 있으면 복원은 중단된다. 새 상태를 검토하고 새 위치 제안을 사용한다.

지도 핀 조정과 후보 선택은 로컬 draft만 바꾼다. 저장된 검토 대기 제안을 바꾸려면 먼저 승인 또는 반려해야 한다. 대표명 변경은 기존 이름 검토 action에서 별도로 수행한다. 화면은 600px 이하에서 단일 열로 전환하며 좌표 직접 입력을 지원한다.

## API와 권한

공통 경로는 `/api/admin/locations` 또는 `/api/copilot/locations`이며 모든 요청에 `regionId`가 필요하다.

| 메서드·하위 경로 | 기능 | DB 변경 |
| --- | --- | --- |
| GET `?regionId=…&missingOnly=true` | 목록 | 없음 |
| GET `/:id?regionId=…` | 상세와 최신 hash/version | 없음 |
| POST `/:id/candidates?regionId=…` | 주소 후보 GET 프록시 | 없음 |
| POST `/:id/preview?regionId=…` | 좌표·근거 검증과 경고 | 없음 |
| POST `/:id/actions/PROPOSE?regionId=…` | 위치 검토 요청 | 기존 문서 한 건 |
| POST `/:id/actions/APPROVE?regionId=…` | 승인 | 기존 문서 한 건 |
| POST `/:id/actions/REJECT?regionId=…` | 반려 | 기존 문서 한 건 |
| POST `/:id/actions/RESTORE?regionId=…` | 조건부 복원 | 기존 문서 한 건 |

Admin은 기존 `x-admin-token` 및 `ADMIN_REGION_IDS` 범위를 사용한다. 범위가 비어 있으면 위치 API는 차단된다. Copilot은 기존 JWT, 역할 및 지역 권한을 사용한다. VIEWER는 읽기만 허용한다. 브라우저에서 MongoDB에 직접 연결하거나 수정하는 경로는 없다.

## 승인·반려·복원 계약

모든 action은 상세 응답의 `expectedVersion`, `expectedHash`와 새 `requestId`를 `precondition`으로 보낸다. 서버는 전체 typed BSON hash와 버전을 먼저 비교하고, `_id + regionId + id + __v + 전체 BSON equality` 조건으로 `findOneAndUpdate` 한 번만 실행한다. upsert는 false이며 다중 갱신·다른 문서 복원·삭제·병합은 없다.

- PROPOSE: 필수 출처·사유와 좌표를 검증하고 PROPOSED 상태를 저장한다. 공개 위치는 그대로다.
- APPROVE: 제안이 PROPOSED여야 하며 유효 좌표·지역 경계·명시적 검토 확인·검토 사유가 필요하다. 승인 좌표와 평면 좌표를 함께 갱신한다. 공개 상태나 이름 검토를 우회하지 않는다.
- REJECT: 제안만 REJECTED로 전환한다. 공개 좌표는 유지한다.
- RESTORE: 승인 때 저장한 이전 필드의 존재 여부·값을 복원한다. 승인 직후 문서의 버전과 전체 내용 fingerprint가 그대로일 때만 허용한다. 감사기록은 지우지 않고 복원 이벤트를 추가한다.
- 각 action은 `__v`를 1 올리고 updatedAt 및 감사 이벤트 한 건을 기록한다. 이벤트에는 actor·지역·사유·전후 위치·검토 근거·요청 fingerprint가 들어간다.
- 동일 요청 ID와 동일 actor/payload 재전송은 기존 결과를 반환한다. 같은 ID의 다른 요청은 409다. 동시 재전송에서도 한 번만 반영한다.
- 409 충돌은 자동 재시도하지 않는다. 네트워크 오류는 이미 반영되었을 수 있으므로 UI는 같은 요청 재확인 또는 새로 불러오기를 제공한다.

위도 -90~90, 경도 -180~180의 유한 숫자만 허용하고 빈값·NaN·0,0은 거절한다. 기존 위치에서 1km 초과 이동은 경고한다. 같은 지역의 다른 canonical 장소가 승인 좌표 기준 5m 이내이면 중복 가능성을 표시한다. 중복은 자동 병합하지 않는다. 지역 bounds 밖 또는 경계 미설정은 일반 승인을 차단한다.

## 외부 후보 검색

기존 `KAKAO_REST_API_KEY`를 서버에서만 사용한다. [Kakao 공식 주소 검색 API](https://developers.kakao.com/docs/ko/local/dev-guide)의 주소 후보에서 x를 경도, y를 위도로 변환한다. GET만 사용하고 5초 timeout, redirect 차단을 적용한다. 키·응답 원문을 로그나 사용자 오류에 출력하지 않는다.

미설정·API 실패는 UNAVAILABLE, 후보 없음은 EMPTY, 복수 후보는 MULTIPLE, 주소 단위가 불명확한 후보는 LOW_CONFIDENCE로 표시한다. 모든 후보는 UNVERIFIED이며 자동 승인하지 않는다. 테스트에서는 외부 응답을 mock한다.

## 검증 및 운영 반영 전 확인

- 유성가든은 격리 fixture로만 사용한다. fixture 좌표는 실제 위치를 뜻하지 않는다. 미확인 → 제안 → 승인 → 복원에서 canonical·대표명·전화·검색 유지와 지도·navigate 전환을 검증한다.
- 가조·합천·옥천 공통 공개 경로, 인증 없는 요청·다른 지역 차단, 좌표 범위·경계·중복, full BSON 경쟁 변경, idempotency, 비대상 문서 불변을 테스트한다.
- 실제 MongoMemoryServer 격리 DB에서 승인·복원·경쟁 변경을 확인하며 환경의 DB URI를 사용하지 않는다.
- Client 계약 및 DOM 테스트에서 핀 이동의 무저장, 비교 후 제안, 승인 precondition, 지역 전환 시 이전 응답 폐기를 검증한다.
- 운영 전 지역 bounds 정확성을 확인해야 한다. 현재 bounds는 기존 설정의 사각 범위이며 법정 행정구역 polygon 판정은 아니다. 경계가 없는 지역은 승인 차단 상태다.
- 실제 geocoding 자격증명·쿼터·네트워크, 지도 타일 접근과 현장 위치 정확성은 운영 데이터 반영 전 별도 확인이 필요하다. 기존 승인 좌표는 승계하며 이 기능이 자동으로 재검증하지 않는다.
- 승인 후 다른 정상 변경이 있으면 복원은 의도적으로 중단된다. DB 직접 수정이나 강제 복원으로 우회하지 않는다.

검증 명령: server에서 `npm test -- --runInBand location-review --testTimeout=30000`, `npm test -- --runInBand --testTimeout=30000`, `npm run build`; client에서 `npm test`, `npm run build`; 저장소에서 `git diff --check`.

### 로컬 검증 결과 (2026-09-07)

| 검증 | 결과 |
| --- | --- |
| 위치 집중 계약·격리 MongoDB | 2 suites, 36 tests 통과 |
| 서버 전체 | 111 suites, 1,101 tests 통과 |
| Client 전체 | 578 tests 통과 |
| 서버·Client 빌드 | 모두 통과 |
| 데스크톱·모바일 UI | 격리 HTTP fixture, 1280px 및 390px viewport 검토 화면 확인; 모바일 가로 넘침 없음 |
| git diff --check | 통과 |

초기 병렬 검증에서 서버의 기존 QR 테스트가 30초 timeout, Client가 1건 실패했으며, 재실행에서 모두 통과했다. Client 최초 실패 상세는 잘린 출력으로 원인을 확정하지 못했다. Client 빌드는 현재 로컬 Node 22.11에 대한 Vite 권장 버전 경고(22.12 이상 또는 20.19 이상)와 기존 inlineDynamicImports 폐기 예정 경고를 출력했다. 테스트·빌드 환경의 경고이며 이번 작업에서 런타임이나 의존성을 변경하지 않았다.

### 변경 파일

- 서버 추가: `src/regional-data/location-review.policy.ts`, `location-review.service.ts`, `location-review.controller.ts`, `location-review.spec.ts`, `location-review.integration.spec.ts`.
- 서버 연결·공개 반영: `src/regional-data/regional-data.schema.ts`, `regional-data.module.ts`, `regional-data.service.ts`, `src/copilot/copilot.module.ts`, `src/facility/facility.service.ts`.
- Client 추가: `src/components/LocationReviewManager.tsx`, `LocationPinMap.tsx`, `src/locationReview.ts`, `src/locationReview.test.ts`, `src/locationReviewManager.test.mjs`, `src/location-review.css`.
- Client 연결: `src/components/RegionalDataManager.tsx`, `src/copilot-main.tsx`.
- 운영 설명: `server/operations/receipt34-location-review.md` (이 문서).
