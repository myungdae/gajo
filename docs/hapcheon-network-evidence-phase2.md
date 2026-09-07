# 합천 network-report 증거 계층 2차 개선

## 범위

기존 미커밋 Context → Category → Resource 구현을 기준으로 최소 확장했다. 기존 actual-use 판정 및 aggregation 이벤트 계약은 변경하지 않았다. DB schema, seed, migration, backfill, aggregation 재생성, 운영 배포는 실행하지 않았다. 전체 테스트의 격리된 테스트 DB 검증은 포함한다.

## 이번 변경 파일

- server/src/regional-report/context-network.ts: 네 증거 수준과 해석 정의, 기존 NEARBY 관계에 RESOURCE_RELATIONSHIP 명시.
- server/src/regional-report/regional-report.service.ts: 기존 latestPublicRolling의 INTEREST/MOVEMENT_INTENT를 공개 자원에 매핑, evidenceLevel·interpretation·privacy 제공.
- server/src/regional-report/regional-ecosystem.spec.ts: verified-use 경계, 비식별 응답, 임계값·정수·미등록 대상·자기 연결·빈 증거 회귀 검증.
- client/src/contextNetwork.ts: 다섯 필터 및 증거 수준 DTO. 기존 관계 응답의 명시적 종류도 읽을 수 있게 유지.
- client/src/components/ContextResourceNetwork.tsx: 필터, 선택 유지, 직접 연결 강조, 단계별 곡선·설명·빈 상태.
- client/src/pages/hapcheon-network-report.css: 딥그린·브라운·골드 및 선 패턴 구분.
- client/src/contextNetwork.test.ts: 증거별 필터 및 빈 결과 검증.
- client/src/contextNetworkInteraction.test.mjs: 실제 React DOM에서 필터·선택·직접/간접 연결·빈 상태 검증.
- client/vite.config.ts: VITE_API_PROXY_TARGET으로 로컬 API를 선택할 수 있게 추가. 기본 운영 API 프록시는 유지.
- server/scripts/regional-network-evidence-audit.cjs: 이미 저장된 공개 스냅샷만 읽는 운영 확인용 스크립트. 애플리케이션 bootstrap/집계 생성 호출 없이 autoCreate/autoIndex=false로 연결한다. 원시 이벤트·흐름 ID 및 억제 건수는 출력하지 않는다.
- docs/hapcheon-network-evidence-phase2.md: 이 보고서.

HapcheonNetworkReportPage.tsx, regionalReport.test.ts, regional-data.service.ts 및 network-resources.spec.ts의 기존 변경은 이번 단계에서 수정하지 않았다.

## 생성 근거

| evidenceLevel | 근거 | 해석 한계 |
|---|---|---|
| RESOURCE_RELATIONSHIP | 현재 DB 자원의 승인 좌표 간 1km 이내 NEARBY. EXPLICIT_RELATED/SAME_THEME/SAME_AREA 응답은 클라이언트에서 같은 계층으로 분류 | 자원 관계이며 행동 성과 아님. 정적 관계를 새로 주입하지 않음 |
| INTEREST | 기존 aggregation이 정규화한 상세 열람·파트너 추천 노출 | 노출과 열람이 포함된 관심 신호. 방문·이용 아님 |
| MOVEMENT_INTENT | 기존 aggregation의 NAVIGATION_HANDOFF/JOURNEY_START_ACTION/MAP_OPENED/PHONE_HANDOFF/BOOKING_HANDOFF/WEBSITE_HANDOFF | 이동·연결 의도. 실제 방문·식사·구매 아님 |
| VERIFIED_USE | 기존 BENEFIT_USE_CONFIRMED만 ACTUAL_USAGE로 유지 | QR 유입 이후 동일 익명 흐름의 다른 업소 검증 혜택 이용. QR 확인·관심·이동 의도에서 승격하지 않음 |

기존 집계는 PARTNER_QR_ENTRY의 anonymousTripId와 PilotEvent의 동일 익명 흐름 sessionId 또는 PartnerActivity의 anonymousTripId를 연결하고, 시간 순서 및 등록 파트너/entity 대상을 확인한다. 동일 흐름/source/target/stage를 중복 제거한다. DIRECTIONS_CLICKED는 현재 aggregation 계약에 없으므로 새로 추정 연결하지 않는다. 이름·범주만으로 행동 edge를 만들지 않는다.

## 운영에서 확인한 결과 — 2026-09-07

`https://exkovia.com/api/public/regional-network/hapcheon`을 읽기 전용으로 확인했다. 응답은 schemaVersion=1, generatedFrom=HAPCHEON_MASTER_DATA, interpretation=ONTOLOGY_RELATIONSHIP_NOT_OBSERVED_PERFORMANCE다.

- 현재 배포된 공개 응답의 INTEREST 0개, MOVEMENT_INTENT 0개는 **정적 API가 해당 단계를 제공하지 않는 결과**다. 운영 aggregation에서 실제 생성되는 edge 수는 **미확인**이며 0으로 결론 내릴 수 없다.
- 스마일펜션은 기존 공개 응답에 SAME_AREA 관계 5개가 있다. 증거 수준은 RESOURCE_RELATIONSHIP이며 행동 증거가 아니다.
- 스마일펜션의 운영 INTEREST/MOVEMENT_INTENT 존재 여부는 **미확인**이다.
- 로컬 server/.env에는 운영 MongoDB/보고 API 인증 설정이 없고 SSH 별칭도 확인되지 않았다. 운영 읽기 경로를 요청했으며 인증 경계를 우회하지 않았다.
- 이번 새 로직을 운영 데이터에 실행한 결과는 아직 없다. 운영 접속 가능한 환경에서 아래 audit 명령을 실행해야 확정할 수 있다.

## 개인정보 보호

기존 고정 rolling snapshot과 suppression을 재사용한다. 5개 이상 익명 흐름이라는 기본 최소 셀 기준, stage별 중복 제거, 200개 공개 edge 제한, 조회 시 공개 파트너 재검증을 유지한다. snapshot.minimumCellSize 및 정수 집계를 projection에서 재확인하고, 공개 자원 노드에 매핑되지 않거나 자기 연결인 edge는 제외한다. 관심/이동도 동일 규칙을 적용한다.

public response는 허용 필드만 구성하여 anonymousTripId/sessionId/partnerId와 원시 식별자 값이 포함되지 않는다. 억제된 관계의 존재·수·합계는 반환하지 않는다. 공개 자원 자체의 노드는 관광객 행동 여부와 무관하다. 실제 운영에서 몇 건이 억제됐는지는 확인하거나 공개하지 않았다.

## 테스트·빌드

- 서버 전체: `npm.cmd test -- --runInBand --testTimeout=30000` — 118 suites / 1,151 tests 통과. 기존 benefit redemption trust와 aggregation 테스트 유지.
- 최초 기본 5초 제한 실행: 기존 QR 테스트 2개 및 Mongo bootstrap hook 1개 시간 초과. 소스 변경 없이 30초 제한 재실행에서 전체 통과.
- 클라이언트 전체: `npm.cmd test` — 590 tests 통과.
- server/client `npm.cmd run build` 통과. client는 마지막 선 구분 및 프록시 변경 이후 재빌드했다.
- audit 스크립트 문법 검사 및 git diff --check 통과.
- Vite의 기존 Node 22.11 버전 요구 경고와 번들 크기 경고는 남아 있다.
- UI는 DOM 상호작용으로 검증했다. 이번 단계의 실제 브라우저 화면/모바일 시각 검증은 수행하지 않았다.

## 로컬 확인

1. 서버에서 `npm.cmd run build` 후, 기존 안전한 로컬 DB 연결이 설정된 환경에서 NODE_ENV=production 및 BOOTSTRAP_SEED_ENTRYPOINT/BOOTSTRAP_SEED_APPROVED 미설정 상태로 `npm.cmd run start:prod`를 실행한다. 개발 모드 bootstrap은 자동 seed가 가능하므로 사용하지 않는다.
2. 별도 PowerShell의 client 디렉터리에서 `$env:VITE_API_PROXY_TARGET='http://127.0.0.1:3000'` 후 `npm.cmd run dev -- --host 127.0.0.1`을 실행한다. 실제 서버 포트가 다르면 맞춘다.
3. 표시된 Vite 주소의 `/hapcheon/network-report`를 연다. 다섯 필터를 전환하고 노드를 선택해 직접 연결만 강조되는지, 설명·빈 상태가 맞는지 확인한다. 스냅샷이 없으면 행동 edge가 없어야 한다.
4. 운영 연결이 안전하게 주입된 읽기 전용 환경에서는 server 디렉터리에서 `node scripts/regional-network-evidence-audit.cjs`를 실행한다. 이 스크립트는 bootstrap/seed/generate를 호출하지 않는다. `snapshotAvailable`, `publicEdgeCounts`, `smile.publicEdgeCounts`, `privacy`로 실제 결과를 확인한다. 스냅샷이 없으면 0은 공개 가능한 edge가 없다는 의미이며, 원시 행동 부재의 증명이 아니다.
