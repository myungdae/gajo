# Okcheon Phase 5A — Field Demo Action Readiness

## 1. Phase 5A overall status

Implemented the shared-engine field-demo readiness layer, manager workbench, semantic follow-up extensions, and continuity proofs. The current status is **READY FOR MANAGER VERIFICATION**. No evidence was automatically approved.

## 2. selected field-demo entities

The calculated work scope is 13 items: 옥천구읍, 정지용 생가, 정지용문학관, 옥천전통문화체험관, 둔주봉 한반도지형, 부소담악, 장계관광지, 장령산자연휴양림, 대박집, 한알천, 장인우렁쌈밥, 커피타임, and the unverified candidate CU 옥천역전점. The first 12 are canonical RDM records; CU 옥천역전점 remains outside operational RDM pending review.

## 3. readiness matrix

The manager API computes `SEMANTIC_READY`, `DISCOVERY_READY`, `CALL_READY`, `NAVIGATION_READY`, `TRIP_READY`, and `ACTION_READY` per canonical selection. Current calculated totals are: semantic 5/12, discovery 12/12, call 6/12, navigation 1/12, trip 11/12, and action 7/12. 옥천구읍 is intentionally a non-operational concept. CU 옥천역전점 is 0/1 Action Ready and shown separately as a candidate.

## 4. outstanding manager approvals

The deduplicated `DEMO_CRITICAL` task groups are coordinate approval, phone verification, semantic alignment, and essential-shopping approval. `DEMO_CRITICAL` is confined to Copilot verification work and is not read by visitor recommendation ranking. 부소담악 coordinate evidence and CU 옥천역전점 listing evidence are `EVIDENCE_READY`; neither is `MANAGER_APPROVED`. Other missing facts remain `EVIDENCE_COLLECTION_REQUIRED`.

## 5. Golden Journey 1 exact result

The exact query resolves dynamically through EXKO concepts and eligible RDM records to 정지용 생가 → 정지용문학관 → 대박집. The two cultural stops have save-to-trip only; 대박집 has call and save-to-trip. None gains navigation without approved coordinates.

## 6. Golden Journey 2 exact result

The selected official pair is 둔주봉 한반도지형 and 부소담악. Both remain explicit requested destinations. Only 둔주봉 can currently provide safe navigation/order evidence; the system does not fabricate a distance order for 부소담악. Cafe insertion uses eligible Okcheon RDM cafes, and the two-hour follow-up keeps the explicit journey intent.

## 7. Golden Journey 3 exact result

The elderly two-hour request returns Okcheon candidates without claiming accessibility, low walking burden, or parking where those facts are unknown. Weather and time constraints may narrow candidates, but category never becomes an accessibility claim.

## 8. Golden Journey 4 exact result

Essential-shopping discovery remains empty for visitors. CU 옥천역전점 is the demo-critical evidence-ready candidate, while all three CU records remain unverified and inactive until explicit manager review/activation.

## 9. Golden Journey 5 exact result

Rain replanning keeps the same TripSession and explicit/must-visit context. Only records with explicit indoor evidence are treated as indoor; the journey is not reset and unsupported outdoor suitability is not invented.

## 10. semantic follow-up continuity

The semantic context survives the six requested follow-ups. “정지용 관련 장소만 보여줘.” and “음식은 빼줘.” constrain the graph result; cafe and distance use the retained context; “다른 곳도 있어?” stays on the semantic route; and one hour is parsed as 60 minutes rather than invoking generic recommendation.

## 11. explainability result

Visitor reasons come from explicit graph edge reasons and source-backed concepts: 정지용-related cultural space, 옥천구읍 literary/cultural movement, and Okcheon local-food relation. Internal graph syntax and private reasoning are not exposed.

## 12. My Trip full-loop result

The existing shared `regional-concierge-trip-session-v1:okcheon` flow saves the itinerary, starts execution, identifies current/next stops, and restores the continuation entry. No Okcheon-specific session implementation was added.

## 13. PWA reopen result

Reopen tests preserve anonymousTripId, itinerary, savedPlaces, execution, explicit destinations, and semantic context. Visitor PWA update/build tests cover the latest generated bundle and stale-worker recovery path.

## 14. location movement result

Changing runtime location from 옥천구읍 to another 옥천 location updates only Location Context. Anonymous identity, journey, saved places, execution pointer, explicit destinations, and applicable semantic context remain unchanged.

## 15. Copilot → RDM → Concierge proof

The 부소담악 fixture proves: evidence proposal → rejection of unconfirmed approval → explicit manager approval → RDM coordinate update → readiness recomputation → effective dataset update → PlaceDiscovery/Concierge destination action. No source edit is required after approval.

## 16. field-test checklist

The reusable practical checklist is [okcheon-field-test-checklist.md](./okcheon-field-test-checklist.md). It covers link opening, semantic journey, explanations, save/start, follow-up, movement, rain replan, reopen/continue, essential shopping, action safety, and region leakage.

## 17. cross-region non-interference

Fixtures snapshot Hapcheon and Gajo RDM before Okcheon evidence changes and prove byte-equivalent scoped rows afterward. Client tests preserve each region’s TripSession identity. EXKO rejects non-Okcheon semantic use, and Copilot access/query paths remain region-scoped.

## 18. Guide status

Guide answers “옥천은 어느 정도 준비됐나요?” by distinguishing shared-platform connection, working EXKO literary semantics, ongoing operational verification, manager-verification readiness, and the absence of a public-launch claim.

## 19. remaining blockers

Meaningful multi-stop navigation still needs manager-approved coordinates. Essential shopping needs candidate verification and activation. Phone, hours, parking, and accessibility remain unknown for multiple selected records. Cafe navigation is unavailable. These are visible as calculated blockers rather than hidden by test success.

## 20. FIELD-DEMO READY / READY FOR MANAGER VERIFICATION decision

**READY FOR MANAGER VERIFICATION.** The semantic/My Trip loop works, but manager approvals remain outstanding, navigation coverage is only 1/12 canonical demo records, and essential shopping is not operational. Therefore the FIELD-DEMO READY gate is not met.

## 21. files changed

Changes add regional demo selection/evidence configuration, shared readiness calculation/tests, Copilot API/UI integration, semantic one-hour/alternative continuity, Guide wording/tests, Okcheon restoration and approval-to-action proofs, this report, and the field checklist. No entity-count expansion, commit, or push was performed.

## 22. tests/build results

Focused Phase 5A tests passed (83/83). The full server suite passed (416/416) and the full client suite passed (193/193). Server and client production builds passed, including generation of the visitor service worker and latest hashed bundles. `git diff --check` passed with line-ending notices only.
