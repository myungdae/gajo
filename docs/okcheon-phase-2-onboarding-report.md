# Okcheon Phase 2 onboarding completion report

Date: 2026-08-22. Result: **partial onboarding completed; minimum field-ready quality bar not yet met**. No production credentials, deployment, commit, or push was performed.

## 1. Shared-engine changes required

- Replaced the Gajo-only movement-plan guard with the existing region-parameterized operational-place API.
- Made the RDM baseline bootstrap use an explicit shared registry of activated regions (`gajo`, `hapcheon`, `okcheon`).
- Added reusable `CROSS_REGION_NON_INTERFERENCE` checks for RDM and TripSession mutation.
- Added approved Guide knowledge for Okcheon implementation status.

No Okcheon-specific service, Roo, Copilot, composer, service worker, or RDM implementation was created.

## 2. Okcheon configuration completed

County-level configuration now includes center `(36.3064, 127.5714)`, containment bounds north `36.45`, south `36.18`, east `127.93`, west `127.47`, an Okcheon weather reference, map/nearby enablement, expanded categories/known places, and an `옥천구읍` place concept. Search remains dependent on the server-side Kakao key and all returned non-RDM candidates remain unverified.

## 3. Okcheon RDM entity count

33 curated repository baseline records are registered and included in the shared RDM bootstrap. On bootstrap, the service stores all 33 as `UNVERIFIED` because their whole-record status is `PARTIAL`; this is intentional and preserves the manager-verification boundary.

## 4. Category distribution

| Category | Count |
|---|---:|
| TOURISM_NATURE | 6 |
| TOURISM_CULTURE | 1 |
| LITERATURE_CULTURE | 3 |
| PLACE_CONCEPT | 1 |
| FOOD | 8 |
| CAFE | 5 |
| ACCOMMODATION | 4 |
| EXPERIENCE | 5 |
| Essential shopping | 0 |
| **Total** | **33** |

## 5. VERIFIED/PARTIAL/UNVERIFIED counts

Static source dataset: VERIFIED 0 / PARTIAL 33 / UNKNOWN 0. Bootstrapped RDM verification state: VERIFIED 0 / UNVERIFIED 33. Official listing evidence is not treated as manager verification of every operational fact.

## 6. Coordinate coverage

1/33 (3%): 둔주봉 한반도지형 has an official page-embedded route coordinate. No other coordinate was fabricated or promoted from a search result.

## 7. Action coverage

- Detail/source: 33/33
- Call: 17/33
- Website: 2/33
- Navigation: 1/33
- Reservation: 0/33

Phone actions reflect official listed contacts; navigation exists only for the evidenced coordinate.

## 8. Official tourism coverage

All nine official scenic identities are represented separately: 둔주봉 한반도지형, 옛 37번 국도변 벚꽃길, 부소담악, 용암사 일출, 장령산자연휴양림, 장계관광지, 금강유원지, 향수호수길, 옥천구읍. They are coverage records, not ranking instructions. Eight still need precise official coordinates/current operational verification.

## 9. Food coverage

Eight county-designated restaurant identities with official address, phone, and representative-menu evidence. Membership is described as a county designation and never as quality rank. Precise coordinates and current hours remain missing.

## 10. Café coverage

Five geographically varied county tourism-program participants: 플라히에, 토닥, 뜰팡, 라운드커피, 커피타임. Only coarse official street/locality evidence is available; all need exact point, phone, and hours before distance/navigation continuity.

## 11. Lodging coverage

Four: 장령산자연휴양림 plus 너와두리농촌캠핑장, 마로니에숲, 나드리캠핑장. Lodging type/address/phone are represented where officially listed. No reservation action was inferred.

## 12. Experience coverage

Five: 옥천전통문화체험관, 온봄달열하루, 숲속작은목공방 가비뉴, 세산곤충체험농장, 문화예술공간 바움. The traditional center includes official hours; the four program participants still require schedule/reservation verification.

## 13. Essential-shopping coverage

0 canonical records. The available authoritative tourism sources did not establish sufficient operational store evidence. Provider search can return cautious `UNVERIFIED` candidates, but that is not field-ready canonical coverage.

## 14. Semantic/place-concept coverage

`옥천구읍` is a non-operational `PLACE_CONCEPT` related to four separate identities: 정지용 생가, 정지용문학관, 옥천전통문화체험관, 육영수 생가. The Turtle metadata mirrors containment without inheriting phone/navigation. No Hapcheon EXKO or Gajo triples were copied.

## 15. Core Destination candidates

The nine official scenic identities are manager-review candidates. No Core designation was inserted and no ranking behavior changed.

## 16. Exact Golden Flow A

Proposed exact flow: `둔주봉 한반도지형 근처 카페 있어?` -> `그 주변 볼 만한 곳?` -> `그 근처 밥집은?` -> `거긴 멀어?` -> `다른 데는?`.

Result: **DATA_REQUIRED**. The anchor has an evidenced coordinate, but no café/food record has a verified point. The engine can preserve category/anchor structure but cannot honestly prove distance, nearby ordering, or safe navigation.

## 17. Exact Golden Flow B

Exact flow: `둔주봉 한반도지형하고 부소담악 가고 싶어요.` -> `어디부터 갈까?` -> `중간에 밥 먹을 곳도 넣어줘.` -> `시간이 두 시간밖에 없어.`

Result: **PARTIAL**. Both named destinations resolve and requested labels/order are preserved by the shared journey engine. Only 둔주봉 has an evidenced point, so route ordering, meal insertion by corridor, and two-hour feasibility remain unsafe to claim.

## 18. Exact Golden Flow C

Exact flow: `근처 편의점 있어?` -> `장 볼 데 있어?` -> `마트는?` -> `다른 데는?`.

Result: **DATA_REQUIRED** for canonical discovery. Shared essential-shopping taxonomy and bounded fallback exist; fallback results remain unverified and actionless.

## 19. Search -> Copilot result

Controlled tests prove: missing Okcheon RDM entity -> bounded provider candidate -> actionless `UNVERIFIED` entity -> `regionId=okcheon` Copilot ingestion. Search candidates are not inserted into VERIFIED RDM. A live provider call was not required or persisted.

## 20. Regional Copilot readiness

Platform Admin can inspect any region. Server authorization rejects Hapcheon-manager access to Okcheon candidates. The assignment model already supports `role=REGIONAL_MANAGER, regions=["okcheon"]`; no credential was created.

## 21. TripSession isolation

Active namespace remains `regional-concierge-trip-session-v1:okcheon`; archive prefix remains `regional-concierge-trip-archive-v1:okcheon:`. A three-region fixture now proves that archiving/restarting Okcheon leaves byte-for-byte Gajo and Hapcheon sessions unchanged.

## 22. Cross-region non-interference result

**PASS** for reusable RDM and TripSession harnesses. Okcheon bootstrap and candidate creation leave Gajo/Hapcheon RDM snapshots unchanged, and cross-region entity leakage is rejected. Existing Copilot queue, anchor, search-context, Core authorization, semantic, weather, and PWA isolation tests also pass. No production database snapshot was mutated.

## 23. PWA/mobile result

**PASS**. Okcheon continues to use the shared visitor PWA, regional manifest, `/okcheon` entry, persistent composer, safe-area CSS, update-safe TripSession storage, and one shared service worker. No separate PWA architecture was introduced.

## 24. Guide status

**READY and truthful.** “옥천에서도 되나요?” now explains shared-engine onboarding, implemented regional data/session support, remaining field verification, and explicitly avoids claiming completed public production deployment.

## 25. Remaining DATA gaps

- Exact official/provider corroborated coordinates for 32 records.
- Current opening/closure facts for nearly all records.
- Exact café addresses, phones, and hours.
- Essential-shopping canonical records (minimum 3-5).
- Parking/accessibility evidence.
- Corridor-aware café/food/lodging point coverage sufficient for all three goldens.
- Manager verification converting eligible staged facts to VERIFIED RDM.

## 26. Remaining ENGINE gaps

- The unified harness covers RDM and TripSession directly; Copilot/Core/semantic invariants remain in separate reusable tests rather than one transactional fixture.
- Generic runtime weather ontology individuals still use the historic Gajo namespace.
- Field-level verification is represented in source facts/actions, but the regional candidate status remains a coarse whole-record enum.

## 27. Files changed

- `server/src/regions/okcheon/master-data.ts`
- `server/src/regions/okcheon/master-data.spec.ts`
- `server/src/regions/okcheon/ontology-metadata.ttl`
- `server/src/regions/regional-candidate.registry.ts`
- `server/src/regional-data/regional-data.service.ts`
- `server/src/regional-data/regional-data.service.spec.ts`
- `server/src/region/region-config.service.ts`
- `server/src/recommendation/regional-recommendation.spec.ts`
- `server/src/guide/guide-knowledge.ts`
- `server/src/guide/guide.service.spec.ts`
- `client/src/regionConfig.ts`
- `client/src/regionalRuntime.test.ts`
- `client/src/components/MovementPlan.tsx`
- `client/src/tripSession.test.ts`
- `docs/okcheon-phase-2-onboarding-report.md`
- Existing untracked Phase 1 audit retained: `docs/okcheon-phase-1-readiness-audit.md`

## 28. Tests/build results

- Focused server onboarding/config/Guide/nearby/weather: PASS, 86 tests.
- Server full: PASS, 43 suites / 389 tests.
- Client full: PASS, 190 tests.
- Server production build: PASS.
- Client production/PWA build: PASS; non-blocking warning that Node 22.11.0 is below Vite's recommended 22.12+ patch.
- `git diff --check`: run after this report.
- Commit/push: not performed.
