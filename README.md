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
