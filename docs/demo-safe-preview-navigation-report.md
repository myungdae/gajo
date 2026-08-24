# Demo-safe preview navigation report

Date: 2026-08-24

## Policy

The shared essential-service action policy allows navigation in two cases:

1. `VERIFIED` record + finite coordinates + regional containment: ordinary `길찾기`.
2. `PARTIAL` record + finite coordinates + coordinate provenance `MUNICIPAL_OFFICIAL` or approved `PUBLIC_DATA` + regional containment: `길찾기(공식 위치)`.

Preview navigation means only that the official/public source supplied the location. It does not assert opening hours, current availability, charger vacancy, parking capacity, accessibility, fuel availability, current price, or manager verification.

Excluded: `SEARCH_EVIDENCE`, provider search, semantic-only entities, inferred/geocoded guesses, missing coordinate provenance, missing coordinates, and coordinates outside the configured region bounds.

## Okcheon result

All 16 Phase 2 records qualify for official-location preview navigation:

| Category | Eligible |
|---|---:|
| Public toilet | 5 |
| Parking | 5 |
| Gas station | 3 |
| EV charger | 3 |

The EV results include 안남면 전기차충전소, 옥천읍 전기차충전소, and 옥천군청 전기차충전소. Results expose the existing Naver Map, Kakao Map, and TMAP handoff with the municipal coordinates, plus `내 여행에 담기`.

When a manager later verifies the same record, the shared action metadata changes from `OFFICIAL_PREVIEW` to `VERIFIED`; the UI automatically changes from `길찾기(공식 위치)` to `길찾기` without a duplicate entity.

Gajo/Hapcheon records without qualifying coordinate evidence are unchanged. Search fallback, Regional Copilot approval boundaries, TripSession restoration, and regional isolation are unchanged.
