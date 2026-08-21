# Okcheon Phase 1 readiness audit

Audit date: 2026-08-22  
Scope: repository evidence only; no production database, credentials, DNS, TLS, or external data was changed.

## 1. Okcheon current architecture status

Okcheon is a registered third-region **test/configuration shell**, not a field-ready region. It uses the shared Local Concierge, recommendation pipeline, Regional Data Manager (RDM), Copilot authorization model, Core Destination engine, Roo-style runtime pipeline, TripSession implementation, and visitor PWA. There is no `OkcheonConciergeService`, `OkcheonRoo`, `OkcheonCopilot`, or Okcheon journey composer.

Existing repository assets are:

- server and client `RegionConfig` entries;
- four name/semantic candidate records, all `runtimeDataStatus: UNKNOWN`;
- a four-node Turtle semantic file with three `containedInPlace` relations;
- regional routes and a region-specific web manifest;
- shared TripSession, recommendation, discovery, search fallback, Copilot, and authorization code paths;
- isolation tests covering RDM datasets, anchors, search context, weather, routes, manifests, and TripSession.

Not present or not configured: Okcheon RDM bootstrap, verified operational records, center/bounds, weather reference, usable nearby/search fallback, coordinates, operating data, Core designation, manager credential, and an accurate Guide answer for onboarding status.

## 2. Hapcheon/Gajo/Okcheon parity matrix

Classification describes Okcheon. “H/G” is the evidence baseline for Hapcheon/Gajo.

| Capability | H/G baseline | Okcheon | Evidence/constraint |
|---|---|---|---|
| Natural-language visitor intake | Ready | READY | Shared intake and region routing |
| Current-turn result | Ready | READY | Shared result/action model; actions remain empty when unverified |
| Conversational anchor | Ready | READY | Shared anchor code rejects cross-region anchors |
| Discovery context | Ready | READY | Shared context is region-scoped |
| Distance follow-up | Ready with coordinates | DATA_REQUIRED | No Okcheon coordinates |
| Alternatives | Ready with candidate depth | DATA_REQUIRED | Four records have no café/food alternatives |
| Explicit named destinations | Ready | PARTIAL | Three configured places/four server candidates resolve; operational facts unknown |
| Multi-destination journeys | Ready | PARTIAL | Shared composer works, but ordering/travel estimates lack coordinates |
| PLACE_CONCEPT contextual resolution | Gajo ready | SEMANTIC GAP / CONFIG_REQUIRED | `oldTownArea` exists in TTL/data but is not configured as a `placeConcept` with typed relations |
| RDM-first discovery | Ready | PARTIAL | Shared effective dataset exists; no Okcheon DB bootstrap and no verified records |
| Search fallback | Ready where bounded | CONFIG_REQUIRED | Okcheon lacks center/bounds; Nearby reports `NOT_CONFIGURED` |
| Search -> Copilot | Ready | CONFIG_REQUIRED | Shared ingestion exists and carries `regionId`; search cannot safely start without bounds |
| Action safety | Ready | READY | Unknown records expose no call/navigation/reservation actions |
| TripSession | Ready | READY | `regional-concierge-trip-session-v1:okcheon` |
| Saved-trip restoration | Ready | READY | Shared region-keyed storage and anonymous restore |
| My Trip | Ready | READY | Shared UI/state |
| Itinerary editing | Ready | READY | Shared region checks and eligibility checks |
| Essential shopping | Hapcheon search-capable | DATA_REQUIRED / CONFIG_REQUIRED | Okcheon RDM returns none; bounded fallback unavailable |
| Weather/runtime context | H/G configured | CONFIG_REQUIRED | No `weatherReference`; returns `UNAVAILABLE`, never another region’s weather |
| Roo runtime | Shared | READY | Context -> State/Event -> Decision -> Action remains shared; operational context is sparse |
| Regional Copilot | Shared | PARTIAL | Auth/queue isolation works; no Okcheon manager and no operational queue exercise |
| Core Destination | Hapcheon designated | CONFIG_REQUIRED | Engine supports any region; Okcheon has no approved designation (correct for Phase 1) |
| Visitor PWA | Ready | PARTIAL | Route/manifest/install/SW shared; branding uses shared 192 icon and Gajo-named 512 asset |
| Guide Copilot compatibility | Global/shared | ENGINE_GAP | “옥천에서도 되나요?” has no approved status knowledge and becomes a review candidate |

## 3. Okcheon RDM inventory

Repository baseline (not a claim about an inaccessible deployed MongoDB):

| Category | Total | VERIFIED | PARTIAL | UNVERIFIED/UNKNOWN | ACTIVE | Coordinates | Phone | Hours | Navigation/action eligible |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| LITERATURE_CULTURE | 2 | 0 | 0 | 2 | 0 operational RDM rows | 0 | 0 | 0 | 0 |
| TRADITIONAL_CULTURE | 1 | 0 | 0 | 1 | 0 operational RDM rows | 0 | 0 | 0 | 0 |
| TOURISM_NATURE (area concept) | 1 | 0 | 0 | 1 | 0 operational RDM rows | 0 | 0 | 0 | 0 |
| **Total** | **4** | **0** | **0** | **4** | **0 operational RDM rows** | **0/4** | **0/4** | **0/4** | **0/4** |

The four actual names are 정지용 생가, 정지용문학관, 옥천전통문화체험관, and 옥천 구읍 일대. The first three are concrete place candidates; the last is an area/place concept and must not receive a navigation action until a concrete destination is selected.

The RDM `onModuleInit` bootstrap seeds only Gajo and Hapcheon. Thus Okcheon is available through the static effective candidate dataset but is not created as audited ACTIVE RDM rows. The static `UNKNOWN` records also lack source provenance and cannot honestly be counted as VERIFIED, PARTIAL, or operational ACTIVE.

## 4. Okcheon semantic inventory

- Namespace: `https://okcheon.example/ontology#` (an example namespace, unsuitable as a durable production identity without governance).
- Turtle: four resources, Korean labels, three `schema:containedInPlace` relations into `oldTownArea`.
- Aliases: five alternate labels across the four master records.
- Area concept: `oldTownArea` exists but has no `PLACE_CONCEPT` entry in server `RegionConfig` and no typed runtime relations (`HAS_FACILITY`, `HAS_LODGING`, `NEARBY`).
- Attraction/food/café/lodging relations: none.
- Runtime semantic rules: none specific to Okcheon; the shared resolver can consume configured candidates/aliases but does not load this Turtle into the operational graph as an Okcheon subgraph.
- EXKO: the large shared RDF source mentions two Okcheon attractions, but generated/allowed EXKO runtime material is Hapcheon-scoped. Those triples must not be copied or silently activated for Okcheon.

## 5. Existing Okcheon regional configuration

Configured: id/name/service copy, accent/home copy, eight interests/categories, ontology namespace, three client places, four server candidates, known-place boundary exceptions, routes, and PWA manifest.

Missing: administrative level, canonical production namespace decision, center, county bounds, weather reference, semantic destinations/place concepts, discovery preferences, QR/deployment entry evidence, and verified nearby provider activation. Client `dataSources` labels KAKAO/Open-Meteo, but runtime correctly treats both as unavailable because operational coordinates are absent.

## 6. Accidental region-specific engine assumptions

| Finding | Classification | Disposition |
|---|---|---|
| RDM bootstrap loop hardcodes only Gajo/Hapcheon | B: regional configuration expressed in engine code | Replace with registry-driven, explicitly activated regional bootstrap in Phase 2 |
| `MovementPlan` returns early for every non-Gajo region | A: shared engine behavior gap | Generalize to region-scoped operational datasets; do not add an Okcheon branch |
| Gajo default region throughout legacy routes/APIs | C: legitimate backward-compatibility default | Retain, but continue requiring explicit region on regional routes/state |
| Gajo ontology URIs for generic weather conditions | A: shared vocabulary debt | Move generic runtime concepts to the shared runtime namespace when ontology migration is scheduled |
| Copilot UI defaults to `hapcheon` if a principal has no assigned region | C with UX risk | Platform Admin may select globally; a regional manager must never rely on the fallback |
| Hapcheon-only initial Core list | B/C | Legitimate current designation fixture; never copy it to Okcheon |
| Numerous Hapcheon/Gajo literals in specs | D: test fixtures | Keep unless a reusable cross-region matrix better expresses the invariant |

## 7. Engine gaps

1. Global Guide knowledge has no implementation-status answer for “옥천에서도 되나요?”.
2. Movement-plan enrichment is disabled for all non-Gajo regions.
3. There is no single end-to-end reusable non-interference golden harness combining RDM, search candidate, Copilot queue, Core fixture, and TripSession; component-level isolation tests exist and pass.
4. The generic runtime ontology still uses Gajo-prefixed weather individuals.

## 8. Configuration gaps

Okcheon center/bounds, weather reference, explicitly activated RDM bootstrap membership, durable ontology namespace, place-concept configuration, safe search-provider boundary, deployment/QR URL, and approved Core Destination configuration are absent.

## 9. Data gaps

No repository-backed restaurant, café, lodging, convenience store, mart, parking record, accessibility detail, address, coordinate, phone, website, reservation link, opening hours, closure day, or field-verification timestamp exists for Okcheon. There is no safe nearby continuity anchor and insufficient category depth for alternatives.

## 10. Semantic gaps

The Turtle is metadata-only and not an operational semantic package. Missing are canonical production URIs, typed entity/category assertions appropriate to the shared resolver, concrete old-town relations, attraction/food/café/lodging/essential-shopping relations, distance-capable coordinates, and documented runtime rules.

## 11. Operational-verification gaps

All four records require source/provenance review and field verification. Every action-sensitive fact (identity, exact address/point, phone, hours/closures, website/reservation, parking/accessibility) is unverified. No deployed Okcheon RDM snapshot was available, so the audit does not claim database emptiness beyond repository bootstrap behavior.

## 12. Real Okcheon golden scenarios possible today

- Scenario A: **DATA_REQUIRED.** A chain starting at a real lodging/place and continuing café -> attraction -> food -> distance -> alternative is impossible: there is no lodging, café, food, or coordinate record.
- Scenario B: **PARTIAL structural demo only.** “정지용 생가하고 정지용문학관 가고 싶어요” can resolve two real repository names and preserve the explicit journey. “어디부터,” meal insertion, and two-hour feasibility cannot be answered credibly without coordinates, duration, and food data.
- Scenario C: **DATA_REQUIRED.** Convenience/mart discovery returns no RDM entities, and bounded search is not configured.

## 13. Search -> Copilot readiness

Architecture is present: RDM shortage -> bounded Kakao search -> structured `UNVERIFIED` search entity -> `ingestSearchCandidate({regionId})` -> Regional Copilot. Candidate queue/detail/write authorization is checked server-side; a Hapcheon manager is denied access to an Okcheon candidate, while a Platform Admin can inspect regional queues. Raw visitor message is not persisted in the candidate.

Activation is **CONFIG_REQUIRED** because Okcheon lacks bounds/center/provider status. Search must remain disabled until county bounds are approved. No Okcheon credential should be created in Phase 1.

## 14. TripSession/region isolation

Active namespace: `regional-concierge-trip-session-v1:okcheon`. Archive prefix: `regional-concierge-trip-archive-v1:okcheon:`. Load rejects sessions whose embedded `regionId` differs and strips mismatched runtime context. Anonymous server sync also validates region equality. PWA update code does not clear local/session storage. Existing tests prove Gajo, Okcheon, Hapcheon, and other regional sessions have independent IDs/keys and that cross-region runtime/search/anchor data is rejected.

The requested full before/after golden is not yet one reusable test; that is an engine-test infrastructure gap, not evidence that isolation is absent.

## 15. Core Destination readiness

The shared Core engine is region-parameterized and server-authorized. Okcheon has no hardcoded Core list, which is correct. Manager-review candidates from current actual data are 정지용 생가, 정지용문학관, and 옥천전통문화체험관. `옥천 구읍 일대` is a coverage/area concept rather than a concrete action destination. These are candidates only; designation requires explicit manager approval after verified RDM identity/category/alias coverage. Core metadata provides coverage health only and does not boost ranking or bypass action safety.

## 16. PWA/mobile readiness

Shared mobile UI, composer, safe-area CSS, optional installation, update flow, and service worker are present. `/okcheon` routes to the shared visitor app and selects `manifest-okcheon.webmanifest`; id/start/scope are all `/okcheon`, with standalone display and 192/512 icons. Gaps: no audited production QR/link, no Okcheon-specific production deployment proof, and the 512 icon filename is `gajo-ai-icon-512.png` even though the binary is reused. The service worker scope is shared `/`, which is intentional for one engine; TripSession persistence remains region-keyed.

## 17. Guide compatibility

The Guide is correctly global/read-only and does not touch visitor PWA or TripSession. It cannot currently accurately answer “옥천에서도 되나요?” from approved knowledge; it returns a review candidate. Required approved wording should distinguish “the shared app shell recognizes Okcheon” from “Okcheon onboarding and verified field data are incomplete,” and must not claim production readiness.

## 18. Minimum field-demo dataset recommendation

Prioritize coverage, not count. Recommended target: approximately 12-16 verified concrete records, subject to evidence availability:

- 3 representative attractions/culture places (begin by verifying the three existing concrete candidates);
- 2 restaurants with different service profiles;
- 2 cafés near at least one verified anchor;
- 1-2 lodging records to support continuity;
- 1 experience with booking/seasonality facts where applicable;
- 2 convenience/mart records;
- 1-2 parking/accessibility records or attributes tied to the main cluster.

For every record require canonical identity, source URL/type/date, category/type, address and precise coordinates. Add phone, website/reservation, hours/closures, parking, accessibility, and walking access only when evidenced. A credible demo also needs at least two alternatives in café/food/essential-shopping and enough coordinate coverage to exercise distance and two-hour planning.

## 19. Evidence-based onboarding/readiness assessment

These are coarse bands derived from enumerated capability checks, not fabricated precision:

| Dimension | Assessment | Derivation |
|---|---:|---|
| Shared engine readiness | **High (~80%)** | Most shared intake, journey, action safety, session, Copilot, Core, and PWA paths already accept Okcheon; movement enrichment, Guide status, and unified golden harness remain |
| Regional configuration | **Low-medium (~40%)** | Identity/copy/routes/categories/manifest exist; bounds, weather, provider activation, durable namespace, semantic concepts, and deployment entry do not |
| RDM operational coverage | **Near zero (0%)** | 0 verified operational Okcheon records out of 4 static unknown candidates |
| Semantic coverage | **Low (~20%)** | Four labels and three containment edges exist; no operational graph/rules or category network |
| Field-demo readiness | **Low (~15%)** | UI shell and explicit two-name journey work structurally; all operational scenarios and safe actions lack data |

The evidence supports the proposition: remaining onboarding work is predominantly data, verification, semantic packaging, and configuration. It does not require a new application.

## 20. Exact recommended Phase 2 onboarding work

1. Approve Okcheon administrative scope, center/bounds, weather reference, canonical namespace, and search boundary.
2. Establish a source ledger and verify the three existing concrete identities; decide whether the old-town area is a managed `PLACE_CONCEPT`.
3. Collect the minimum coverage dataset with provenance, staging every record as unverified/reverification-required until manager approval.
4. Make RDM bootstrap/activation registry-driven and opt-in; snapshot Gajo/Hapcheon before and after.
5. Package Okcheon aliases/relations in a region-scoped semantic artifact and wire it to the shared resolver; do not copy EXKO/Hapcheon/Gajo triples.
6. Generalize movement enrichment to the shared regional operational dataset.
7. Add the reusable cross-region non-interference golden harness covering discovery, saved trip/place, bounded fallback candidate, Copilot visibility/write isolation, and a Core fixture.
8. Add approved Guide implementation-status knowledge and tests for “옥천에서도 되나요?”.
9. Run the three visitor goldens; keep unavailable steps explicitly `DATA_REQUIRED` until they pass using verified entities.
10. Present representative-place candidates to the future Okcheon manager; designate Core coverage only after explicit approval.
11. Create the authorization assignment `regions: ["okcheon"]` only when an actual manager is appointed; create no password in data/code.
12. Audit production QR/link, manifest icon branding, HTTPS/service-worker behavior, mobile safe areas, and journey restoration on target devices.

## 21. Files changed

- `docs/okcheon-phase-1-readiness-audit.md` (this audit only).

No application behavior, data, credentials, or production configuration was changed.

## 22. Tests/build results

- Server full test: **PASS**, 42 suites / 382 tests.
- Client full test: **PASS**, 189 tests.
- Server production build: **PASS**.
- Client production build/PWA generation: **PASS**; Vite warns that Node 22.11.0 is below its recommended 22.12+ patch level.
- `git diff --check`: run after creating this report.
- No commit or push performed.
