# Gajo AI Concierge (MVP, ontology-driven)

Agentic AI Digital Concierge for the Gajo Hot Spring Complex (Geochang, Korea),
built on the Runtime Operational Ontology (ROO-Core) + Gajo domain ontology.

> **Status: backend MVP compiled and wired; NOT yet end-to-end runtime-tested
> against a live MongoDB, and the frontend / Docker / auth layers are not yet
> implemented.** See "Remaining work" below before treating this as production-ready.

## Architecture

```
User Request → Orchestrator Agent → Runtime Operational Ontology →
Semantic Context Generation → Graph Traversal → Task Decomposition →
Agent Selection → Tool/API Execution →
Recommendation / Reservation / Safety Guidance → Concierge Response
```

The two `.ttl` files under `ontology/` (also copied into
`server/src/ontology-data/` so they ship inside the build) are loaded at
NestJS boot by `OntologyGraphService` using the `n3` library into an
in-memory RDF/JS `Store`. This store — **not** hardcoded prompt rules — is
the source of truth for every condition→risk expansion, program match,
rule evaluation and agent/task assignment. `OntologySyncService`
materializes ontology individuals (Facilities, Programs, Agents, Policies,
Rules, etc.) into MongoDB collections for fast CRUD/listing, but reasoning
(`semanticallyExpandsTo` traversal, rule firing) always goes back to the
graph.

## Backend (`server/`, NestJS + Mongoose + n3)

Implemented modules/services:
- `ontology/` — `OntologyGraphService` (TTL parsing, BFS traversal, subclass-aware
  individual lookup), `/api/ontology/*` endpoints.
- `schemas/` — Mongoose schemas for all required collections (Visitor, Companion,
  VisitorGroup, Reservation, Itinerary, RuntimeContext, Recommendation,
  ExecutionLog, plus a shared factory for the 14 ontology-individual
  collections: healthConditions, wellnessGoals, facilities, programs,
  environmentConditions, mobilityConditions, risks, policies, rules, agents,
  capabilities, tools, tasks, operations).
- `seed/` — `OntologySyncService` upserts ontology individuals into Mongo at boot.
- `context/` — `GraphTraversalService` (domain traversal helpers) +
  `RuntimeContextService` (semantic context creation, Korean keyword
  extraction fallback), `/api/context/*`.
- `planner/` — `SemanticPlannerService` (Operation → Task → Capability → Agent).
- `agents/` — `AgentOrchestratorService` (executes planned tasks, writes
  `ExecutionLog`).
- `recommendation/` — `RecommendationService` (explainable itinerary builder
  with an `evidence` chain of RDF triples), `/api/recommendations/*`.
- `reservation/` — `ReservationService` (mock availability/booking — the real
  integration point is `gajo:reservationApiTool`'s `apiEndpoint`),
  `/api/reservations/*`.
- `facility/` — `/api/facilities`, `/api/programs`, `/api/admin/facilities`,
  `/api/admin/programs`.
- `policy/` — `/api/policies`, `/api/rules`, `/api/rules/evaluate`.
- `admin/` — `/api/admin/dashboard`.
- `concierge/` — `ConciergeService.chat()`, the single entry point that runs
  the full architecture pipeline end to end, `/api/concierge/chat`.
- `visitor/` — basic Visitor/Companion profile CRUD, `/api/visitors/*`.
- `demo/` — `DemoModule` wraps `DemoSeedService`/`DemoSeedController`
  (`POST /api/demo/scenario`) which replays the exact spec demo scenario
  (58-year-old visitor + 78-year-old mother with knee pain, rainy/congested
  Saturday) through the real pipeline, in its own module to avoid a
  circular dependency with `SeedModule`.

`AppModule` wires all of the above plus `MongooseModule.forRoot()` (reads
`MONGODB_URI`, defaults to `mongodb://localhost:27017/gajo`) and a global
`ConfigModule`.

### Optional OpenAI context extraction

Natural-language extraction always runs the built-in deterministic Korean parser. To additionally enable the server-side OpenAI extractor, copy `server/.env.example` to `server/.env` and set:

```env
CONTEXT_EXTRACTOR_PROVIDER=openai
OPENAI_API_KEY=your_server_side_key
OPENAI_CONTEXT_MODEL=your_structured_output_capable_model
OPENAI_CONTEXT_TIMEOUT_MS=8000
MAX_CONTEXT_LLM_CALLS_PER_SESSION=3
# Optional admin-only estimates; set these to the configured model's current pricing.
OPENAI_CONTEXT_INPUT_USD_PER_MILLION_TOKENS=
OPENAI_CONTEXT_OUTPUT_USD_PER_MILLION_TOKENS=
```

Restart the server after changing these values. The key remains server-side and is never returned to the browser. If configuration is absent, the request times out, or provider output is invalid, Gajo continues with deterministic extraction only. Extraction diagnostics are stored under the runtime context's admin/debug `raw.extractionDebug` field; provider request and response bodies are not persisted.

### Run

```bash
cd server
npm install
npm run build   # verified: compiles cleanly
# requires a MongoDB instance reachable via MONGODB_URI (default localhost:27017/gajo)
npm run start:prod   # or: npm run start:dev
```

### Try the demo scenario

```bash
curl -X POST http://localhost:3000/api/demo/scenario
```

Or drive the real chat endpoint directly:

```bash
curl -X POST http://localhost:3000/api/concierge/chat \
  -H 'Content-Type: application/json' \
  -d '{"rawMessage":"이번 토요일에 어머니를 모시고 가조온천에 하루 다녀오려고 합니다. 어머니는 78세이고 무릎이 좋지 않습니다. 비가 올 것 같고 사람이 많을까 걱정됩니다.","visitorAge":58,"companions":[{"age":78,"relationship":"mother","healthConditions":["kneePain","limitedMobility"]}],"weather":"rainyWeather","congestion":"highCongestion"}'
```

Inspect the raw ontology / graph traversal directly:

```bash
curl http://localhost:3000/api/ontology/stats
curl "http://localhost:3000/api/ontology/expand?uri=<full-kneePain-URI>"
```

## Remaining work (not yet done in this MVP pass)

- **Not yet build-verified end to end**: `npm run build` succeeds, but the
  app has not yet been booted against a live MongoDB to confirm the demo
  scenario actually produces the expected indoor low-intensity itinerary.
- **JWT auth**: dependencies installed, no auth module/guard implemented yet.
- **Frontend**: no React/Vite/PWA code yet (Home, AI Concierge chat,
  Itinerary View, Facility Map/Leaflet, Admin Dashboard, Ontology Explorer
  pages all pending).
- **Docker**: no Dockerfiles / docker-compose.yml / nginx config yet for
  `gajo.odex.kr`.
- **Seed data beyond ontology materialization**: no separate demo Mongo
  fixtures beyond what `OntologySyncService` upserts from the TTL files.

## Ontology reference files

See `ontology/` for the original spec prompt, TTL files, and package readme
kept in-repo for documentation purposes (the copies actually loaded at
runtime live in `server/src/ontology-data/`).

## 프론트엔드 (`client/`, React + Vite + TypeScript + PWA)

Vite React-TS PWA로 스캐폴딩 완료, 아래 6개 페이지 모두 구현됨:
- **Home** — 온톨로지 상태 요약 + 빠른 시나리오 진입
- **AI 컨시어지 (채팅)** — `/api/concierge/chat` 호출, 스펙 데모 시나리오 원클릭 실행 버튼 포함
- **일정 보기 (Itinerary View)** — 추천 프로그램/시설/예약 가능 여부/증거 체인(RDF triple) 표시
- **시설 지도 (Leaflet)** — `/api/facilities` 기반 마커 표시 (가조면 인근에 결정론적 배치)
- **관리자 대시보드** — `/api/admin/dashboard` 집계 통계 + 최근 컨텍스트/추천/예약 테이블
- **온톨로지 탐색기** — 클래스/속성/개체 목록 + `semanticallyExpandsTo` 그래프 확장 테스트 UI

`npm run build` 검증 완료 (오류 없음). Vite dev 서버는 `/api` 요청을 `localhost:3000`으로
프록시하도록 설정되어 있고 (`vite.config.ts`), `vite-plugin-pwa`로 서비스워커/매니페스트가
자동 생성됩니다 (report.odex.kr 프로젝트에서 배운 대로 `index.html`/`sw.js`는 no-cache 처리).

### 프론트엔드 실행
```bash
cd client
npm install
npm run dev      # http://localhost:5173, /api는 :3000으로 프록시
# 또는
npm run build && npm run preview
```

## 실제 위치 기반 "내 주변 식당 찾기" (`server/src/nearby`, `client/src/pages/NearbyRestaurantsPage.tsx`)

온톨로지에 등록된 Gajo 자체 Program/Facility 추천과는 별도로, 방문객의 **실제 GPS 위치**를 기준으로
카카오 로컬 API(무료 REST API 키, 일 100,000건 쿼터)를 프록시하여 진짜 주변 식당을 검색하고,
건강식/약선·채식/사찰음식·한식·해산물 등으로 자동 분류해 카테고리 탭으로 보여줍니다. 식당을
선택하면 OSRM(무료, 키 불필요) 도보 경로를 지도에 미리보기로 표시하고, "길찾기 시작" 클릭 시
구글맵/카카오맵으로 실제 내비게이션을 넘겨줍니다(자체 턴바이턴 내비게이션은 재구현하지 않음).

- 백엔드: `NearbyModule` → `/api/nearby/status`, `/api/nearby/restaurants?lat=&lng=&radius=`,
  `/api/nearby/route?...`, `/api/nearby/navigation-links?...`. 서버 환경변수 `KAKAO_REST_API_KEY`
  가 없으면 해당 기능만 503으로 명확히 안내되고 나머지 서비스는 정상 동작합니다.
- 프론트: `/nearby-restaurants` 페이지에서 `navigator.geolocation`으로 위치 권한 요청(거부 시
  가조 온천단지 중심으로 자동 대체), 카테고리 탭, Leaflet 지도 + 경로 폴리라인, 길찾기 딥링크.
- 컨시어지 채팅(`ConciergeService.chat`)이 "주변 건강식 식당 추천해주세요" 류의 자연어를
  `nearbyRestaurantIntent: true`로 감지해 채팅 결과 카드에 "내 주변 식당 찾기" CTA를 노출합니다.

### 카카오 REST API 키 발급 (무료)
1. https://developers.kakao.com → 로그인 → 내 애플리케이션 → 애플리케이션 추가
2. 앱 선택 → 앱 키 → **REST API 키** 복사 (JavaScript 키가 아님)
3. 서버 환경변수로 등록: `KAKAO_REST_API_KEY=<발급받은 키>` (`docker-compose.yml`의
   `api` 서비스 environment 또는 `.env`)

## Docker 배포 (gajo.odex.kr)

`docker-compose.yml` + `server/Dockerfile` + `client/Dockerfile` + `client/nginx.conf`
작성 완료. 상세 절차는 `docs/DEPLOY_DOCKER.md` 참고. mongo/api/client 3-컨테이너 구성이며
`client`만 호스트 포트(8090)에 노출됩니다.

## 백엔드 실제 구동 검증 완료 (2026-07-08)

로컬 MongoDB 7.0 바이너리로 `npm run build` 산출물을 실제 부팅하여 검증:
- `POST /api/demo/scenario` 실행 결과, 스펙에 명시된 정확한 데모 시나리오
  (78세 어머니, 무릎 통증, 우천, 혼잡)가 `kneePain --semanticallyExpandsTo-->
  shortWalkingDistance/elevatorAvailable/fallRisk`, `rainyWeather -->
  indoorPreference/fallRisk`, `highCongestion --> reservationPriority/congestionRisk`로
  올바르게 그래프 확장되고, "우천 시 실내 프로그램 우선 규칙"이 발동하며,
  최종적으로 **저강도 실내 온천 힐링 코스 + 지역 약선식 힐링 식사**가
  (실외 산책로 등은 환경 영향으로 자동 배제된 채) 증거 체인(evidence)과 함께
  추천되는 것을 확인함 — 스펙의 기대 출력과 정확히 일치.
- `/api/ontology/stats`, `/api/facilities`, `/api/admin/dashboard` 등 주요
  엔드포인트도 정상 응답 확인.
- 프론트엔드 6개 페이지 모두 빌드 성공 및 dev 서버 기동 확인.

## Live runtime weather configuration

The live runtime endpoint uses Open-Meteo without an API key. The canonical default for the Gajo hot-spring area is latitude `35.7423`, longitude `127.9528`, and timezone `Asia/Seoul`.

Optional server environment overrides:

```text
GAJO_LATITUDE=35.7423
GAJO_LONGITUDE=127.9528
GAJO_TIMEZONE=Asia/Seoul
OPEN_METEO_TIMEOUT_MS=3500
```
## Nearby Restaurants 로컬 설정

실제 비밀값은 소스나 클라이언트 환경변수에 넣지 않습니다. `server/.env.example`을 `server/.env`로 복사한 뒤 서버 전용 `KAKAO_REST_API_KEY`에 Kakao Developers의 **REST API 키**를 설정합니다. 선택적인 `KAKAO_LOCAL_TIMEOUT_MS`의 기본값은 5000ms입니다.

Docker Compose에서는 저장소 루트 `.env`에 같은 값을 설정합니다. Compose는 키를 API 컨테이너에만 전달하며 클라이언트 번들에는 포함하지 않습니다. 환경변수는 시작 시 읽으므로 변경 후 API 서버 또는 API 컨테이너를 재시작해야 합니다.

```powershell
Invoke-RestMethod http://localhost:3000/api/nearby/status
# configured=True, state=READY 확인

Invoke-RestMethod "http://localhost:3000/api/nearby/restaurants?lat=35.6987576&lng=128.0231031&radius=2500"
# total, resultStatus, groups 확인
```

브라우저에서는 `http://localhost:5173/nearby-restaurants`를 열고 현재 위치 사용 버튼을 선택합니다. GPS는 검색 요청에만 사용되고 저장되지 않습니다. 설정이나 외부 API에 문제가 있으면 주변 검색만 사용할 수 없다는 안내를 표시하며 나머지 컨시어지 기능은 계속 동작합니다.
