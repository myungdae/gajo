# Okcheon Phase 4B — EXKO Semantic Subgraph & Cultural Journey Report

Assessment date: 2026-08-22  
Boundary: EXKO explains relationships; RDM owns operational facts; Roo decides what fits now; Action Safety controls executable actions.

## 1. EXKO Okcheon architecture

The shared EXKO adapter now selects a strictly region-scoped subgraph. Hapcheon retains its generated pilot graph; Okcheon receives a separate bounded cultural graph behind `EXKO_OKCHEON_PILOT`. Traversal returns semantic concepts, aligned canonical candidates, and sourced relationship reasons. Local Concierge then resolves those candidates against the effective Okcheon RDM dataset, applies Roo context reductions, and copies actions only from RDM records. No semantic node can manufacture phone, navigation, hours, or reservation actions.

## 2. Sources audited

The audit used existing repository master data and ontology conventions plus authoritative sources:

- 옥천문화원 지용제 and 정지용 biography pages
- 옥천군 문화관광 pages for 정지용 생가/문학관, 지용제 locations, 구읍, walking routes, official foods, designated restaurants, and 전통문화체험관
- 옥천군/옥천군의회 public planning and meeting records for the evidenced 구읍 cultural grouping
- the existing EXKO inventory, properties, inverse relations, Hapcheon subgraph, and RDM canonical dataset

The audit supports the 정지용–생가–문학관–지용제–구읍 neighborhood; the 구읍 grouping of 정지용 생가, 문학관, 육영수 생가, and 전통문화체험관; the three food concepts; and only one current restaurant-to-dish link (`대박집` → 생선국수/도리뱅뱅이). No current festival dates were encoded.

## 3. Semantic node count

**13 nodes**:

- people: 1
- region concepts: 1
- cultural places: 3
- experience places: 1
- area concepts: 1
- festivals: 1
- literary works: 1
- food concepts: 3
- restaurants: 1

## 4. Relation count

**20 sourced relations**. They cover birthplace/region, associated cultural places, area membership, festival honor/location, literary work authorship, regional-food concepts, restaurant serving evidence, and the officially presented 정지용밥상 cultural theme. Useful inverse directions are explicitly present where traversal benefits from them; the graph is intentionally not densified with speculative edges.

## 5. RDM alignment count

**6 exact alignments**:

1. 옥천구읍 → `oldTownArea`
2. 정지용 생가 → `jeongJiyongBirthplace`
3. 정지용문학관 → `jeongJiyongLiteratureMuseum`
4. 육영수 생가 → `yukYoungsooBirthplace`
5. 옥천전통문화체험관 → `traditionalCultureExperienceCenter`
6. 대박집 → `daebakRestaurant`

Alignment uses explicit mapping records and `rdmEntityId`, not `owl:sameAs` assertions of uncertain scope.

## 6. Unaligned nodes

**7 semantic-only nodes**: 정지용, 옥천군 region concept, 지용제, 향수, 생선국수, 도리뱅뱅이, and 정지용밥상. Their lack of RDM alignment is intentional because they are a person, region/concept, festival concept without current schedule, literary work, or food concepts—not operational place entities. Broken place alignments: **0**. Aliases: **15**.

## 7. 정지용 semantic neighborhood

The person node connects to 옥천 as birthplace, 정지용 생가 as associated place, 정지용문학관 as related cultural place, 지용제 as the festival celebrating the poet, 옥천구읍 as the associated cultural area, and 향수 as a work. Reciprocal place/festival relations support traversal in both directions. Every edge includes a visitor-safe reason and source URL.

## 8. 옥천구읍 place-concept neighborhood

옥천구읍 remains `PLACE_CONCEPT`, aligned to the existing non-operational RDM area record. It contains/relates 정지용 생가, 정지용문학관, 육영수 생가, and 옥천전통문화체험관. The area itself is excluded from itineraries and never inherits child phone, navigation, hours, website, or reservation actions.

## 9. Festival relationships

지용제 is modeled as a semantic festival concept that honors/celebrates 정지용 and is associated with the officially stated 구읍 festival area. It has no RDM operational entity, current date, ticket, hours, or navigation action. Semantic meaning therefore survives without pretending the festival is currently running.

## 10. Food concepts

생선국수, 도리뱅뱅이, and 정지용밥상 are `FOOD_CONCEPT` nodes, not restaurants. Official tourism evidence associates all three with Okcheon. Only 대박집 receives `servesCuisine` links for 생선국수 and 도리뱅뱅이 because the official designated-restaurant menu supports those facts. No restaurant is linked to 정지용밥상, and no inference claims all Okcheon restaurants serve local specialties.

## 11. Exact Golden Question 1 result

Question: “정지용 시인과 관련된 곳을 둘러보고 옥천다운 점심도 먹고 싶어요.”

- Extracted concepts: 정지용 (PERSON), 옥천구읍 (PLACE_CONCEPT), 지용제 (FESTIVAL_CONCEPT), 생선국수, 도리뱅뱅이, 정지용밥상 (FOOD_CONCEPT), plus related regional concepts reached by traversal.
- Traversed relationships: 정지용 → 생가/문학관/구읍/지용제/향수 and 옥천 → food concepts → 대박집 serving links.
- Candidate places: 정지용 생가, 정지용문학관, 대박집.
- RDM eligibility: all three resolve to Okcheon canonical records and remain eligible for discovery/trip composition; no semantic-only concept enters the itinerary.
- Roo decision: no extra weather, mobility, or time constraint, so no reduction is applied.
- Final itinerary: **정지용 생가 → 정지용문학관 → 대박집**.
- Visitor explanation: “정지용 시인의 흔적을 따라 옥천구읍의 관련 문화공간을 둘러보고, 이후 옥천의 지역음식을 맛보는 흐름으로 구성할 수 있습니다.”
- Available actions: official detail links for all three; entity-specific call for 대박집.
- Blocked actions: navigation for all three because their RDM records do not currently contain approved action-safe coordinates. EXKO relevance does not change that.

## 12. Exact Golden Question 2 result

Question: “옥천구읍에서 문화적인 곳만 둘러보고 싶어요.”

- Extracted anchor: 옥천구읍 `PLACE_CONCEPT` with CULTURE-only constraint.
- Semantic candidates: 정지용 생가, 정지용문학관, 육영수 생가, 옥천전통문화체험관.
- RDM-filtered itinerary: **정지용 생가 → 정지용문학관 → 육영수 생가 → 옥천전통문화체험관**.
- Excluded: the 옥천구읍 concept itself, all restaurants, cafés, and food concepts.
- Actions remain the actions of each canonical RDM child only; the concept contributes none.

## 13. Exact Golden Question 3 result

Question: “옥천다운 음식은 뭐가 있고 어디서 먹을 수 있어?”

- Food concepts first: **생선국수, 도리뱅뱅이, 정지용밥상**.
- Linked eligible restaurant: **대박집**, supported for 생선국수 and 도리뱅뱅이.
- No restaurant is claimed for 정지용밥상 because the audited evidence did not establish one.
- Visitor explanation explicitly distinguishes an Okcheon dish/cultural food identity from a specific operational restaurant.

## 14. Semantic explainability

Every relationship contains a short explicit reason and provenance. Itinerary steps retain only the relevant `semanticReasons`, such as “정지용의 생가로 보존된 문화 장소” or “옥천군 지정 맛집 목록에 생선국수 취급이 명시됨.” These are graph facts and source summaries, not hidden chain-of-thought or raw RDF terminology.

## 15. RDM filtering

Semantic candidates must resolve to a record in the current effective regional dataset, have source evidence, and not be an area/place concept. A regression removes 정지용문학관 from the supplied RDM dataset: EXKO still finds the meaning, but the final itinerary excludes it and reports its canonical ID in `rdmRejected`. Actions are copied from RDM only. PARTIAL status remains visible; no record was verified or approved by Phase 4B.

## 16. Roo precedence

Roo context is applied after semantic traversal and RDM filtering. In the rain + elderly companion + 120-minute fixture, only candidates with existing `INDOOR` evidence remain; no accessibility claim is invented; and the route is capped for remaining time. The result retains 정지용문학관 and 옥천전통문화체험관, records the rain/time/accessibility decisions, and never encodes weather rules in EXKO.

## 17. Follow-up continuity

Local Concierge returns a structured `semanticContext` containing region, anchors, and requested concepts. Café and distance follow-ups pass it into the existing discovery/distance context and return it unchanged. “음식은 빼줘” removes food concepts/restaurants while preserving the cultural anchor. “시간이 두 시간밖에 없어” keeps the semantic anchor and lets Roo cap the itinerary. Existing alternative and explicit journey mechanisms remain unchanged.

## 18. Regional Copilot semantic diagnostics

Regional Copilot exposes an authenticated, read-only semantic diagnostic endpoint and safe diagnostic queries for unaligned nodes, 옥천구읍 relationships, and food concepts without restaurant links. Results include node/relation counts, aligned and broken identities, unaligned semantic nodes, unsupported/source-less edges, ambiguous aliases, and provenance coverage. PLATFORM_ADMIN or an Okcheon-scoped manager may inspect them; natural language cannot write triples.

## 19. Provenance

Semantic nodes and all 20 relations carry source URLs and an evidence class (`OFFICIAL_CULTURAL_EVIDENCE` or `OFFICIAL_TOURISM_EVIDENCE`). Provenance coverage is **20/20 (100%)** for relations. Repository mappings remain identifiable separately from operational RDM provenance. No source-less relationship is accepted by the diagnostic test.

## 20. Cross-region isolation

The adapter selects exactly one region graph. Okcheon traversal contains no 합천/스마일펜션 nodes; Hapcheon graph serialization is byte-identical before and after Okcheon traversal; Hapcheon semantic journey calls cannot consume the Okcheon graph; and unsupported regions return empty graphs. Alignment lookup and semantic candidate enrichment require matching `regionId`, preventing identical labels from crossing regions.

## 21. Guide explanation

Guide now answers “EXKO가 뭐예요?” and “일반 검색과 관계 기반 AI가 뭐가 다른가요?” in public language: search is strong at finding matching names; relationship-based AI helps understand how people, places, culture, and food connect into a journey. It identifies EXKO as an internal platform layer and states that verified operational data still controls actions. It does not market EXKO as a public product.

## 22. Remaining semantic gaps

- There is no canonical RDM entity for the person 정지용, festival 지용제, literary work 향수, or dish concepts—which is appropriate until a separate non-place identity policy exists.
- No current operational festival schedule or festival venue action is verified.
- 정지용밥상 has official cultural-tourism support but no audited restaurant serving link.
- Most Okcheon restaurants lack menu-level semantic evidence; they were not linked by inference.
- Café proximity and distance remain operational/RDM concerns and are limited by coordinate coverage.
- The manager diagnostic surface is read-only; there is no semantic editor or relation-approval workflow yet.
- Follow-up semantic context is response-carried; durable TripSession schema migration was intentionally avoided.

## 23. Files changed

- `server/src/exko-semantic/generated/okcheon-subgraph.json`
- `server/src/exko-semantic/exko-semantic.service.ts`
- `server/src/exko-semantic/exko-semantic.mapping.ts`
- `server/src/exko-semantic/exko-semantic.controller.ts`
- `server/src/exko-semantic/exko-semantic.service.spec.ts`
- `server/src/concierge/concierge.service.ts`
- `server/src/concierge/okcheon-semantic-journey.spec.ts`
- `server/src/copilot/copilot.module.ts`
- `server/src/copilot/copilot.service.ts`
- `server/src/copilot/copilot.controller.ts`
- `server/src/copilot/copilot.service.spec.ts`
- `server/src/guide/guide-knowledge.ts`
- `server/src/guide/guide.service.spec.ts`
- this report

No Phase 4A approval policy, visitor storage schema, DNS, TLS, AWS resources, or credentials were modified.

## 24. Tests/build results

- Focused semantic/Concierge/Guide/Copilot tests: **107/107 passed**
- Server full tests: **413/413 passed**
- Client full tests: **192/192 passed**
- Server production build: **passed**
- Client production build: **passed** (non-fatal warning: Node 22.11.0 is below Vite's supported 22.12+ patch level)
- `git diff --check`: **passed** (line-ending conversion notices only)

No commit or push was performed.
