# 합천 Context 네트워크 구현 보고

## 사전 분석

- 로컬 main에는 대상 화면이 없어 origin/main의 806afa4, c8b5768을 fast-forward로 반영한 뒤 분석했다.
- `/hapcheon/network-report`는 `HapcheonNetworkReportPage.tsx` → `GET /api/public/regional-network/hapcheon` → `RegionalReportService.ecosystem()`을 사용한다.
- 변경 전 ecosystem은 운영 DB가 아닌 `HAPCHEON_MASTER_DATA` 및 relatedEntityIds/공통 테마/권역 태그를 사용했다. 2026-09-07 운영 공개 API에서도 generatedFrom=HAPCHEON_MASTER_DATA, 총 18개/검증 12개를 확인했다.
- RegionalDataRecord에는 검증·공개 상태와 좌표가 있지만 추천/이동 관계 배열은 없다. 등록 초안과 검토 제안은 공개 데이터가 아니다.
- 기존 TourismNetworkAggregationService는 업소 QR 유입 이후 동일 익명 흐름의 다른 업소 이벤트를 집계한다. 기존 공개용 스냅샷은 소수 셀 억제 및 현재 공개 가능한 파트너 필터를 적용한다.

## 변경 파일

- client/src/pages/HapcheonNetworkReportPage.tsx: 상단 카피·통계 카드·핵심 메시지 유지, 그래프 삽입, 기존 자원 카드를 상세 섹션으로 이동.
- client/src/components/ContextResourceNetwork.tsx: SVG 방사형 네트워크, 클릭/키보드 선택, hover 정보, 관계 필터, 범주별 페이지, 관계 근거.
- client/src/contextNetwork.ts: 공유 DTO, 분류, 근거별 관계 필터.
- client/src/pages/hapcheon-network-report.css: 딥그린/베이지/골드 그래프와 반응형.
- server/src/regional-data/regional-data.service.ts: 기존 데이터 계층에 읽기 전용 networkResources 조회 추가.
- server/src/regional-report/context-network.ts: DB 자원만으로 노드와 승인 좌표 근접 관계 생성.
- server/src/regional-report/regional-report.service.ts: 정적 마스터데이터 제거, 기존 공개 스냅샷의 실제 이용 관계 연결.
- 테스트: client/src/contextNetwork.test.ts, client/src/regionalReport.test.ts, server/src/regional-data/network-resources.spec.ts, server/src/regional-report/regional-ecosystem.spec.ts.

## 데이터 생성 및 해석

1. 합천 RegionalDataRecord의 ACTIVE/CHANGE_DETECTED 상태만 조회한다. 검증된 공개 이름 또는 이전 검증일이 있는 공개 레코드만 사용한다. 등록 초안·비공개·폐기 자원은 제외한다. 정적 데이터 fallback은 없다.
2. canonicalEntityId를 키로 중복 제거하고 관광·체험/축제/음식점/카페/숙박을 분류한다. 알 수 없는 유형을 관광으로 임의 분류하지 않는다.
3. 검증 상태는 원본을 유지한다. VERIFIED는 녹색, 그 외 추가 검증 필요는 금색 점선이다.
4. Context→범주→자원 선은 명시적으로 **분류 구조**다. 실시간 개인 Context나 적합도를 조회하지 않으므로 CURRENT_CONTEXT_FIT으로 주장하지 않는다.
5. NEARBY는 기존 승인 좌표 정책을 통과하고 위험 변경이 없는 좌표 간 Haversine 직선거리 1km 이내다. 보행 가능성이나 보행 거리로 해석하지 않는다.
6. ACTUAL_USAGE는 기존 latestPublicRolling 스냅샷에서 BENEFIT_USE_CONFIRMED만 추출한다. 공개 가능 파트너의 canonicalEntityId를 DB 노드와 일치시킨다. 이름으로 연결하지 않는다. 정수 집계와 최소 공개 건수를 재확인한다.
7. 이 관계는 업소 QR 유입 후 다른 업소에서의 검증 혜택 이용이다. QR 방문 확인, 관심, 길찾기·전화 등 이동 의도는 실제 이용으로 바꾸지 않는다. 개인 세션 노드는 제공하지 않는다.
8. 추천·NEXT_VISIT·STAY_TO_FOOD·ATTRACTION_TO_CAFE 등은 이름이나 유형으로 추정하지 않는다. 근거가 없으면 빈 상태로 안내한다.
9. 상단 통계 위치·항목은 유지하되 수치는 운영 DB와 공개 가능한 관계에서 계산한다. 이전 정적 목록의 숫자를 고정하지 않는다.

## 실제 운영 데이터 확인 범위

운영의 기존 공개 API까지 읽기 전용으로 확인했다. 새 API는 아직 배포하지 않았으므로 실제 DB 조회 결과와 공개 가능한 ACTUAL_USAGE 건수는 확정하지 않았다. 연결 사용 코드는 구현되어 있으며 데이터가 없으면 준비 중을 표시한다. 운영 DB 접속·쓰기, seed/migration/backfill, 집계 재생성은 실행하지 않았다. MongoDB 스키마·인덱스를 변경하지 않았다.

## 검증

- 클라이언트 관련 테스트 7개 통과.
- 서버 데이터/API/자동 컬렉션 생성 방지 테스트 5 suites, 13개 통과.
- 클라이언트 및 서버 빌드 통과. 기존 Node 22.11/Vite 요구 버전, 번들 크기 경고가 남아 있다.
- git diff --check 통과.
- 독립 로컬 UI fixture 25개로 브라우저 검증. fixture는 운영 데이터가 아니며 애플리케이션 코드에 포함하지 않았다.
- 1920×1080: 노드 사각형 겹침 0, 페이지 가로 넘침 없음. 음식점 노드 선택 시 직접 연결 2개/자원 3개 유지, 나머지 17개 흐림. 중앙 복원 시 흐림 0개. 추천 관계 없음 안내, 실제 이용 필터에서 금색 관계 1개/근접선 0개 확인.
- 390×844: 상단과 필터 줄바꿈, 페이지 가로 넘침 없음. 그래프는 읽을 수 있는 1000px 폭을 유지하고 311px 컨테이너 안에서 가로 스크롤. 전체 상세 목록은 세로 배치.
- 범주별 최대 4개를 표시하고 다음 자원 보기 및 아래 전체 목록으로 나머지를 탐색한다. 선택한 자원은 해당 페이지에 표시한다.

## 남은 운영 확인

배포 후 운영 DB 자원 수, 최신 공개 스냅샷 유무, 실제 이용 관계 수를 확인해야 한다. 현재 구현은 근거 없는 경제 성과를 시각화하지 않으며, 매출 입증은 별도 근거가 필요하다.
