# 합천 Visitor UX 2차 구현 보고

확인일: 2026-09-07. 제공된 pasted-text 요청을 기준으로 구현했다. 별도의 PDF 원본은 제공되지 않아 PDF 화면과의 대조는 하지 않았다. 운영 배포, production data write, DB schema 변경, migration, seed, backfill은 수행하지 않았다.

## 1. 변경 파일 전체

경로는 저장소 루트 기준이다.

| 영역 | 파일 |
|---|---|
| 입력·맥락 | `client/src/components/RuntimeJourneyEntry.tsx`, `client/src/components/RuntimeJourneyIntro.tsx`, `client/src/runtimeJourney.ts`, `client/src/tripSession.ts`, `client/src/api/client.ts` |
| 여행 진행·발견 | `client/src/components/JourneyConciergeNext.tsx` (신규), `client/src/localDiscovery.ts` (신규), `client/src/pages/ConciergePage.tsx` |
| 위치·표현 | `client/src/components/LocationContextBar.tsx`, `client/src/components/VisitorLocationControl.tsx`, `client/src/components/runtime-journey.css` |
| 음성 | `client/src/voice/voiceUx.ts`, `client/src/voice/voiceIntegration.test.ts` |
| 네트워크 | `client/src/components/ContextResourceNetwork.tsx`, `client/src/pages/hapcheon-network-report.css`, `client/src/contextNetworkInteraction.test.mjs` |
| client 검증 | `client/src/visitorUxPhase2.test.ts` (신규), `client/src/visitorUxInteraction.test.mjs` (신규), `client/src/humanizedJourneyCopy.test.ts`, `client/src/locationMvp.test.ts`, `client/src/regionalHomeIcons.test.ts` |
| server | `server/src/concierge/proactive-local-discovery.ts` (신규), `server/src/concierge/proactive-local-discovery.service.ts` (신규), `server/src/concierge/proactive-local-discovery.spec.ts` (신규), `server/src/concierge/concierge.controller.ts`, `server/src/concierge/concierge.module.ts` |
| 문서 | `docs/hapcheon-visitor-ux-phase2.md` (이 문서) |

`vite.config.ts`의 target 들여쓰기는 이미 주변 포맷과 일치하여 이번 변경에는 포함되지 않는다. 모바일 확인용 임시 mock 서버는 검증 후 종료하고 삭제했다.

## 2. 요청사항별 반영 결과

| 요구 | 반영·검증 |
|---|---|
| 한 번 전달한 맥락 유지 | 계획 맥락과 기존 runtime 맥락에서 동행·건강·교통·보행·관심·체류시간을 복원한다. 변경한 chip 값만 반영하여 부모 연령·건강 정보를 덮어쓰지 않는다. |
| 모바일 조건 입력 | 동행·시간을 나란히 배치하고 선택 조건은 접었다. 생성 버튼을 선택 조건보다 위에 배치했다. 자동 소개 팝업을 제거했다. |
| 자연어·음성 | 충분한 저위험 여행 요청은 기존 실행 흐름으로 즉시 전달한다. 모호하거나 예약·결제 등 확인이 필요한 음성은 기존 확인 정책을 유지한다. |
| NOW 다음 행동 | 저장된 일정 중 완료·건너뜀을 제외한 다음 장소와 기존 ACTION을 노출한다. 다른 곳 보기는 기존 REPLAN으로 연결한다. |
| 자동 상황 검토 | 현재 시간·날씨는 서버의 live hydration으로 검토한다. 화면이 보일 때 5분 주기로 재검토하며, 이미 GPS 권한을 허용한 경우에만 오래된 위치를 조용히 갱신한다. 일정은 임의 교체하지 않는다. |
| 위치 확인 이후 | 상세 주소·정확도·시각은 접고, 현재 위치 다시 확인과 다른 위치 선택을 분리했다. 확인 후 맛집·카페·가볼 곳으로 이어진다. |
| 선제 발견 | 기존 Concierge 안에서 한 번에 한 제안을 표시한다. 별도 페이지나 팝업은 추가하지 않았다. |
| 대표 경험 | 기존 대표 자원 표시와 태그를 feasibility 통과 후에만 사용한다. 현재 합천 자료의 부족한 운영 근거는 추정하지 않는다. |
| 반복·거절 | 익명 여행 단위 노출·거절 기록, 자동 제안 간격, 원래대로 선택 시 자동 제안 중단을 적용했다. |
| analytics·privacy | 기존 이벤트와 partner recommendation 계약을 사용한다. graph 집계·suppression·verified-use 기준은 변경하지 않았다. |
| 네트워크 빈 상태 | 관심 행동·이동 의도·검증 이용 필터의 edge가 0이면 그래프 바로 위에 안내한다. 하단 의미 설명을 유지했다. |

자연어 해석·질문 생성 전체를 새 엔진으로 교체하지 않았다. 기존 PLAN/NOW/REPLAN/ACTION 실행 루프를 재사용하므로 자유 발화의 모든 변형에 대한 실환경 품질은 운영 전 추가 확인 대상이다.

## 3. Proactive Local Discovery 구조

`JourneyConciergeNext` → 읽기 전용 `POST /api/concierge/local-discovery` → `RegionalDataService.effectiveDataset`와 `networkResources`의 공개 자원 ID 교집합 → `LiveRuntimeHydrationService` → `selectLocalDiscovery` → 기존 `DecisionPipelineService` → 한 제안 표시 순서다.

클라이언트가 보낸 runtime 운영 상태를 신뢰하지 않고 필요한 여행 조건만 선별한다. 서버가 현재 시간·날씨를 보강한다. 위치는 AVAILABLE, 관측 30분 이내, 정확도 200m 이내를 요구한다. 교통수단과 체류 종료 시각이 없으면 제안하지 않는다.

후보는 실제 공개 Regional Data 중 VERIFIED 자원이며, 좌표·길찾기 ACTION·구조화 운영시간·등록된 관람 소요시간이 있어야 한다. 예약 필요 자원, 불명확한 휴무, 행사 일정 불명, 완료·제외·예정된 자원은 제외한다. 날씨가 불명확하거나 비·눈이면 명시적 실내 자원만 검토한다. 동행 아동·보행 제한도 확인한다.

직선거리와 보수적인 이동 추정은 후보 제외 용도로만 쓴다. 실제 도로 이동시간으로 표시하지 않는다. 다음 목적지 좌표가 있으면 우회 규모도 제한한다. 종료시간·마감시간 적합성을 통과한 뒤 관심사, 숙소·일정과 공유하는 지역 테마, 첫 방문 대표 경험으로 순위를 정한다. 응답에는 자원·ACTION·추천 이유만 포함하며 raw session/trip linkage를 반환하지 않는다.

## 4. 재사용 구조

- `TripSession`, `sessionContext`, `mergeTravelContext`, 기존 위치·일정 실행 상태.
- `RegionalCandidateRecord`, `RegionalDataService`, 기존 공개 자원 조회 및 지역 범위.
- `LiveRuntimeHydrationService`, `EntityLocationService`, `DecisionPipelineService`.
- `EntityActions`, 기존 Concierge 요청·REPLAN·일정 추가·길찾기.
- 기존 visitor analytics와 partner recommendation API.

## 5. Must Experience 판단

`representativeAnchor === true` 또는 기존 확장 가능한 `tags`의 `MUST_EXPERIENCE`를 지원한다. 첫 방문에서만 feasibility 통과 후보에 작은 우선순위 보정을 적용한다. 여행자가 지정한 필수 방문지 의미의 `isMustVisit`는 지역 운영자 우선순위로 전용하지 않았다.

현재 합천 checked-in master에는 `representativeAnchor:true`가 없으며, 정원테마파크의 명시적 false를 그대로 존중한다. 새로운 MUST_EXPERIENCE 태그를 seed하거나 특정 관광지를 임의 지정하지 않았다. 따라서 대표 경험 우선순위 기능과 현재 실제 적용 가능한 데이터 범위를 구분해야 한다.

## 6. 이번에 만들지 않은 데이터 필드

DB 필드는 추가하지 않았다. `firstVisit`, `stayUntil`은 클라이언트 여행 맥락 타입으로 처리한다. 대표성은 기존 필드, 운영시간은 기존 구조화 `operatingHours`, 관람시간은 기존 확장 객체 `walkingAccess.durationMinutes`를 읽는다. 관람시간 값은 이번에 생성·보충하지 않았다.

추후 데이터 관리 계약 검토 대상은 대표 경험의 선정 근거·승인일·유효기간, 관람 소요시간과 보행 구간의 구분, 당일 임시휴무, 예약 필요 여부, 접근성의 검증일이다. 기존 JSON 구조로 관리할지 별도 필드가 필요한지는 실제 데이터 확보 후 결정해야 한다. 도로 경로 기반 우회시간도 현재 구현하지 않았다.

## 7. 실제 합천 데이터에 근거한 예시 3개와 현재 한계

다음은 저장소에 존재하는 자원의 태그·관계를 이용한 **조건부 시나리오**다. 현재 생성된 제안이나 운영 실적을 의미하지 않는다.

| 실제 자원 | 연결 가능한 상황 | 현재 제안 제한 |
|---|---|---|
| 합천운석충돌구 관광안내소 | 운석충돌구 일정과 GEOLOGY 테마를 공유하며, 비가 올 때 INDOOR·FAMILY_TRIP 근거로 실내 대안 검토 | 구조화 운영시간·관람 소요시간이 없어 현재 제외 |
| 합천호 | 합천호 스마일펜션 숙박 맥락과 HAPCHEON_LAKE 테마를 공유하는 주변 경험 검토 | 구조화 운영시간·관람 소요시간, 맑은 날의 live 날씨 등 실행 근거 필요 |
| 대암산 전망대 | 운석충돌구 방문 맥락의 GEOLOGY·VIEWPOINT 경험 검토 | 산길 접근성, 운영·관람시간과 보행 적합성 근거 부족으로 현재 제외 |

checked-in `HAPCHEON_MASTER_DATA`만을 대상으로 한 엄격한 선택기 테스트 결과는 **제안 0개**다. 운영 DB는 이번 작업에서 조회하지 않았으므로 운영 환경의 실제 제안 수는 미확인이다. 실제 데이터로 즉시 노출되는 성공 예시 3개를 입증한 상태는 아니다. 이를 채우기 위한 가짜 장소·운영시간·좌표·추천 이벤트는 만들지 않았다.

## 8. 반복 추천 방지

지역·익명 여행별 localStorage에 shown/declined와 마지막 노출 시각을 저장한다. 동일 자원은 다시 새 제안으로 노출하지 않으며 자동 제안 간격은 20분이다. 거절한 자원은 제외하고 ‘괜찮아요, 원래대로’ 이후 해당 여행의 자동 제안을 중단한다. 다른 경험 보기는 간격만 우회하며 이전 제안·거절은 우회하지 않는다.

현재 화면의 제안은 맥락 재검토 때 동일 자원의 적합성을 다시 확인할 수 있지만 새 노출 이벤트는 발생시키지 않는다. 저장소를 사용할 수 없으면 메모리로 대체하므로 이 경우 브라우저 종료 후 중복 방지는 보장되지 않는다. 동시 탭의 완전한 원자적 중복 제어도 운영 전 확인 대상이다.

## 9. analytics 연결

카드가 렌더링된 뒤 기존 `RECOMMENDATION_SHOWN`과 `recordPartnerRecommendations`를 실행한다. 다음 일정의 길찾기는 기존 `EntityActions`와 `JOURNEY_START_ACTION`으로 이어지고 로컬 실행 상태는 EN_ROUTE가 된다. 상세·일정 추가 등은 기존 ACTION 계약을 유지한다.

INTEREST·길찾기·이동 시작·QR 확인을 VERIFIED_USE로 올리는 코드는 추가하지 않았다. 신규 endpoint는 raw anonymousTripId/sessionId를 public 응답으로 반환하지 않는다. 기존 graph의 threshold·suppression·동일 익명 흐름의 강한 actual-use 판정은 변경하지 않았다. 테스트·브라우저 검증은 격리 mock을 사용했으며 운영 analytics를 만들지 않았다.

## 10. Network Graph 빈 상태

관심 행동·이동 의도·검증 이용에서 evidence edge가 0개이면 그래프 바로 위에 `아직 확인된 … 관계가 없습니다.`를 표시한다. 하단 이동 의도·검증 이용의 기존 상세 문구와 자원 분류 구조는 유지한다. edge 생성·선택 강조·privacy 규칙은 변경하지 않았다.

360×800 브라우저에서 필터를 실제 클릭하여 세 안내를 확인했다. 이동 의도 안내의 viewport 상단 위치는 약 532px로, 아래로 긴 그래프를 먼저 통과하지 않아도 볼 수 있었다.

## 11. 모바일 UX 확인

격리된 로컬 mock API와 실제 브라우저로 확인했다. 390×844에서 생성 버튼은 y=621~663, 하단 메뉴 시작은 y=785였다. 360×800에서 버튼은 y=658~700, 하단 메뉴 시작은 y=741이었다. 두 크기 모두 입력 화면의 가로 넘침 없이 동행·시간·생성 버튼을 볼 수 있었다.

React DOM 상호작용 테스트로 기존 부모 건강·연령 조건 유지, chip 선택 후 명시적 생성, 실제 ACTION 렌더링, 노출 이벤트 1회, 거절 후 재진입 시 비노출을 확인했다. 물리적 휴대전화의 마이크·GPS 센서나 외부 지도 앱 인계는 이번 브라우저 확인 범위가 아니다.

## 12. 전체 테스트·build 및 로컬 확인

| 검증 | 결과 |
|---|---|
| server `npm test -- --runInBand` | 119 suites / 1,173 tests 통과 |
| client `npm test` | 598 tests 통과 |
| server `npm run build` | 통과 |
| client `npm run build` | TypeScript·Vite·PWA build 통과 |

기존 actual-use trust·privacy 관련 테스트를 포함한 전체 suite가 통과했다. 신규 테스트에는 공개 자원 교집합, 근거 없을 때 0개, 불가능한 대표 후보 제외, raw linkage 비노출, 중복·거절 방지와 실제 UI 상호작용이 포함된다.

로컬에서는 server/client 각 디렉터리에서 위 명령을 재실행할 수 있다. UI는 로컬 개발 API를 연결한 client의 `/hapcheon/concierge?mode=now`와 `/hapcheon/network-report`에서 확인한다. 개발 API가 이미 안전하게 구성된 경우 client 디렉터리에서 `npm run dev -- --host 127.0.0.1`로 연다. 운영 API를 쓰는 설정에서는 클릭·analytics 검증을 하지 않는다. 데이터가 없는 선제 발견의 성공·거절 흐름은 `visitorUxInteraction.test.mjs`의 격리 fixture로 재현할 수 있다.

## 13. 남은 위험·운영 전 확인

- 현재 합천 데이터로 즉시 실행 가능한 선제 제안은 확인되지 않았다. 운영시간·관람시간·접근성 등 근거가 갖춰져야 실제 ‘먼저 알려주는’ 경험을 검증할 수 있다.
- 미래 여행 날짜의 사전 제안과 도로 경로 기반의 정밀한 우회·교통상황 판단은 미구현이다. 현재 서버 시각과 보수적 거리 검토가 기준이다.
- 실기기에서 음성 인식, GPS 권한·백그라운드 복귀, 외부 지도 앱, 여러 탭 동시 사용을 확인해야 한다.
- Node 22.11.0 환경에서 Vite의 권장 버전 경고(20.19+ 또는 22.12+)가 있었다. 빌드는 성공했지만 운영 전 지원 Node 버전을 맞춰야 한다.
- 운영 DB의 실제 공개 후보·선제 제안 수, network evidence 수 및 스마일펜션 행동 edge는 이번 작업에서 재측정하지 않았다. 자원 테마의 존재를 관광객 행동 evidence로 해석하면 안 된다.
- 운영 배포·DB 변경·운영 데이터 쓰기는 수행하지 않았다.
