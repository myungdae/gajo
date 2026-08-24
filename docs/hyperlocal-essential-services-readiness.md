# Hyperlocal essential services readiness audit

Audit date: 2026-08-24. Scope: repository-backed canonical RDM/bootstrap data and retained search candidates. No external provider was queried and no records were activated.

## Shared taxonomy and operational boundary

The existing `CONVENIENCE_STORE` and `MART_SUPERMARKET` categories were reused. The shared, region-neutral discovery taxonomy now also contains `PARKING`, `PUBLIC_TOILET`, `GAS_STATION`, `EV_CHARGER`, and `TOURIST_INFORMATION`. Search results remain `UNVERIFIED`, are ingested only as Regional Copilot candidates, and cannot expose navigation. Canonical essential services also require VERIFIED lifecycle data and finite trusted coordinates before navigation is exposed.

Required common facts are canonical identity, `regionId`, coordinates, address/location description, lifecycle, and provenance. Type-specific optional facts—hours, fees, accessibility, fuel, charger/operator, and live status—must carry evidence. Live charger occupancy is not represented without a real API.

## Three-region repository readiness

| Region | Parking | Public toilet | Gas station | EV charger | Convenience store | Mart/supermarket | Tourist information |
|---|---|---|---|---|---|---|---|
| Hapcheon | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED |
| Gajo | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED |
| Okcheon | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | DATA_REQUIRED | SEARCH_ONLY | DATA_REQUIRED | DATA_REQUIRED |

`SEARCH_ONLY` for Okcheon convenience stores means three bounded provider candidates already exist in the Copilot review fixture; none is canonical, manager-approved, trip-eligible, or navigation-eligible. `DATA_REQUIRED` does not mean the real-world service is absent—only that the repository has no canonical operational record or retained candidate sufficient for this category.

## Core-destination support diagnosis

The repository has Core/important destination candidates in all three regions, but none has a canonical typed nearby parking→toilet→food→café support graph. Food/café coverage exists unevenly; parking attributes on an attraction are not a standalone `PARKING` service and cannot establish walking distance, route accessibility, or public availability. The platform can calculate straight-line distance only when both trusted points exist; it must not turn that into “3 minutes,” “easy walking,” or “right in front.”

Read-only Copilot diagnostics can use the shared readiness calculator per region to answer counts and missing-category questions. Missing infrastructure follows RDM insufficient → bounded regional provider evidence → structured UNVERIFIED candidate → Regional Copilot → human verification → RDM. There is no automatic approval.

## Elderly/mobility regression expectation

For “70대 어머니와 함께 왔는데 많이 걷기 어렵습니다. 화장실과 주차가 편한 곳부터 보고 싶어요,” the explicit mobility constraint and requested essential needs take priority. Current repository data is insufficient to call any candidate elderly-friendly, accessible, close-walking, or parking-convenient in the three audited regions. The correct result is to disclose that gap, use only evidence-backed facts, and preserve the active region and TripSession during any temporary detour.

## Phase 2 minimum onboarding

Onboard a small verified cluster per region, starting around one Core destination: one public parking facility, one public toilet, and one tourist information point where present; then one fuel/EV option and two shopping alternatives. Each record needs authoritative provenance, canonical identity, region ownership, precise coordinates, address, lifecycle review, and only evidenced type-specific facts. Human approval should precede activation; bulk ingestion is out of scope.
