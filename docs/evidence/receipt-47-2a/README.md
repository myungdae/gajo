# Receipt 47-2A validation

Base: `a1fe074b86ab464ec2ec8f7b8d1c1cf8e5c07299`.

| Verification | Result |
| --- | --- |
| Focused Client session/transport and existing sharing/save/admin checks | 45 passed |
| Focused Server integrity and QR checks | Passed; QR image tests needed a 30-second runner timeout on this host, assertions unchanged |
| Client full suite: `npm run test:all` | **500 passed, 0 failed, 0 skipped**; one full run |
| Server full suite: `npm test -- --runInBand --testTimeout=30000` | **946 passed, 102 suites, 0 failed**; one full run |
| Client production build | Passed; one build; Vite/PWA emitted existing chunk/deprecation warnings |
| Server production build | Passed; one build |
| Local Chrome administrator browser fixture | **6 checks passed**, no runtime exceptions |
| New skip/only/todo scan and `git diff --check` | Passed |

New tests cover all six regions, strict safe fields, malformed requests, concurrent event duplication and changed payload reuse, receipt time/retention, canonical and signed external place validation, region/visit-bound expiring markers, stripping a marker from an internal visit, explicit region scopes, Seoul periods/custom-date validation, distinct event/visit/trip metrics, ordered matching funnel correlation, exclusion/inclusion, mixed language and small-cell/complementary suppression.

Client tests additionally verify the exact 30-minute boundary, active extension, midnight continuity, region-isolated visits, transport retry with the same eventId, duplicate click suppression, preservation of safe search/place context and nonblocking transport failure.

The administrator browser fixture uses **local 5176** with every API request intercepted and external HTTPS blocked. It calls the actual Server report-building function on fixture data. No Server process or database was started for this browser check. It tests default exclusion (40 events / 10 visits / 10 trips), explicit inclusion (60 / 15 / 15), language labels, custom dates, mobile layout and accessibility controls, denial of another region without stale data, and absence of tourism telemetry on admin pages. See `browser-report.json`, `dashboard-desktop.png`, and `dashboard-mobile.png`.

This browser evidence validates rendering and interaction, not live authentication, Mongo index installation, actual QR scans or real tourism. Service unit tests cover the authorization/integrity boundaries. Existing 8090 production and 8091 candidate containers were not changed or accessed.

The first broad exploratory TypeScript check also included existing repository test files and reported pre-existing test typing errors. Production-target type checking, both required production builds and both full test suites passed. No existing assertions were removed or relaxed; QR expectations now require the new attribution parameter while still checking the exact official URL, locale and scan dimensions.

Operational prerequisites, privacy definitions, retained-data limits and the unexecuted index migration plan are in [the implementation record](../../receipt-47-2a-analytics.md).
