# 접수번호 48-A — 지금맞춤 지역여정

## 정의와 개편 이유

공식 한국어 명칭은 **지금맞춤 지역여정**, 공식 영어 명칭은 **Runtime-Adaptive Regional Journey**다. EXKOVIA는 관광지를 추천하는 서비스가 아니라, 여행자의 지금에 따라 지역에서의 다음 경험을 계속 다시 구성하는 지금맞춤 지역여정(Runtime-Adaptive Regional Journey) 플랫폼이다.

합천 현장에서는 이미 요청과 AI 응답이 끝난 뒤에도 큰 후속 입력 영역이 다시 나타나 사용자가 여행을 실행하는 대신 대화를 억지로 이어가는 문제가 확인됐다. 48-A는 `State → Context → Decision → Action → Re-plan` 흐름에 맞춰 결과와 행동을 우선하고 자유 입력을 명시적인 보조 행동으로 옮긴다.

## 기존 구조와 새 구조

| 상태 | 기존 | 48-A |
| --- | --- | --- |
| 여행 없음 | 목적·동행 조건이 섞인 빠른 버튼과 별도 입력 | 목적 4개, 접힌 선택 조건, `내 여정 만들기`가 하나의 진입 영역에 표시 |
| 생성 중 | 입력 구조가 화면에 남을 수 있음 | 중복 전송을 막고 기존 처리 상태 표시 |
| 결과 준비 | 큰 후속 입력이 결과와 경쟁 | 이해한 내용 → 순서형 결과 → 승인된 행동 → 출발·조정·다른 요청 |
| 여행 진행 중 | 일반 이어가기 중심 | 지역명이 포함된 이어가기, 현재 상황 재계획, 안전한 새 여행 순서 |
| 자유 입력 | 반복 노출 | `다른 요청하기` 이후에만 말하기 또는 글 입력을 선택 |

## 사용자 상태 흐름

1. 첫 방문에는 버전이 있는 저장 키로 가벼운 소개를 한 번 보여준다. 닫기, ESC, 제목·설명 연결, 포커스 복귀를 지원하며 작은 설명 링크로 다시 열 수 있다.
2. 여행이 없으면 목표를 선택하거나 아무 선택 없이 현재 확인 가능한 Context만으로 여정을 요청할 수 있다. 동행자, 남은 시간, 이동 방법, 걷기 정도는 접혀 있는 선택 조건이다.
3. 기존 Concierge recommendation 파이프라인이 순서가 있는 지역 여정을 반환한다.
4. 결과에서는 이해 내용과 여정 단계 및 검증된 행동이 먼저 나온다. 자유 입력은 닫힌다.
5. `이대로 시작`은 첫 단계를 `EN_ROUTE`, 뒤 단계를 `PLANNED`로 저장하고 실제 여정 실행 화면으로 이동한다.
6. `조금 바꾸기`는 기존 TripSession을 유지하면서 시간·동행자·이동수단·걷기·장소 한 곳 변경만 선택한다.
7. `다른 요청하기`를 눌러야 말하기·글 입력 선택이 나타난다. 기존 음성 확인·수정·명시적 전송·중복 방지 로직을 그대로 쓴다.
8. 진행 중인 여행이 있으면 이어가기와 현재 상황 재계획을 새 여행보다 먼저 표시한다. 새 여행은 기존 여행을 보관한 뒤 새 익명 여행을 시작한다.

## 자동 Context와 사용자 선택의 경계

지역, 확인된 위치와 시각·날씨, TripSession, 저장된 숙소·선택·진행 상태는 기존 Context 결합 경로에서 사용한다. 권한이 없거나 응답에 없는 위치·날씨·영업·혼잡·보행 안전·예약 가능성은 추정하지 않는다. 선택 조건은 선택 사항이며 표시 레이블과 내부 enum을 분리한다. 현재 구현은 정밀 도로 최적화나 확인되지 않은 이동 시간을 만들지 않는다.

## 한국어·영어와 지역 확장

두 언어는 같은 TripSession, 내부 선택 값, 추천 결과, 실행 상태와 분석 이벤트를 공유한다. 공식 개념명과 버튼·상태 레이블만 locale별로 제공한다. `RegionContext`와 기존 지역 라우팅을 사용하므로 `gajo`, `okcheon`, `muan`, `gyeryong`, `hapcheon`, `daejeon-junggu`에 같은 컴포넌트가 적용되고 장소나 업체는 하드코딩하지 않는다. Action Channel 보유 여부도 추천 점수에 추가하지 않았다.

## Analytics의 의미

Analytics v2에 다음 의미만 추가했다.

- `RUNTIME_JOURNEY_REQUESTED`: 여정 생성을 요청함
- `RUNTIME_JOURNEY_PRESENTED`: 여정 결과가 제시됨
- `RUNTIME_JOURNEY_STARTED`: 사용자가 시작 버튼을 선택함
- `RUNTIME_JOURNEY_ADJUSTMENT_OPENED`: 구조화된 조정을 열었음
- `RUNTIME_JOURNEY_REPLAN_REQUESTED`: 기존 맥락으로 재계획을 요청함

시작 선택은 장소 방문이나 도착을 뜻하지 않는다. 기존 길찾기, 예약 버튼, outbound, 예약 완료 의미도 바꾸지 않았다. 시작·조정·재계획은 `actionId`가 필요한 선택 행동으로 검증하고, `eventId`, `visitSessionId`, 익명 여행 ID, 인증된 내부 점검 분류와 기존 fire-and-forget 정책을 유지한다. 이벤트 타입은 기존 문자열 스키마 안의 계약 확장이므로 새 컬렉션·인덱스·DB migration은 필요 없다.

## 변경 파일

- Client: `runtimeJourney.ts`, `RuntimeJourneyEntry.tsx`, `RuntimeJourneyIntro.tsx`, `RuntimeJourneyResultActions.tsx`, `runtime-journey.css`
- 기존 흐름 결합: `HomePage.tsx`, `ConciergePage.tsx`, `TripContinuity.tsx`, `regionalHomeGuidanceContext.ts`
- Analytics: `analytics.ts`, `visitorAnalytics.ts`, `VisitorAnalyticsDashboard.tsx`
- Server 계약: `server/src/analytics/visitor-contract.ts`
- 테스트·fixture: `runtimeJourney.test.ts`, `runtimeJourneyExperience.test.ts`, `tripManagement.test.ts`, `visitor-analytics.spec.ts`, `scripts/receipt48a-fixture.mjs`

## 검증 기록

관련 Client 테스트와 Server analytics 계약 테스트를 먼저 실행했다. 최종 Client 전체 실행은 pretest 100건과 본 suite 302건, 합계 402건이 모두 통과했고 실패·skip·todo는 0건이다. 최종 Server 전체 실행은 104 suites, 981 tests가 모두 통과했다. 느린 로컬 QR 생성 및 in-memory Mongo 검증을 위해 마지막 Server 실행에 Jest timeout 30초를 적용했으며 테스트 내용은 바꾸지 않았다. Client와 Server production build도 최종 소스에서 각각 성공했다. Client build에는 현재 Node 22.11.0이 Vite 권장 최소 22.12보다 낮다는 기존 경고와 번들 크기 경고가 있었지만 산출물 생성은 완료됐다.

실제 앱 컴포넌트와 in-memory API fixture를 연결한 브라우저 검증에서 다음을 확인했다.

- 영어 최초 소개와 재열기, 한국어 최초 진입 목표 화면
- 목표와 선택 조건 분리, 선택 조건 펼치기
- 처리 상태 뒤 이해 내용 → 공식 여정 제목 → 순서형 단계 → 출발·조정·다른 요청 순서
- 장소 하나 바꾸기 재계획과 결과 유지
- `다른 요청하기` 전에는 입력 선택이 없고, 연 뒤에만 말하기·글 입력이 나타남
- 합성 SpeechRecognition fixture에서 듣기 → 중지 → 인식 문장 확인·수정 → 명시적 전송 구조 유지
- `이대로 시작` 후 첫 단계 `현재`, 다음 단계 `예정`인 실행 화면
- 홈 복귀 후 `이어갈 합천 여행이 있어요`와 이어가기·현재 상황 재계획·새 여행 순서
- 모바일 폭의 하단 내비게이션, 긴 영문 명칭, 확대 상태에서 가로 넘침이 보이지 않음

자동화 중 캡처에는 운영 토큰, 환경변수, 개인정보가 없다. Codex 브라우저 캡처로 한국어 소개, 한국어 최초 진입, 영어 소개, 영어 결과, 확대 리플로우 화면을 보존했다.

## 한계와 현장 미검증

브라우저 fixture는 실제 컴포넌트와 상태를 사용하지만 API 응답과 SpeechRecognition 결과는 메모리 fixture다. 실제 iOS Safari, Android Chrome, 실물 마이크, 소프트 키보드, GPS 권한 변화는 현장 미검증이다. 현재 브라우저 환경에서 임의의 모든 물리 viewport를 직접 바꾸지는 못했으므로 320px, 모바일 가로, 대형 데스크톱은 CSS·회귀 테스트와 현재 브라우저 리플로우로 확인했으며 실제 기기 확인이 남는다.

## 48-B 제안

48-B에서는 실제 지역 데이터로 단계별 역할과 검증 이유의 품질을 강화하고, Context가 부족할 때 빈 입력 대신 한 번에 하나의 선택 질문을 내는 결정 정책을 구체화한다. 실제 이동 중 위치·날씨 변화가 있을 때만 재계획을 제안하는 기준과, 현장 기기에서의 키보드·마이크·safe-area 검증도 포함한다.
