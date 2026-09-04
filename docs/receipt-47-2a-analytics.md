# Receipt 47-2A — visitor analytics foundation

Base commit: `a1fe074b86ab464ec2ec8f7b8d1c1cf8e5c07299`.

## Scope and measurement

This is local implementation only. No push, deployment, production pull, environment change, Docker operation, database migration or backfill was performed. No reservation channel or booking confirmation was added. The unverified generic Yapen URL remains outside visitor reservation actions.

The new `/api/analytics/v2/events` contract stores only named fields: version, event ID/type, region, anonymous trip ID, visit ID, page view ID, screen, UI locale, occurred/received timestamps, and optional search/result/action/place identifiers, result count, registered entry ID and navigation provider. Server-derived traffic class and evidence type are stored separately. Unknown fields are rejected, including raw questions, GPS, IP, full UA/referrer/query, voice and self-asserted classifications. Search proof and test credentials are never written into event documents.

`visitSessionId` is distinct from the persisted TripSession. The browser maintains one visit per region, shared across same-origin tabs through localStorage, with an in-memory fallback if storage is unavailable. Pointer/key activity and event activity renew the 30-minute inactivity deadline. Midnight alone does not split the visit. A page reload creates a new page-view ID but retains an active visit. Browser storage clearing, different browsers/devices, and tab races can change anonymous session identity; these are not person counts. Neither public telemetry nor UUIDs authenticate a human.

The same event ID is retried at most once on transport/5xx failure. A fixed string Mongo `_id` equal to eventId prevents concurrent duplicate inserts even before the additional eventId index is applied. Payload reuse with changed fields is rejected. Consecutive identical UI actions inside one second are suppressed locally; a later intentional action is a new event. Analytics is fire-and-forget and never gates phone, directions or saving.

The core funnel is `NEARBY_SEARCH_SUBMITTED → SEARCH_RESULTS_SHOWN → PLACE_DETAIL_OPENED → PHONE_CLICKED / DIRECTIONS_CLICKED / ITINERARY_SAVE_SUCCEEDED`. The report requires an ordered matching visit/search/result/place chain; unrelated direct actions still appear in action totals but not as funnel conversions. Empty results cannot advance the funnel. The instrumented search pipeline is the Nearby search page; AI recommendation detail/actions are captured through existing common action components, but AI free-text questions are not automatically relabeled as Nearby searches. UI locale does not infer question language.

Client action instrumentation bridges selected legacy calls into v2. Legacy events are kept in their original collection and never summed into v2. The existing `entity-action` legacy rejection is not used as the source of truth: v2 receives only the normalized contract. Full-journey saving emits success only after the existing save function reports success. Existing duplicated-save protection is retained.

## Evidence and limits

- `ATTRIBUTED_ENTRY`: generated regional QR URL identifies `regional-qr:<region>`, or the registered operating/verified partner slug matches the region. These public, copyable links are attribution evidence, not proof of scanning or presence.
- `GENERAL_VISIT`: a valid unattributed public entry. This does not assert tourist/human status.
- `UNKNOWN`: invalid/unresolved entry evidence. Legacy is always separately labeled legacy/unknown.
- `INTERNAL_TEST` / `AUTOMATED_CHECK`: only authenticated Server-issued HMAC markers, bound to region and visit, valid for one hour. Existing `ADMIN_WRITE_TOKEN` signs these purpose-specific markers. `ADMIN_REGION_IDS` must explicitly contain the requested region; an empty scope denies new analytics access. No new environment variable was added or changed.
- Marker issuance records a binding so omitting a marker cannot turn that test visit into general traffic. Expired/mismatched markers reject telemetry without blocking visitor actions. The admin UI starts a fresh visit before issuing an internal marker. After 30-minute inactivity changes the visit, the operator must issue a new marker. Automation can use the same authenticated endpoint with `kind: AUTOMATED_CHECK`; UA guessing is never used.
- `VERIFIED_ONSITE` is not generated. The dashboard explicitly states strong onsite verification is unsupported. No one-time onsite token was implemented.

Canonical places are checked against the region's effective RDM dataset. Nearby responses carry signed, 24-hour evidence of the place being returned for that experience region. This is not a claim that a cross-region search destination is geographically inside the experience region. Search signatures are process-local and expire on restart; no coordinates or query text are signed/stored. Invalid/unavailable evidence fails closed for collection and does not prevent the actual action. A new tab/reload without retained external-place evidence may not record an external saved-place action; canonical RDM actions can still be verified. Multi-process shared search evidence and later re-verification of saved external places require a subsequent design if that deployment topology/use case is needed.

Original printed regional URLs without the new entry marker cannot be retrospectively identified as QR traffic. Existing Partner visit URLs still do not prove presence; no historical QR or mock reservation is upgraded into confirmed visits/bookings.

## Reporting and privacy

`GET /api/analytics/v2/report` requires the existing admin token and explicit region permission. Periods: today, yesterday, 7d, 30d, custom inclusive calendar dates (maximum 90 days). Filtering uses Server `receivedAt`, Seoul midnight boundaries, and an exclusive end. Recent 7/30 days include today. Occurred timestamps are bounded to 24 hours of receipt and used with correlation identifiers for order, not for choosing reporting dates.

Events, distinct visit sessions and distinct anonymous trips are separate metrics. Period distinct totals are recomputed across the whole period, not summed from daily counts. Language is assigned per visit within the selected period: ko, en, mixed (both ko and en), unknown. The dashboard returns aggregate tables only, never individual session paths or IDs. Query reads are bounded to 100,000 events; larger results return an explicit shorter-period error rather than silently truncating statistics.

The default excludes internal and automated events. Inclusion is an explicit administrator control. Small cells use five distinct visit sessions, not five events. If any nonempty cell is small, its entire partition is hidden to prevent subtraction from a total. Funnel counts are suppressed together. Inclusion of a small internal/automated cohort suppresses numeric report values so comparing the toggle cannot expose that cohort. These deterministic protections cover a report and inclusion comparison; overlapping custom periods, repeated snapshots or external auxiliary knowledge remain statistical disclosure risks. No claim of differential privacy is made. No arbitrary person or path drill-down exists.

Collection start is stored once per region using a non-identifying `$min` state record and survives raw-event expiry. Before the first event the UI shows no collection. The actual start date will be the first accepted event after a separately authorized migration and deployment, not this local implementation date. Legacy availability is a flag only and old data is not reclassified. The legacy summary now filters by administrator region scope; its UI is labeled legacy/unknown. The pre-existing RegionalReport view is explicitly labeled legacy/unknown too.

Raw v2 events and marker bindings expire after 90 days. Marker authorization lasts one hour; binding retention prevents removing the marker from immediately reclassifying the same visit. The collection-start state has no personal/session IDs and is retained. The existing authenticated anonymous-trip deletion also deletes its v2 events. Expiry depends on explicitly installed TTL indexes; TTL removal is asynchronous. Proxy/access-log retention was not changed or audited here.

## Schema and indexes — plan only, not executed

All three new schemas declare `autoCreate: false`, `autoIndex: false`.

| Collection | Declared indexes |
| --- | --- |
| `visitoranalyticevents` | built-in `_id` (string eventId); `{eventId:1}` unique; `{regionId:1,receivedAt:1}`; `{regionId:1,eventType:1,receivedAt:1}`; `{regionId:1,visitSessionId:1,receivedAt:1}`; `{expiresAt:1}` TTL `expireAfterSeconds:0` |
| `visitoranalyticsstate` | built-in `_id` (region); `firstReceivedAt`, no TTL |
| `visitoranalyticsmarkers` | built-in `_id` (region + visit); `{retainUntil:1}` TTL `expireAfterSeconds:0`; authorization `expiresAt` is not the deletion field |

Future operator migration requires separate authorization:

1. Confirm the target database and deployment SHA through the established operational procedure. Inspect collection/index existence read-only first; do not print credentials or visitor documents.
2. Create only these new collections if absent. Do not alter, backfill or index-rebuild legacy collections. If already present, validate `_id` and eventId types/uniqueness before applying the declared indexes; stop on conflict rather than deleting records.
3. Apply exactly the indexes above. Verify key patterns, unique flags and TTL settings using index metadata. Inspect narrowly scoped query plans for region + receipt time. No application startup index sync is permitted.
4. Confirm the administrator's existing region scope is correct. Empty scope intentionally denies access; any operational configuration change needs separate approval.
5. Deploy only after separate review/approval. Use an issued INTERNAL_TEST/AUTOMATED_CHECK marker for smoke checks, confirm duplicate event receipts and default exclusion, then inspect aggregate collection-start metadata. Do not fabricate a public visit to make the dashboard nonempty.
6. Rollback stops the new writer/reader by reverting deployment. Preserve the isolated collections for review; do not automatically drop data/indexes. TTL remains subject to the approved retention policy.

## Verification and evidence

See `evidence/receipt-47-2a/README.md` and `browser-report.json`. Browser verification uses local Chrome, port 5176, intercepted fixture API responses, and the actual Server report function. No production API or DB is involved. It verifies administrator behavior, not a live database migration, actual QR scanning or real people.
