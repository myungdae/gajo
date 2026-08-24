# Hyperlocal public safety — heat-shelter readiness

## Architecture

`HEAT_SHELTER` is a shared essential/public-safety facility category in the Regional Engine. It is not implemented by region-specific services. Local Concierge prioritizes an explicit heat/rest need as an immediate essential detour while the active trip remains continuable. Regional Copilot performs a read-only comparison of official shelter points and configured Core Destination anchors.

Operational rule: **verified facts before actions; evidence before policy conclusions**. Search, blog, provider, and semantic-only results cannot become visitor-facing shelter navigation. Navigation uses the existing verified/official-preview coordinate policy only after authoritative public provenance passes. No new navigation engine was added.

## Three-region audit

| Region | Repository evidence | Classification |
| --- | --- | --- |
| Hapcheon | No official, coordinate-complete approved heat-shelter record | `DATA_REQUIRED` |
| Gajo/Geochang | No official, coordinate-complete approved heat-shelter record | `DATA_REQUIRED` |
| Okcheon | Official essential-service batch exists for toilets, parking, fuel, and EV charging, but not heat shelters | `DATA_REQUIRED` |

No weak data was onboarded. The visitor result is therefore an explicit verified-data insufficiency response with no fabricated facility or navigation.

## Coverage diagnosis

The configured default coverage threshold is 2,000 metres and is returned with the diagnostic. Only actual configured Core Destination candidates with coordinate-resolvable regional records and official shelter coordinates participate. Results are `COVERAGE_SUFFICIENT`, `COVERAGE_GAP_CANDIDATE`, or `DATA_INSUFFICIENT`.

`COVERAGE_GAP_CANDIDATE` is a review signal, not a recommendation to install or designate a facility. Foot traffic, elderly-population density, cooling operation, opening status, capacity, staffing, and accessible seating are not inferred. Final policy decisions remain with the authorized municipality and responsible officials.

## Conditional proactive boundary

The current product does not claim automatic knowledge of every heatwave. Where supported official weather/heatwave events and visitor context are available, an optional suggestion may say: “현재 폭염 관련 상황이 확인되는 경우, 가까운 무더위쉼터를 함께 확인해드릴 수 있습니다.”
