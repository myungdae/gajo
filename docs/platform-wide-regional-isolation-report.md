# Platform-wide Regional Isolation Hardening Report

## 1. isolation architecture

Shared engines are separated from regional truth using an explicit Regional Isolation Contract, composite identities, cloned regional configuration, region-keyed caches, scoped database queries, and namespaced visitor storage.

## 2. implicit default-region risks found

Fail-open Gajo defaults were found in Concierge, RuntimeContext, Recommendation, analytics, facility endpoints, RegionConfig, live weather/hydration, and client TripSession helpers. The context extraction cache also omitted region. These paths now require an explicit region or return safe unavailable status.

## 3. RDM isolation

RDM operational evidence uses `{regionId, canonicalEntityId}`. Existing and symmetric snapshot tests prove mutations do not change other regions, including same-label records.

## 4. Copilot isolation

Queues are region-filtered and server authorization is authoritative. Platform admin can access every explicit region; each regional manager can read/write only assigned regions. Missing region fails even for platform admin.

## 5. semantic/EXKO isolation

EXKO retains named regional subgraphs and region-filtered nodes, aliases, relations, inverse traversal, and RDM alignments. The combined golden test proves Okcheon output contains no Hapcheon/Gajo entity.

## 6. PLACE_CONCEPT isolation

가조온천 remains an unresolved Gajo `PLACE_CONCEPT`; 옥천구읍 remains an Okcheon concept. Neither inherits cross-region children or operational actions.

## 7. TripSession isolation

Client helpers no longer default to Gajo. Simultaneous Hapcheon, Gajo, and Okcheon sessions use separate keys, with mutation and archive tests proving byte-equivalent protected sessions.

## 8. conversation-state isolation

Conversational anchors, explicit journeys, discovery context, and semantic context carry region IDs and are rejected/omitted on mismatches. Context extraction caching and limits now include region plus session.

## 9. search isolation

Search ingestion requires region, regional containment, safe category mapping, and regional duplicate comparison. Search candidates cannot be activated across manager scope.

## 10. Core isolation

Core lists and health diagnostics filter by region. Core IDs embed region and manager authorization is checked against the row region before changes.

## 11. runtime/weather isolation

Missing region no longer selects Gajo weather. Cache keys contain region, source, and coordinates. Hydration requires region and mismatched live observations are rejected.

## 12. config isolation

Missing and unknown configuration keys fail closed. Each read returns a structured clone, preventing an Okcheon mutation from changing another consumer or region.

## 13. cache isolation

Weather was already region-keyed. Context extraction was corrected from session/text to region/session/text, including region-scoped rate limits. No unscoped readiness or semantic cache exists.

## 14. DB-query audit

Regional RDM, candidate lists, Core lists, anonymous trips, and operational evidence use region predicates. Globally unique UUID/namespaced-URI lookups are followed by row-region authorization. No regional aggregate or bulk delete lacks a region predicate.

## 15. delete/reset safety

No regional `deleteMany` or global storage clear exists. Saved-place clear, new trip, archives, candidate rejection, and Core removal target explicit regional identity or authorize the authoritative row.

## 16. manager authorization matrix

Tests cover platform admin across explicit regions and Hapcheon/Gajo/Okcheon managers for permitted and forbidden read/write combinations.

## 17. three-region golden test

One run resolves 합천영상테마파크 for Hapcheon, 가조온천 as Gajo PLACE_CONCEPT, and the 정지용 semantic journey for Okcheon, asserting region-pure entities and context.

## 18. reverse isolation tests

The reusable snapshot harness tests Okcheon changes against Hapcheon/Gajo, Hapcheon changes against Okcheon/Gajo, and Gajo changes against Okcheon/Hapcheon.

## 19. PWA/storage isolation

Three concurrent regional sessions remain isolated. Visitor PWA updating has no storage clear/remove behavior, and normal visitor code performs no broad cache cleanup.

## 20. future-region onboarding gate

Regional function tests plus symmetric cross-region non-interference are mandatory for Muan, Gyeryong, Daejeon Jung-gu, and every future registry addition.

## 21. code changes

Added the shared isolation contract, snapshot harness, three-region golden test, authorization matrix, client simultaneous-session test, cloned/fail-closed configuration, region-keyed extraction cache, explicit region requirements, and architecture documentation. Existing feature behavior was not redesigned.

## 22. tests/build results

Focused server isolation passed 63/63 and focused client isolation/PWA/storage passed 43/43. Full server passed 427/427 and full client passed 193/193. Server and client production builds passed; the server image layout assertion resolves `dist/main.js`, and the client generated the latest visitor bundles/service worker. `git diff --check` passed with line-ending notices only.
