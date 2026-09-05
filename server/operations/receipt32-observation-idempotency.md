# 접수번호 32 검토 후보 원자적 재사용

기준: codex/receipt32-main-integration / 89e305473108e39057bb7ef9e0ed30c15289536c.
origin/main 기준 b7c76a81e370e6092c2c4e16061bc5593248a36a 및 승인된 통합 커밋들을 유지한다.
이 보완은 이전 main-integration-review 보고서의 '후보 반복 누적 미해결' 항목을 대체한다.

## 키와 승인 경계

- 입력은 기존 source 객체에 optional sourceSystem/sourceRecordId를 추가할 수 있다.
- sourceRecordId가 있으면 regionId + sourceType + sourceSystem + sourceRecordId를 SHA-256 계보 키(candidateSourceKey)로 사용한다.
  sourceSystem이 없으면 안정화한 sourceUrl을 대신 사용한다. 외부 ID의 대소문자는 보존한다.
- 외부 ID가 없으면 위 출처/지역과 정규화된 전체 proposedFacts로 계보 키를 만든다.
- candidateFingerprint는 정규화한 전체 proposedFacts의 SHA-256이다. 표시명/주소/전화/좌표/entityType/category 외에도
  영업시간, 설명, 별칭 등 실질적 사실 변경을 포함한다. 객체 키는 정렬하고 문자열은 NFKC/앞뒤 공백 제거/연속 공백 정리,
  전화는 숫자와 +, 문자열 위경도는 숫자로 정규화한다. 근접 좌표 반올림, 유사명 합치기, 국가번호 추정은 하지 않는다.
- sourceUrl은 fragment와 utm_*/fbclid/gclid만 제거하고 query key 순서를 정렬한다. 장소를 구분할 수 있는 나머지 query는 보존한다.
- collectedAt/fetchedAt/ingestedAt/requestedAt/observedAt/requestId/temporaryDocumentId/_id/id/createdAt/updatedAt는
  관측 메타데이터로 제외한다. top-level 수집 메타데이터는 처음부터 키에 포함하지 않는다.
- candidateObservationKey는 계보 키 + 내용 fingerprint의 SHA-256이며 모든 키에 v1 접두사를 둔다.
  따라서 같은 외부 ID라도 내용이 바뀌면 별도 미승인 후보가 생기고 동일 내용 재수집은 같은 후보를 돌려준다.
- 이 키들은 sameIdentity, canonical 선택, 공개 대표명, exact resolver에서 사용하지 않는다.
  명시적 canonical ID ingestion은 기존 경로를 유지한다. ID 없는 새 후보는 임시 urn과 UNVERIFIED 상태로 생성한다.

## 원자성

필수 인덱스 명세:

```javascript
{ key: { regionId: 1, candidateObservationKey: 1 },
  name: 'candidate_observation_v1_unique', unique: true,
  partialFilterExpression: { candidateObservationKey: { $type: 'string' } } }
```

- ID 없는 입력은 listIndexes로 실제 unique/key/partial/collation 계약을 확인한다. 미설치/다른 명세면 중단한다.
  코드에서 운영 인덱스를 자동 생성하지 않는다. 기존 app 설정 autoIndex:false/autoCreate:false를 유지한다.
- 기존 관측 키를 원자 findOneAndUpdate로 재사용한다. 없으면 승인 identity 제안/모호성 검사를 거쳐 동일 키로 원자 upsert한다.
  사전 조회에 의존한 create는 사용하지 않는다. 동시 insert unique 충돌은 동일 키의 non-upsert 갱신으로 제한하여 재시도한다.
- 삽입 시에만 $setOnInsert로 후보 사실/상태/감사/identityCandidates를 설정한다.
- 재수집 시 $max lastSeenAt, $inc seenCount 및 __v만 변경한다. timestamps:false로 검토 updatedAt도 유지한다.
  감사기록을 추가하지 않고 proposedFacts와 승인/반려 상태를 유지한다.
- 승인된 기존의 다른 canonical 문서는 전혀 변경하지 않는다. 이 경로에서 생성 후 승인된 후보를 재수집하면 그 후보의
  위 수집 메타데이터만 갱신한다. 공개 사실, 상태, 감사는 변경하지 않는다.
- __v 증가로 IGNORE_CHANGE preflight 이후 재수집도 충돌로 감지한다.
- seenCount는 도착한 관측 요청 수이며, 네트워크 재시도도 포함한다. 요청 전달 횟수의 exactly-once 카운터는 아니다.

## 운영 전 읽기 전용 preflight

운영 실행은 이번 작업에서 하지 않았다. 로컬 서버 빌드 산출물과 DB 읽기 전용 계정이 준비된 별도 승인 환경에서:

```text
node scripts/receipt32-observation-preflight.mjs --read-only
```

MONGODB_URI는 환경에서 제공하며 명령/출력에 자격증명을 넣지 않는다. CLI는 raw MongoClient로 find/listIndexes만 사용하며
apply 모드, 인덱스 생성, update, 삭제 기능이 없다. 실제 운영 인덱스 생성은 별도 승인 후 운영 절차로 수행해야 한다.
결과에는 indexReady, 기존 key 충돌(indexConflicts), 키 없는 문서 수, 무효값 수, 동일 관측 추정 그룹 및 제안 인덱스만 포함한다.
내용 원문 대신 문서 ID/해시를 출력한다. 충돌/무효값 발견 시 종료 코드 2이며 자동 삭제/병합/backfill하지 않는다.
인덱스가 없으면 indexReady:false를 보고한다. 앱은 인덱스 설치까지 ID 없는 ingestion을 503으로 차단한다.

preflight는 snapshot transaction이 아닌 순차 read이므로 쓰기 중인 DB에서는 인덱스 승인 직전 수집 작업을 조정하고 재확인해야 한다.
DB 전체 스캔과 해시 그룹 메모리 비용이 있어 큰 컬렉션은 읽기 전용 점검 시간대를 정해야 한다.

## 기존 중복 처리 드라이런 원칙

1. 충돌 그룹별 pre-image와 버전/해시를 별도 승인된 안전한 보관소에 백업한다.
2. 승인/반려/검토 중 상태, canonical 관계, 감사와 출처를 비교하여 사람이 처리안을 결정한다. 첫 문서를 자동 선택하지 않는다.
3. 드라이런 보고서에 유지/보관 제안, 예상 필드 변화, 참조 영향, 복원안을 적는다. 실제 문서/키/인덱스는 변경하지 않는다.
4. 승인 후 별도 작업으로 처리하며 동시 변경 시 중단한다. 삭제나 canonical 자동 병합은 이 기능에 포함하지 않는다.

기존 fingerprint 없는 후보는 부분 인덱스에서 제외되어 정상 로드된다. 자동 backfill을 하지 않으므로 과거의 미키화 후보가 있어도
최초 새 수집에 keyed 후보 한 건이 추가될 수 있다. 이후 동일 입력은 해당 후보를 재사용한다. 이전 후보들의 정리는 별도 승인 사항이다.
식별 가능한 외부 ID도 없고 제공된 모든 사실까지 동일한 두 실세계 장소는 입력만으로 구분할 수 없다.
공급자는 안정적 sourceSystem/sourceRecordId 또는 구분 가능한 사실을 제공해야 하며 이 한계가 canonical 승인 근거가 되지는 않는다.

## 검증과 운영 기능 보존

실제 MongoMemoryServer fixture에서 외부 ID 유무별 반복, 12개 동시 요청, 내용 변경, 지역/출처 분리,
동일명 다른 주소/전화, 승인/반려 반복, canonical 불변, 공개 차단, 기존 문서, 누락 인덱스 차단,
preflight 중복 탐지와 무변경을 검증한다. createIndexes/dropIndex/deleteMany는 이 격리 테스트에만 있다.
추가 코드는 regional-data와 로컬 읽기 전용 도구/테스트에 한정된다. Client와 지역 데이터, 운영 80개 커밋의 기능 파일은 유지한다.

최종 로컬 결과 (2026-09-06):

| 검증 | 결과 |
|---|---|
| 집중 계약 | 8 suites / 133 tests 통과 |
| 서버 전체 | 109 suites / 1065 tests 통과 |
| Client 전체 | 571 tests 통과 |
| receipt32 스크립트 | 38 tests 통과 |
| 서버 빌드 | 후보 객체 타입 선언 보완 후 성공 |
| Client 빌드 | 성공 |
| git diff --check | 통과 |
| 새 공통 모듈의 지역명/regionId 하드코딩 | 없음 |

Client 빌드의 기존 Node 22.11/Vite 최소 버전 경고와 chunk 크기 경고, 기존 테스트 validateSync deprecation은 남아 있다.
이번 추가 테스트 14개는 실제 격리 MongoDB 계약이며 스크립트 테스트 2개는 무인자/금지 apply 모드 안전성을 확인한다.

push, 운영 DB 쓰기, 운영 인덱스 생성, 서버 pull, 운영 빌드/재시작, 실제 IGNORE_CHANGE는 수행하지 않았다.
배포 전 인덱스 preflight와 별도 설치 승인, source ID 계약, 기존 중복 처리 범위, 서버/Client 배포 순서 승인이 필요하다.
