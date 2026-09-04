# 요청 이후 결과 중심 UX 검증

## 변경 원인과 상태 흐름

NOW 응답 성공 시 입력창을 다시 펼치고, 다른 모드에서도 완료된 응답만으로 입력창을 표시하던 조건 때문에 결과 뒤에 큰 요청 영역이 반복됐다. 최초 안내·빠른 선택·직접 요청도 유사한 질문을 중복했다.

최초 진입에는 하나의 요청 안내와 음성/텍스트 선택만 표시한다. 빠른 선택·위치 설정·구조화 일정 입력은 접힌 보조 영역이다. 음성은 기존 단일 팝업에서 듣기→중지→확인·수정→명시적 전송을 유지한다. 전송 즉시 입력을 닫고 처리 상태를 표시한다. 응답 이후에는 이해 내용→추천→실행 행동을 우선 표시하고 작은 다른 요청 버튼만 남긴다. 명시적인 재계획 필요 또는 위치 재확인 상황에만 현재 상황 재추천을 표시한다. 오류 시에는 작성 내용을 유지하며 텍스트 입력을 다시 연다.

음성 hook·팝업·TripSession 저장·Analytics 계약은 변경하지 않았다. 텍스트 보조 버튼은 불필요한 음성 전환 이벤트를 발생시키지 않는다.

## 변경 파일

- `client/src/pages/ConciergePage.tsx`: 입력 표시 조건, 결과 우선 순서, 보조 행동
- `client/src/conversationPresentation.ts`: 상태별 표시 정책과 한·영 문구
- `client/src/index.css`: 작은 보조 버튼, 줄바꿈, 44px 터치 영역
- `client/src/conversationPresentation.test.ts`: 상태·복귀·재추천·문구 회귀
- `client/src/{actionFirstUx,composerUx,recommendationRequestCopy,tripManagement,visitorLanguage}.test.ts`: 변경된 표시 계약 검증
- `client/scripts/urgent-request-fixture.mjs`: DB 없는 합성 음성/응답 브라우저 fixture
- 이 문서와 화면 PNG 4개

## 검증 결과

- 관련 테스트: 47/47 통과.
- Client 전체 `npm run test:all`: 한 번 실행, 517개 중 516 통과. 실패 1개는 이전 placeholder 문자열 고정 검사. 새 한·영 placeholder 회귀 검사로 수정하고 해당 `visitorLanguage.test.ts` 4/4 통과. 전체 재실행은 하지 않았다. skip/only/todo 추가 없음.
- production build: 최초 TypeScript 미사용 변수 오류로 중단. 해당 변수 제거 후 재시도 성공. Vite의 기존 런타임 버전/번들 경고는 남아 있다.
- `git diff --check` 통과. Server 수정 없음.

## 브라우저 증빙

로컬 실제 React 화면을 IAB 브라우저에서 fixture와 연결했다. 실제 음성 API나 DB는 호출하지 않았다.

- 390×844: 최초 요청 영역 1개, 듣는 중 팝업 1개, 중지/취소 각 1개. 팝업 하단 777px, 하단 메뉴 상단 785px.
- 인식 문장 수정 후 전송: 팝업/입력창 즉시 제거, 처리 안내 표시.
- 결과 이후 큰 입력 패널·최초 안내·상시 자동 재추천 모두 DOM 0개. 작은 음성 버튼은 기존 팝업을 연다.
- 내 여행 이동 후 복귀: 결과 유지, 큰 입력 패널 0개.
- 844×390: 팝업 하단 323px, 메뉴 상단 331px.
- 320×400(200% 상당 리플로우): document 320/320, main 303/303, conversation 271/271로 가로 넘침 없음.
- 데스크톱 1280×800 영어: 작은 텍스트 버튼→입력→응답, 영어 결과와 보조 버튼, 큰 입력 패널 0개, 가로 넘침 없음.

캡처: `first-entry-mobile.png`, `listening-mobile.png`, `after-response-mobile.png`, `after-response-desktop-en.png`.

실제 Chrome 연결은 이 환경에서 사용할 수 없었다. iPhone 크기의 viewport 검증은 실제 iOS Safari, 동적 주소창, 소프트 키보드 및 실물 마이크 검증을 대체하지 않는다. 해당 항목은 현장 확인이 필요하다. 기존 음성 세션 제어 회귀 테스트는 유지했다.

## 47-2B 보존

시작 HEAD `c3515f154cb56fd212f8741ddd3888827e63ebbf`, main, clean에서 시작했다. 기존 로컬 커밋 `b3bdda4 → 7e2a064 → 2730e34 → c3515f1`을 그대로 보존하고 별도 UX 커밋을 추가한다. push, 운영 배포, DB, 환경변수, Docker 변경 없음.
