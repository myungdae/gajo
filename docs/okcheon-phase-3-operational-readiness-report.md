# Okcheon Regional Onboarding — Phase 3 Operational Readiness Report

Assessment date: 2026-08-22  
Decision rule: official-source identity is not operational verification. No record was auto-verified or manager-approved.

## 1. Phase 3 overall result

Phase 3 is implemented as an honest operational-verification layer on the shared regional engine. Okcheon remains platform-onboarded but **not field-demo ready**. The dataset is substantially diagnosable and reviewable, but coordinate/action coverage is still too low for credible field operation.

## 2. Total entity count

The canonical Okcheon dataset remains **33** entities. Phase 3 did not inflate the canonical count. Three convenience stores are separate search-evidence candidates awaiting review.

## 3. ACTION_READY count

**1/33**: `dunjubongKoreanPeninsula` (둔주봉 한반도지형). It is the only record with usable stored coordinates and therefore the only navigation-ready record.

## 4. DISCOVERY_READY count

The summary reports **30/33 discovery-ready**, derived as records with enough identity/location evidence for safe discovery, including the single action-ready record. Classification detail is: ACTION_READY 1, DISCOVERY_READY 1 (`oldTownArea`, a non-operational place concept), NEEDS_COORDINATES 28, NEEDS_OPERATIONAL_VERIFICATION 3, INSUFFICIENT_EVIDENCE 0.

## 5. VERIFIED/PARTIAL/UNVERIFIED counts

- Source dataset: VERIFIED **0**, PARTIAL **33**, UNVERIFIED **0**.
- RDM bootstrap state: VERIFIED **0**, PARTIAL **0**, UNVERIFIED **33**, lifecycle ACTIVE **33**.

These are two different layers: `PARTIAL` describes runtime data completeness; `UNVERIFIED` is the RDM human-review status. ACTIVE does not imply VERIFIED.

## 6. Coordinate coverage

**1/33 (3.0%)**. Reliable addresses are retained as evidence, but an address is never treated as coordinates. No live geocoder/provider credential was available in the repository, so no coordinate candidate was silently created or promoted. Missing-coordinate work is emitted to Copilot with provenance and manager action.

## 7. Navigation-ready count

**1/33**. Navigation is exposed only for 둔주봉 한반도지형. All other entities suppress navigation until coordinate evidence passes the verification boundary.

## 8. Call-ready count

**14/33**. Call eligibility is derived only from entity-specific phone evidence. Generic tourism-office or nearby-facility numbers were removed from three scenic records rather than being presented as direct entity calls.

## 9. Hours coverage

- VERIFIED_HOURS: **0**
- SOURCE_REPORTED_HOURS: **1** (옥천전통문화체험관)
- NOT_APPLICABLE: **6** natural attractions
- UNKNOWN_HOURS: **26**

Outdoor records no longer receive fabricated `00:00–23:59` availability.

## 10. Parking/accessibility coverage

Parking: **0/33** evidence-supported. Accessibility: **0/33** evidence-supported. Unknown remains unknown; neither category nor photographs are used to infer mobility suitability.

## 11. Essential-shopping entities

Canonical/operational essential shopping remains **0**. Three actual candidates were staged as `SEARCH_EVIDENCE`, not canonical facts:

- CU 옥천역전점 — 옥천읍 중앙로 4, 043-732-4540
- CU 옥천청산점 — 청산면 지전1길 3
- CU 옥천이원점 — 이원면 묘목로 101, 043-731-7799

They have no stored coordinates, navigation, or automatic approval. Copilot emits `ESSENTIAL_SHOPPING_CANDIDATE` tasks for manager review.

## 12. Official 9경 operational status

All **9/9** official scenic identities are canonical and diagnosable. 둔주봉 is ACTION_READY. 부소담악, 장령산자연휴양림, 장계관광지, 금강유원지, and 옥천구읍 have address/location evidence but require coordinate or concept-specific review. 옛 37번 국도변 벚꽃길, 용암사 일출, and 향수호수길 lack a sufficiently precise stored address/location target and require operational verification. None was promoted to VERIFIED. The nine remain prioritized in the shared matrix and Copilot batches.

## 13. Regional Copilot verification tasks

The queue adds five deduplicated, region-batched task types: `MISSING_COORDINATES`, `PHONE_VERIFICATION`, `HOURS_VERIFICATION`, `PARKING_VERIFICATION`, and `ACCESSIBILITY_VERIFICATION`, plus three entity-level `ESSENTIAL_SHOPPING_CANDIDATE` tasks. Each operational batch carries affected entities, missing fact, evidence/provenance, visitor impact, and recommended manager action. Copilot proposes; a human decides. Existing approval APIs do not safely approve every field independently, so these remain review tasks rather than automatic RDM mutations.

## 14. Core operational health

The shared Core engine can review the nine official scenic records without designating them automatically. Warnings now include canonical/RDM state, lifecycle, coordinates, discovery, navigation, aliases, and category eligibility through the operational matrix. Current Core conclusion: canonical coverage is complete, but VERIFIED coverage is 0 and navigation readiness is 1/9; broad Core designation is not justified.

## 15. Exact Golden Flow A result

Anchor: **둔주봉 한반도지형**, the only usable-coordinate anchor. “근처 카페 있어?” returns real Okcheon café candidates; follow-ups retain Okcheon context and can return a real attraction, food entity, and alternative. Because comparison entities lack verified coordinates, the flow deliberately emits **no distance and no navigation claim**. Result: discovery continuity passes; credible coordinate-based nearby/distance continuity does not yet pass.

## 16. Exact Golden Flow B result

“둔주봉 한반도지형하고 부소담악 가고 싶어요” preserves exactly both requested canonical labels. The shared explicit-journey machinery retains constraints for ordering, food insertion, and two-hour replanning. No unrelated destination replacement is allowed. Result: constraint preservation passes; a fully actionable route does not, because 부소담악 has no verified coordinate.

## 17. Exact Golden Flow C result

Convenience-store/mart language uses the shared essential-shopping taxonomy. The three CU records appear only as cautious search-backed Copilot candidates; they do not resolve as canonical visitor entities and do not expose navigation. “다른 데는?” can rotate evidence candidates without pretending they are verified. Result: safe candidate discovery passes; operational shopping usability remains blocked.

## 18. Exact Golden Flow D result

For the 70대 어머니 / limited-walking scenario, the engine may return Okcheon options but makes no accessibility, low-walking, parking, or barrier-free claim because coverage is 0. Result: safety boundary passes; a confident mobility-suitable two-hour itinerary is not supported.

## 19. Exact Golden Flow E result

With an existing Okcheon trip and rain context, the shared weather/replan logic keeps the region and TripSession and limits alternatives to Okcheon `ACTIVITY`/experience records. It does not label an entity indoor-safe merely from category or invent current suitability. Result: isolated conservative replanning passes; real-time operational suitability remains unverified.

## 20. TripSession/My Trip result

Okcheon uses `regional-concierge-trip-session-v1:okcheon`. A two-stop 둔주봉 + 부소담악 journey saves, reloads, retains its anonymous trip identity and order, and exposes departure navigation only for the action-safe 둔주봉 stop. Gajo and Hapcheon session identities and saved places remain unchanged.

## 21. PWA update continuity

The visitor update path does not clear trip storage, performs the controlled bundle reload, and restores My Trip. The Okcheon full-journey regression covers save → reload/update → visibility with the same regional identity.

## 22. Cross-region non-interference result

Pass. Region-scoped RDM bootstrap, Copilot candidates/tasks, TripSession archives, saved places, Core inputs, search evidence, configuration, and weather remain isolated. Permanent invariant: **NO CROSS-REGION SIDE EFFECTS**. Okcheon operations do not mutate Gajo or Hapcheon fixtures/state.

## 23. EXKO/semantic readiness

No operational Okcheon EXKO subgraph exists and no Hapcheon triples were copied. The boundary remains: official/verified RDM owns operational facts; EXKO may later add region-scoped meaning and relationships. The planned 정지용 → related cultural places → 옥천구읍 → verified nearby food → runtime journey path is an architecture test only, not asserted truth. Future Okcheon triples must be region-scoped and must not influence Hapcheon ranking/context.

## 24. Guide answer status

Pass. Guide recognizes “옥천도 지금 쓸 수 있나요?” and distinguishes platform onboarding from public field readiness: Okcheon data and shared platform functions are connected, while field-ready navigation and operational verification remain incomplete.

## 25. Remaining blockers

The blockers are 32 missing verified coordinates, 0 verified RDM records, 0 operational essential-shopping entities, 0 parking evidence, 0 accessibility evidence, only 1 source-reported-hours record, incomplete phone coverage, no meaningful multi-entity distance calculation, and no manager approvals. Live closure/status and provider-backed coordinate evidence also remain unavailable.

## 26. Whether FIELD-DEMO READY is justified

**No.** Discovery breadth, explicit journey preservation, My Trip continuity, safe Copilot review, and isolation work, but the completion bar requires usable essential shopping and meaningful multi-entity navigation/distance. Current evidence supports “platform-onboarded, operational verification in progress,” not “field-demo ready.”

## 27. Shared-engine changes

- Added a region-neutral operational matrix, readiness summary, task generation, and admin endpoint.
- Integrated operational tasks and essential-shopping task typing into shared Regional Copilot.
- Generalized movement-plan region API/configuration and retained region-scoped RDM bootstrap.
- Hardened action safety: no generic inherited phones, fake outdoor hours, unverified coordinates, or auto-verification.
- Extended Guide truthfulness and shared Okcheon golden/isolation/PWA regressions.
- No `OkcheonActionService`, `OkcheonNavigationService`, `OkcheonRoo`, or `OkcheonCopilot` was created.

## 28. Files changed

Phase 3 additions/edits include:

- `server/src/regional-data/operational-readiness.ts`
- `server/src/regional-data/operational-readiness.spec.ts`
- `server/src/regional-data/regional-data.controller.ts`
- `server/src/regional-data/regional-data.service.ts`
- `server/src/regional-data/regional-data.service.spec.ts`
- `server/src/copilot/copilot.service.ts`
- `server/src/copilot/copilot.service.spec.ts`
- `server/src/concierge/okcheon-phase3-golden.spec.ts`
- `server/src/regions/okcheon/master-data.ts`
- `server/src/operations/okcheon-essential-shopping.search-candidates.json`
- `server/src/guide/guide-knowledge.ts`
- `server/src/guide/guide.service.spec.ts`
- `client/src/fullJourney.test.ts`
- this report

The worktree also contains the uncommitted Phase 1/2 onboarding changes and reports that Phase 3 builds upon. Nothing was committed or pushed.

## 29. Tests/build results

Final verification results are recorded after the last code-format pass:

- Focused operational/Copilot/Guide/Golden tests: **77/77 passed**
- Server full tests: **401/401 passed**
- Client full tests: **191/191 passed**
- Server production build: **passed**
- Client/PWA production build: **passed** (with a non-fatal warning that Node 22.11.0 is below Vite's supported 22.12+ patch level)
- `git diff --check`: **passed** (line-ending conversion notices only; no whitespace errors)

The structured 33-row matrix is available from `GET /api/admin/regional-data/operational-readiness?regionId=okcheon`; it includes every field required by the audit rather than hiding absent values.
