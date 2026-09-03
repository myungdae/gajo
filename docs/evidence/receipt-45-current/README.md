# Receipt 45 — resumed local verification

Verification date: 2026-09-03 (Asia/Seoul). This continues the existing work; it
does not replace or amend the initial three commits.

## Preserved baseline

- `0faf47a` — feat: extend regional localization across visitor flows
- `109fdf9` — feat: localize nearby and trip experiences
- `3dc34eb` — feat: localize assistant and dynamic guidance
- Receipt 44 headline baseline: `e391f1a`.
- Existing operational/admin-region contract: `fd5a749` and
  `server/src/regional-data/admin-region-compose-contract.spec.ts`.

The earlier captures in `../receipt-45/` and the earlier capture script were
preserved. They are historical material, not final pass evidence. The local
`.tmp-chrome-45/` profile is preserved and ignored by Git.
Implementation follow-up commit: `2a67fb0` — feat: complete regional visitor locale continuity.

## Changes

- A common locale path builder preserves query parameters and fragments before
  navigation. Visitor pages, details, trip actions and navigation use it.
  Gajo Home retains its explicit regional route on the shared domain.
- Explicit URL locale takes precedence over saved preference. Refresh, regional
  TripSession, new-trip creation, Home return and browser back retain English.
- Typed ko/en copy covers common actions, errors, location selection, Nearby,
  visit details, saved trips, assistant input, itinerary state and crater detail.
  The existing managed-copy adapter now handles reversible text and accessibility
  attributes without translating user input, names marked as source content, or
  administration screens.
- Visitor APIs receive validated locale independently of user input. Missing or
  invalid server locale remains Korean. Administrator and partner management
  requests are excluded from the visitor request decorator.
- Server templates cover Nearby status/distance, recommendation reasons, saved
  recommendations and existing replan proposals. Localization preserves ordering,
  distances, identity and completed history.
- RDM content accepts validated ko/en category, description, signature menu,
  price, hours, payment, parking and reservation text. English names use official
  name, reviewed name, then original Korean. Existing authorization and ownership
  checks are unchanged. This is a schema/API capability; no production content was
  imported or changed.
- English QR/share entries carry `?start=ai&lang=en`; Korean QR URLs retain their
  previous form. The original Korean poster image remains unchanged. The small
  English entry bypasses repeated poster display.
- Narrow layouts wrap itinerary details and controls. The mobile spotlight keeps
  the prior complete-group positioning and 48px action target contract on the
  current spotlight markup.

## Automated validation

- `client: npm run test:all`: 468 tests, 468 passed, zero failures/skips/todos.
  This discovers every `.test.ts` and `.test.mjs` file under `src`.
- `client: npm test`: existing pretest suites and all 292 main tests passed.
- `server: npm test -- --runInBand --testTimeout=30000`: 101 suites,
  905 tests passed. The first 5-second-default run hit timeouts in QR, bootstrap
  and a concurrent Nearby test. No assertions were removed; the final complete
  run used a 30-second execution allowance.
- Client and Server production builds passed. Client retains the existing large
  bundle warning and the installed Node/Vite version advisory.
- Static dictionary completeness, API locale contracts, Korean-input/English-UI
  separation, regional ownership, QR decoding, server ko/en templates and trip
  language persistence are covered by tests.
- Existing headline tests now assert the exact ko/en dictionary values and the
  actual rendered key. Stale portal wording assertions were aligned to the
  already-existing approved copy. Icon assertions allow formatting differences
  while requiring all five exact action types. Hero tests retain the same size,
  position and touch-target requirements on the live markup. No tests were
  deleted or disabled.
- `git diff --check` and added skip/only/todo checks: see `validation-summary.json`.

## Browser verification and isolation

Browser verification used the in-app Browser and a local Vite instance. The API
was `client/scripts/receipt45-api-fixture.mjs`, bound to localhost, with no database
or external API implementation. `localhost:5174` has a separate storage origin
from the pre-existing `127.0.0.1:5174` trip. No real trip was replaced by the saved
test itinerary. Synthetic place names, address and phone are not business data.

Verified sequence in that isolated session:

1. Home → Nearby → choose another location → select populated result.
2. Place detail → reviewed visit fields → save place → My Trip.
3. Saved place → internal map with entity URI and `lang=en`.
4. AI typed English request → two-stop attraction/restaurant itinerary → save.
5. AI typed replan request → attraction/café itinerary → Update Itinerary.
6. My Trip refresh retains revised stops; Home return and browser back retain en.
7. All six regional Home pages and navigation preserve English. The Korean/English
   crater-title toggle and English Home refresh do not repeat the poster.

`api-fixture-requests.jsonl` records paths/locales/regions only, without raw user
messages or credentials. The tested visitor requests carry locale=en. Synthetic
AI responses validate the client flow; server response-generation behavior is
validated separately by the server tests, not by the fixture.

Responsive evidence: actual 360×800, 390×844 and 844×390 itinerary viewports have no
measured content overflow. `receipt45-reflow.html` renders a 195×422 CSS-pixel frame
at scale 2 inside a 390×844 view for the requested 200%-equivalent reflow condition.
Its final measured width/scrollWidth are both 195 and its overflowing-element list
is empty. This is equivalent reflow testing, not a claim that the browser's native
zoom control was set to 200%. The harness is outside the production entry graph.
Temporary viewport overrides were reset after verification.
The local fixture and Vite processes started for verification were stopped after
the final captures; no operational service was stopped or restarted.

## Korean allowlist and limits

Allowed Korean in the inspected English screens: `합천` (region), `적중-초계분지`,
`대암산` (proper place names), `테스트 주소` (synthetic source address), and `한국어`
(the language switch). Original institution/place/business names, addresses and
user-authored input are source content and may remain Korean. No unverified
romanization was added. Inspected UI actions and explanatory text are English;
snapshots record the actual inspected states.

No production data, production servers, environment variables, deployment, push,
Docker rebuild or restart was used. Existing safety/replanning behavior was only
localized; new event detection was not added. Real provider routing, reservation,
payment, phone calls and third-party sharing delivery were not exercised. Regional
English business content still requires official or administrator-reviewed input.
The managed-copy adapter remains in use for legacy screens, so new dynamic copy
must be added to the typed dictionaries/templates and covered when introduced;
the fixture does not establish coverage of every possible production data payload.
