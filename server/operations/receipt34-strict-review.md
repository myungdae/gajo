# 접수번호 34 엄격 재검토

검토 대상: `5a5c214267944789b9207913c1aab9b700d105a4..9c0e029f05b03210a3ac38c18a72bc59033a9eea`의 실제 diff와 후속 수정. 운영 DB 조회·변경 없이 저장소의 운영 코드, 공인 데이터 및 격리 fixture를 검증했다. 아래 장소 수는 운영 DB 실측값이 아니다.

## 발견과 수정

1. 첫 위치 제안 전에는 `getFacility`의 지역 문서 조회가 적용되지 않아, 시설 materialization이 없는 장소가 상세 API에서 누락될 수 있었다. 기존 지역 문서를 공통 public projection으로 조회해 검색·상세·전화가 위치 제안 전에도 유지되게 했다.
2. 기존 공인 dataset에는 공개 좌표가 있지만 mutable 문서는 PARTIAL/UNVERIFIED인 경우, 첫 제안의 승인 스냅샷이 빈 상태가 될 수 있었다. 공개 dataset의 기존 위치를 별도 호환 규칙으로 고정한다. 미승인 raw 좌표는 승계하지 않는다.
3. 좌표 필드에 개별 승인 근거가 있는데 첫 제안에서 장소 전체 출처로 대체될 수 있었다. `APPROVED_COORDINATE_FIELD`의 source와 observedAt 등 기존 evidence를 스냅샷에 보존한다. 없는 출처를 임의로 만들지 않는다.
4. bounds 일부 필드 누락이나 역전된 범위를 유효 경계로 판단할 수 있었다. 네 경계의 유한 숫자·순서·지구 범위를 검증하고 불완전한 설정은 승인을 차단한다.
5. 중복 경고가 mutable 문서만 확인했다. 공통 public dataset의 기존 장소도 포함해 review 문서가 없는 공인 장소와 겹치는 경우 경고한다.
6. 오래된 복원 정보만 남아도 복원 버튼이 표시됐다. 서버가 실제 승인 직후 전체 문서·버전 조건으로 복원 가능 여부를 계산하고, 이후 수정 시 새 검토 안내를 표시한다.
7. 승인 직전 공개 영향·복원 범위 안내가 부족했다. 이름·별칭·식별자·주소·전화의 독립성, 기존 위치 유지, 승인 이후 수정 시 복원 불가, 다른 장소 및 감사 이력 유지 안내를 추가했다.
8. Client DOM 테스트가 lazy 지도 로딩 완료 전에 버튼을 찾을 수 있었다. 단순 한 tick 대기 대신 실제 버튼이 나타나는 조건을 제한 시간 안에서 확인한다.

## 기존 좌표 하위 호환 규칙

모든 경로에서 유한 숫자, 위도 -90~90·경도 -180~180이며 0,0이 아닌 좌표만 유효하다.

| 상태 | 승인 근거와 공개 규칙 |
| --- | --- |
| `approvedLocation` 있음 | 이 스냅샷의 유효 좌표와 APPROVED 상태만 사용. 없거나 미승인인 스냅샷을 raw 좌표로 우회하지 않는다. |
| 기존 RDM 좌표 필드 APPROVED | 기존 `fieldEvidence.coordinates.status=APPROVED` 계약으로 현재 좌표 유지. 첫 제안 시 좌표별 출처·관측 기록을 승계한다. |
| 기존 RDM 현재 사실 VERIFIED | 기존 일반 승인 코드가 sourceType·sourceUrl 검증 후 저장하던 `verificationStatus=VERIFIED` 계약으로 현재 좌표 유지. `approvedLocation` 부재 자체는 미노출 사유가 아니다. |
| 기존 공인 dataset의 공개 위치 | 공통 public projection의 동일 canonical navigate만 승계한다. 가조의 좌표 provenance VERIFIED, 합천·옥천의 공인 dataset source 및 기존 공개 계약을 유지한다. raw 문서가 PARTIAL이라고 공인 공개 위치를 지우지 않는다. |
| 위 승인 근거 없이 숫자만 존재 | 미승인. 후보·핀·PROPOSED evidence·proposedFacts에서 공개 좌표를 가져오지 않는다. |

기존 위치를 승계하는 동작은 새 위치 승인이 아니다. 첫 제안은 기존 공개 스냅샷을 고정하고 별도 locationReview에 새 위치를 저장한다. 이름과 lifecycle 등 기존 공개 제한, unsafe 변경의 지도 차단은 유지된다. 좌표 승인이 이름·별칭·canonical identity를 승인하지 않는다.

## 상태표

`A`는 승인 전 기존 공개 위치(없을 수 있음), `B`는 제안 위치다.

| 상태 | 관리자 | 공개 검색·상세·전화 | 공개 좌표·지도·거리·길찾기 |
| --- | --- | --- | --- |
| 제안 전 | 현재 위치·미확인 사유, 보완 행동 | 기존 기능 유지 | A만 사용, A가 없으면 제한 |
| 주소 후보·핀 조정 | 로컬 draft, 자동 저장·승인 없음 | 유지 | A 유지 |
| PROPOSED | 출처·제안자·사유·좌표·제안 시각·상태 | 유지, 제안 원문 미포함 | A 유지, B 미노출 |
| APPROVED | 검토자·시각·감사기록 | 같은 canonical·대표명 유지 | B 사용. 별도 공개 제한은 그대로 적용 |
| REJECTED | 거절 근거와 제안 이력 보존 | 유지 | A 유지 |
| RESTORED | 복원 actor·사유·이력 보존 | 유지 | 승인 직전 A로 복원. A가 없으면 다시 제한 |
| 승인 후 다른 변경 발생 | 직접 복원 불가, 새 검토 안내 | 현재 정상 상태 유지 | 자동 복원·재시도 없음 |

반려 또는 새 제안도 승인 이후 변경에 해당한다. 이전 승인에 대한 복원은 해당 승인 직후 문서가 그대로일 때만 가능하다. 복원은 좌표 관련 필드만 되돌리며 이름·다른 문서·감사기록을 되감지 않는다.

## 공개 API와 장소 수

공개 `/api/facilities`, `/api/facilities/:uri`, `/api/operational-places`를 HTTP 수준에서 검증했다. 유성가든 fixture는 처음부터 같은 canonical 한 건이며 실제 좌표가 아니다. 검색·전화·상세는 전 상태에 유지되고, proposal/rollback/제안자 원문은 공개 응답에 없다. 거리 계산은 PlaceDiscovery의 실제 서비스 결과로 검증했다.

| 저장소 공인 데이터 기준 | 도입 전 | 도입 후 읽기 | 기존 장소의 제안 중·반려 후 |
| --- | ---: | ---: | ---: |
| 가조 operational places | 2 | 2 | 2 |
| 합천 operational places | 13 | 13 | 13 |
| 옥천 operational places | 1 | 1 | 1 |

수뿐 아니라 canonical 집합과 좌표를 동일하게 비교한다. 이 테스트는 기존 bootstrap 형태를 메모리에서 구성하며 실제 재시드하지 않는다.

| 유성가든 격리 HTTP fixture | 초기·제안 중 | 승인 | 복원·반려 |
| --- | --- | --- | --- |
| 동일 canonical 시설 결과 | 1 | 1 | 1 |
| 상세·전화·검색 | 가능 | 가능 | 가능 |
| 대상 지도 결과 | 0 | 1 | 0 |
| 합천 전체 operational places | 13 | 14 | 13 |
| 대상 거리·navigate | 없음 | 있음 | 없음 |

## 권한·경쟁 변경·감사

- 최종 승인자는 기존 정책의 해당 지역 REGIONAL_MANAGER 또는 PLATFORM_ADMIN이다. 기존 x-admin-token도 ADMIN_REGION_IDS 범위 안에서 가능하다. VIEWER는 조회만 가능하다. 제안자·승인자 분리를 강제하는 별도 정책은 현재 없다.
- 잘못된 토큰·무인증·다른 지역·VIEWER 쓰기는 HTTP에서 차단한다. 다른 지역 ID를 추측해도 현재 지역 query와 함께 일치하지 않으면 접근할 수 없다.
- 동일 requestId와 동일 actor/payload는 중복 쓰기 없이 현재 결과를 반환한다. 같은 좌표라도 새 ID로 검토 대기 제안을 중복 생성하지 않는다. 반려 후 최신 precondition과 새 ID로 같은 좌표를 재검토할 수 있다.
- 동시 승인·반려는 정확히 하나만 성공하고 다른 요청은 409다. 전체 BSON equality CAS와 __v 검사, 한 문서 findOneAndUpdate, upsert false를 유지한다.
- 감사기록은 action, actorId, reason, before/after, locationRequestId, at, canonicalEntityId, reviewedLocation 및 fingerprint를 가진다. reviewedLocation에 sourceType/sourceReference/proposedBy/proposedAt/reason/좌표가 보존된다. 승인·반려·복원 및 동일 요청 재전송을 검증한다.

## 제품상의 위치와 남은 확인

이번 기능은 **검증된 현장정보를 공급하는 Regional Data Manager 기반 기능**이다. 이것만으로 ‘찾아오는 여행도우미’가 완성된 것은 아니다. 날씨·보행·남은 시간 같은 상황이 발생했을 때 **REPLAN 카드가 먼저 나타나고 ACTION으로 연결되는 기능은 접수번호 33의 별도 완료 기준**으로 남긴다.

운영 전에는 실제 문서 상태·장소 수, 지역 bounds, geocoding 키·쿼터·지도 네트워크와 현장 좌표를 확인해야 한다. 현재 경계는 기존 사각 bounds이며 법정 행정구역 polygon이 아니다. 운영 데이터 실측·외부 geocoding 실호출은 이번 검토에 포함하지 않았다. 운영 push·배포·DB 쓰기·재시드는 수행하지 않았다.

## 최종 검증과 변경 파일

| 검증 | 결과 |
| --- | --- |
| 집중 위치 계약·격리 MongoDB | 54/54 통과 (기존 36건에서 18건 추가) |
| 서버 전체 | 111 suites, 1,119/1,119 통과 |
| Client 전체 | 578/578 통과; 기존 DOM 테스트에 행동 안내·승인 영향·복원 범위 검증 추가 |
| 서버·Client 빌드 | 통과 |
| git diff --check | 통과 |
| 실제 모바일 UI | 격리 HTTP fixture의 390px viewport에서 안내·검토 결정 확인. 가로 넘침 없음 |

서버 빌드의 선택적 bounds 타입 오류를 명시적 존재 검사로 수정하고 빌드·집중 계약을 다시 통과했다. Client는 기존 Node 22.11/Vite 권장 버전 및 inlineDynamicImports 폐기 예정 경고가 남아 있다. 의존성·운영 런타임은 바꾸지 않았다.

후속 로컬 커밋의 직접 부모는 `9c0e029f05b03210a3ac38c18a72bc59033a9eea`이며, 그 부모는 기준 main `5a5c214267944789b9207913c1aab9b700d105a4`다.

변경 파일: 서버의 `location-review.policy.ts`, `location-review.service.ts`, `location-review.controller.ts`, `location-review.spec.ts`, `location-review.integration.spec.ts`, `regional-data.service.ts`, `facility.service.ts`; Client의 `LocationReviewManager.tsx`, `locationReviewManager.test.mjs`; 운영 문서 `receipt34-location-review.md`, `receipt34-strict-review.md`.
