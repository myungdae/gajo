# 익명·집계 기반 지역 관광 연결망 MVP

## 의미와 신뢰 경계

이 기능은 개인 관광객을 추적하지 않는다. `A → B`는 같은 익명 이용 흐름에서 A의 유입 이후 B 관련 신호가 함께 관찰되었다는 집계 의미다. 실제 방문자, 순 방문자, GPS로 확인된 도착, 매출 발생 또는 인과관계를 뜻하지 않는다.

노드는 `OPERATING + ACTIVE + VERIFIED` 상태이며 안정적인 `partnerId`와 `canonicalEntityId`를 가진 장소만 사용한다. 초기 MVP는 승인 파트너로 정규화할 수 없는 Nearby 공급자 결과를 개별 node로 만들지 않는다. 유료 여부는 node 크기나 순위에 영향을 주지 않는다.

| 단계 | 신호 | 해석 |
|---|---|---|
| 관심 | `PARTNER_RECOMMENDATION_SHOWN`, 대상이 확인되는 상세조회 | 추천 노출 또는 상세조회 연결 이벤트 횟수 |
| 이동 의도 | 대상이 확인되는 길찾기·전화·예약·홈페이지 연결 | 클릭·handoff이며 방문이 아님 |
| 현장 QR 확인 | `QR_VISIT_CONFIRMED` | QR 확인 건수이며 GPS 도착 증명이 아님 |
| 실제 이용 | `BENEFIT_USE_CONFIRMED` | 신뢰된 파트너 확인 절차를 통과한 혜택 이용 건수 |

## 보존정책

- 신규 `PilotEvent`와 `PartnerActivity`는 서버가 문서를 생성하는 시각부터 정확히 90일 뒤의 `expiresAt`을 기록한다. production emitter도 명시적으로 설정하고 schema default도 같은 서버 함수를 사용하므로 Client 시각을 신뢰하지 않는다. Mongo TTL은 UTC instant를 사용한다. Asia/Seoul은 집계 window 경계에만 사용한다.
- TTL index는 `expiresAt`이 Date인 문서만 대상으로 한다. 따라서 기존 필드 없는 레코드는 index 생성만으로 즉시 삭제되지 않는다. 기존 데이터 소급 정리는 dry-run과 별도 승인을 거친다.
- `BenefitRedemption`은 생성 시 `linkExpiresAt` 90일과 `retentionExpiresAt` 365일을 기록한다. 승인된 maintenance 실행은 90일 뒤 `anonymousTripId`와 재연결 가능한 `idempotencyKey`를 함께 제거하고 운영 상태·파트너·혜택·redemption ID·필요 시각을 유지한다. 365일 뒤 TTL로 문서를 삭제한다.
- 월간 비식별 snapshot은 최대 3년, rolling 30일 snapshot은 45일 보존한다. snapshot에는 session/redemption/event ID, 좌표, 원문, 개별 timestamp 또는 억제 전 소수값이 없다.
- application 연결은 명시적으로 `autoIndex: false`다. schema의 index 선언은 계약일 뿐 application 시작 시 생성되지 않는다. TTL과 redemption partial unique index는 백업·dry-run·별도 승인을 거쳐 `network:retention:index-migrate`로만 생성한다.
- TTL monitor는 만료시각 즉시 삭제를 보장하지 않으며 MongoDB 부하와 monitor 주기에 따라 지연될 수 있다. 운영 점검은 `network:retention:index-check`의 exit code와 만료 문서 backlog를 함께 감시해야 한다.
- 기존 redemption index는 `anonymousTripId`와 `idempotencyKey` 제거를 허용하는 partial unique index로 바꾸어야 한다. 교체 중 쓰기 경쟁을 막는 maintenance window가 필요하며 이 migration과 기존 데이터 update/delete는 별도 운영 승인을 받아야 한다.

## 집계 window와 재실행

rolling 결과는 현재 진행 중인 날짜를 포함하지 않고, 가장 최근 완료된 Asia/Seoul 자정까지의 30개 완료 일자를 사용한다. 따라서 같은 날 반복 조회 결과가 변하지 않는다. 월간 결과는 Asia/Seoul 달력월 `[월초 00:00, 다음 월초 00:00)`이다.

집계 key는 `regionId:kind:periodKey`로 결정된다. 작업은 매번 전체 window를 재계산하고 같은 key에 원자적 upsert하므로 중복 실행이 새 문서를 만들지 않는다. 원시 ID를 쓰지 않는 지역·기간·입력 건수 hash는 운영 진단용 `sourceRevision`으로만 저장되고 API에는 반환하지 않는다. 늦게 도착한 event는 raw 90일 window 안에서 동일 기간을 재실행하면 snapshot을 교체한다. 권장 실행은 rolling snapshot 매일 00:15 KST, 직전 월 snapshot을 월초 7일 동안 매일 재생성한 뒤 확정하는 방식이다.

현재 구현은 집계 service와 반복 실행 가능한 전용 maintenance CLI를 제공한다. retention은 아직 운영 적용 완료 상태가 아니다. CLI는 application bootstrap/seed와 분리되고 `autoIndex: false`이며 `REGIONAL_NETWORK_MAINTENANCE_APPROVED=true npm run network:maintenance`처럼 명시적 승인 플래그가 있어야 실행된다. 실제 scheduler/cron 활성화는 운영 배포 승인과 dry-run·index migration 승인 이후 별도 작업으로 연결해야 한다. 집계 또는 월간 snapshot 생성이 실패하면 unlink 단계로 진행하지 않으며, 부분 성공은 동일 결정적 key로 재실행한다.

## Suppression과 차분 공격 방어

- 네트워크 API는 고정 최근 30일만 제공하고 today·7d·임의 날짜를 받지 않는다.
- source-target-stage cell을 동일 익명 흐름 기준으로 dedupe한 뒤 5건 이상인 edge만 snapshot에 저장한다.
- 5건 미만 edge는 관계 존재 여부와 원시값 모두 저장·반환하지 않는다.
- node는 공개된 edge에 연결된 node만 저장한다.
- 단계 합계는 공개된 edge의 합만 제공한다. 억제 edge를 포함한 상위 원합계는 반환하지 않아 차감 역산을 막는다.
- API는 credential이 결정한 region만 조회하며 URL/body/query로 scope를 바꿀 수 없다.
- snapshot node ID는 report 전용 hash ID이며 canonical entity ID와 partner ID는 serialization 단계에서 제거한다. 조회 시점에도 파트너 상태를 다시 확인하여 PAUSED·DRAFT·비공개·삭제 파트너와 그 edge를 즉시 숨긴다.
- edge는 최대 200개로 제한하고 token별 process-local 읽기 요청을 분당 60회로 제한한다.

## API

`GET /api/regional-report/network`는 기존 `x-regional-report-token`을 사용한다. 응답 예시는 다음과 같다.

```json
{
  "schemaVersion": 1,
  "region": { "id": "hapcheon" },
  "period": {
    "key": "30d",
    "timeZone": "Asia/Seoul",
    "start": "2026-07-30T15:00:00.000Z",
    "endExclusive": "2026-08-29T15:00:00.000Z"
  },
  "privacy": {
    "minimumCellSize": 5,
    "individualPathsReturned": false,
    "suppressionApplied": true
  },
  "network": {
    "status": "PREPARING",
    "notice": "연결 데이터 준비 중",
    "nodes": [],
    "edges": [],
    "stageTotals": [],
    "categoryConnections": []
  }
}
```

## 기존 데이터 read-only dry-run

운영 승인 전에는 실행하지 않는다. 승인 후 운영 서버에서 secret을 출력하지 않는 환경으로 다음 read-only 명령을 실행한다.

```bash
cd /var/www/gajo/server
MONGODB_URI='<기존 운영 연결 문자열을 안전하게 주입>' npm run network:retention:dry-run
```

도구는 컬렉션별 전체 건수, 90일 초과, 연결 식별자 보유, 삭제 예정, redemption 식별자 제거 예정, 즉시 TTL 대상 및 월별 전환 가능 건수만 출력한다. 문서 ID나 식별자 값은 출력하지 않으며 `autoIndex: false`로 연결하고 write 명령을 실행하지 않는다.

예상 최상위 출력 schema는 `{ generatedAt, mode, collections, monthlyConvertible }`다. 연결 오류는 URI나 host를 되풀이하지 않고 고정 오류문만 stderr에 쓴다. TTL index 존재 점검은 다음 read-only 명령으로 수행하며 하나라도 없거나 `expireAfterSeconds !== 0`이면 exit code 2다.

```bash
cd /var/www/gajo/server
MONGODB_URI='<기존 secret을 안전하게 주입>' npm run network:retention:index-check
```

index migration은 이 작업에서 실행하지 않는다. 별도 승인·백업·maintenance window에서만 `REGIONAL_NETWORK_INDEX_MIGRATION_APPROVED=true npm run network:retention:index-migrate -- --apply`를 실행한다.

운영 정리 전에는 Mongo snapshot/volume backup과 복구 리허설, 현재 index 목록 export, dry-run 결과 보관이 필요하다. rollback은 TTL index 생성 직후 background 삭제가 시작될 수 있으므로 index 제거만으로 삭제 문서를 되살릴 수 없다. 반드시 backup 복원 가능한 상태에서 별도 승인된 순서로 aggregate 생성 → 검증 → linkage unset → raw delete → index 생성 순서를 사용한다.

## 향후 권한 연결

Regional Manager 계정 프로젝트는 이 MVP와 분리한다. 향후 인증 계층은 `{ regionId, role, subjectId? }` 형태의 scope만 Network API에 전달한다. 지자체는 region 전체 snapshot, 업소 운영자는 승인된 `subjectId`의 ego network만 조회하며 집계·suppression service는 공통으로 유지한다.
