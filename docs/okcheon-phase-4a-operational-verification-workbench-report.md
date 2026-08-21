# Okcheon Phase 4A — Operational Verification Workbench Report

Assessment date: 2026-08-22  
Decision boundary: **Copilot proposes. Human decides. RDM remains operational truth.**

## 1. Operational-verification architecture

The shared Regional Copilot now reads the shared operational-readiness matrix, presents field evidence, and delegates every mutation to Regional Data Manager (RDM). Evidence staging and decisions are region-scoped. The effective regional dataset exposes an approved operational field only after an explicit manager decision. No Okcheon-specific verification engine or shadow truth store was created.

## 2. Okcheon dashboard

The calculated baseline dashboard shows:

- 전체 장소: **33**
- Action Ready: **1**
- 좌표 확인 필요: **32**
- 전화 확인 필요: **19**
- 운영시간 확인 필요: **26**
- 주차 확인 필요: **33**
- 접근성 확인 필요: **33**
- 생활편의 후보: **3**

Counts are recomputed from the current effective dataset and candidate collection, not hardcoded into the client.

## 3. Priority model

- **P1:** official/Core representative destinations missing coordinates or critical actions.
- **P2:** food, café, and accommodation records that visitors commonly need to navigate to or call.
- **P3:** essential-shopping search candidates.
- **P4:** hours, parking, and accessibility enrichment.

Priority uses visitor impact and category only. Paid membership or commercial status has no role.

## 4. 9경 verification queue

All nine official scenic destinations are identified from their canonical source records and returned in `officialScenicQueue`. Each item includes canonical name, aliases, category, RDM/lifecycle status, official source, address, coordinates, phone, hours status, parking, accessibility, navigation eligibility, missing fields, evidence, priority, visitor reason, and recommended manager action. The queue does not fill missing evidence.

## 5. Field-level evidence model

RDM records now support separate evidence objects for `coordinates`, `phone`, `hours`, `parking`, and `accessibility`. Each preserves:

- current value
- proposed value
- source type/name/URL
- observed timestamp
- confidence and evidence status
- why review is needed
- review state (`PROPOSED`, `APPROVED`, `HELD`, or `REJECTED`)
- reviewer and review timestamp

Official source evidence remains separate from manager approval.

## 6. Coordinate review flow

An authenticated manager can stage a coordinate pair with provenance without changing navigation. The workbench then shows current value, candidate point, source, observation time, and review reason. The manager must explicitly choose approve, modify, hold, or reject. Only approve/modify writes latitude/longitude into RDM and makes the point eligible for shared Action Safety. The UI provides a 44px map-comparison link showing the candidate pin against the official address; viewing the pin never approves it.

## 7. Phone/hours flow

Phone and hours use the same evidence-first decision path. Phone evidence must remain entity-specific; tourism-office evidence is visible as provenance and is not silently treated as the entity's number. Hours retain the four readiness meanings: verified, source-reported, unknown, and not applicable. An approved hours proposal becomes `VERIFIED_HOURS`; unknown outdoor places are never converted to 24-hour availability.

## 8. Parking/accessibility flow

Parking and accessibility proposals must be structured values with a source URL. Unknown remains unknown when evidence is absent. The workbench can filter both fields together, but approval remains per field and per entity. No category/name/image inference is used.

## 9. Essential-shopping review

The three CU records are idempotently bootstrapped into the Copilot candidate store as `SEARCH_EVIDENCE`. The workbench shows name, type, address/phone evidence, source, duplicate matches, region containment, P3 priority, and explicit `tripEligible: false` / `operational: false`. They remain UNVERIFIED until the existing candidate review and activation boundary is completed. There is no mass activation or third-party-source auto-verification.

## 10. RDM approval boundary

All field decisions call shared RDM methods. Copilot does not maintain an alternative operational dataset. Approval validates the field value, updates the canonical regional row, records field evidence and audit data, and lets `effectiveDataset()` expose only approved field actions. Entity-level candidate activation continues through the existing RDM create/action workflow.

## 11. Readiness recomputation

Every successful field decision returns a freshly calculated entity and region readiness result. Discovery, navigation, call, trip eligibility, hours status, and overall classification are derived again from the effective dataset; no readiness cache is trusted. A field approval moves an UNVERIFIED row to PARTIAL rather than falsely declaring every entity field VERIFIED.

## 12. First golden entity end-to-end result

**부소담악** was selected because it is a real official scenic destination with a precise county address and useful visitor role, while lacking an operational coordinate. The fixture stages the Korea Tourism Organization Linked Open Data coordinate candidate `36.3522824857, 127.5637131168` as evidence only. Before approval it remains `NEEDS_COORDINATES` with no navigation. A missing confirmation is rejected. After explicit Okcheon-manager approval, the fixture becomes `ACTION_READY`, navigation-ready count increases by one, and the approved field/audit is stored in RDM. This is a test transaction; the repository baseline itself is not silently promoted.

## 13. Local Concierge action change after approval

Before approval, the effective Okcheon record has no `navigate` action. After approval, the shared effective-dataset adapter emits `actions.navigate` with the approved pair, so Local Concierge and existing action surfaces may consume it without Okcheon-specific logic. The entity remains PARTIAL overall because other operational fields are not thereby verified.

## 14. Audit events

The workflow records `OPERATIONAL_EVIDENCE_REVIEWED`, `COORDINATE_APPROVED`, `PHONE_APPROVED`, `HOURS_APPROVED`, `PARKING_APPROVED`, and `ACCESSIBILITY_APPROVED`, plus held/rejected evidence decisions. Events preserve actor, region, canonical entity, field, previous/new value, evidence source, and timestamp. Secrets and raw visitor conversations are not accepted or logged.

## 15. Region authorization

`PLATFORM_ADMIN` can inspect any region. `REGIONAL_MANAGER` must have the requested region in `regions` for reads and must also hold manager write authority for decisions. The test allows `regions=["okcheon"]` and rejects a Hapcheon manager attempting the same Okcheon approval. Authorization is checked before RDM is called.

## 16. Cross-region non-interference

The golden RDM fixture snapshots Gajo and Hapcheon rows, stages and approves an Okcheon coordinate, and verifies both snapshots remain byte-for-byte unchanged. Existing full regressions also retain Copilot queue, TripSession, saved-journey, and PWA isolation. Core metadata is not mutated by field review. Permanent rule: **NO CROSS-REGION SIDE EFFECTS.**

## 17. Natural-language manager diagnostics

Read-only task diagnostics now handle:

- “옥천에서 좌표 없는 곳 보여줘.”
- “옥천 9경 중 길찾기 안 되는 곳은?”
- “전화 가능한 곳 몇 곳이야?”
- “오늘 무엇부터 확인할까?”
- “생활편의 후보 보여줘.”

They return filtered diagnostics/counts only. Natural language cannot approve evidence.

## 18. Mobile UX

The operational dashboard uses cards rather than a required desktop table, horizontal touch-safe filters, full-width review buttons, and minimum 44px controls/links. Layout starts with two columns for narrow screens and expands at 760px, covering 360px, 390px, and 430px field use. Each fact opens a focused modal with current/proposed/source/reason and individual decisions. No “Approve All” control exists.

## 19. Phase 4B semantic anchor readiness

Stable canonical anchors exist for 정지용생가, 정지용문학관, 옥천구읍, 육영수생가, 옥천전통문화체험관, the official scenic destinations, and concrete local restaurants. Identity gaps remain: there is no separate canonical person entity for 정지용; “local food concepts” are tags/descriptions rather than canonical concepts; 옥천구읍 is intentionally a non-operational area concept; and aliases/relationship provenance need explicit Phase 4B review. EXKO can later explain relationships, while RDM continues to decide operational trust.

## 20. Remaining limitations

- The repository has no live geocoder/provider credential or automated evidence-fetch job; provider results must be staged through the API.
- Map confirmation is an external candidate-pin comparison link, not an embedded draggable map/editor.
- Field approval intentionally yields PARTIAL unless broader entity verification policy is satisfied.
- The three shopping candidates still require duplicate review and operational evidence before activation.
- Parking/accessibility coverage remains zero until authoritative evidence is gathered and individually approved.
- Phase 4B semantic relationships are not implemented.

## 21. Files changed

- `server/src/regional-data/regional-data.schema.ts`
- `server/src/regional-data/regional-data.service.ts`
- `server/src/regional-data/operational-readiness.ts`
- `server/src/regional-data/regional-data.service.spec.ts`
- `server/src/copilot/copilot.service.ts`
- `server/src/copilot/copilot.controller.ts`
- `server/src/copilot/copilot.service.spec.ts`
- `client/src/copilot-main.tsx`
- `client/src/copilot.css`
- `client/src/copilotUx.test.ts`
- this report

No visitor TripSession, anonymous identity, My Trip deletion, archive, or restoration implementation was modified.

## 22. Tests/build results

- Focused operational/Copilot/Okcheon tests: **33/33 passed**
- Server full tests: **403/403 passed**
- Client full tests: **192/192 passed**
- Server production build: **passed**
- Client/PWA production build: **passed** (non-fatal warning: Node 22.11.0 is below Vite's supported 22.12+ patch level)
- `git diff --check`: **passed** (line-ending conversion notices only)

No commit or push was performed.
