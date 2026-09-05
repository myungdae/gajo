# Receipt 32: public identity approval and integration review

This is a local code/test review. It authorizes no push, production database write,
server pull, production build/restart or IGNORE_CHANGE action.

## Public approval boundary

Public datasets use the approved current display name/aliases when the document is
VERIFIED; otherwise they use the curated baseline canonical name/aliases. A PARTIAL
baseline can have a reviewed canonical name even when coordinates or operating hours
remain incomplete. Partial approval of an unrelated field does not promote candidate
names, aliases or visitor translations. A candidate without either approved current
identity or a canonical baseline is omitted from public datasets entirely.

The review document retains proposedFacts and raw candidate names. Authenticated
operators can still review fields on a hidden candidate; the review response explicitly
indicates identityApprovalRequired and navigationEligible=false. Anonymous access to
the administrator list and operational-readiness routes is rejected. The manager UI
passes its existing admin token for reads, clears unavailable review data, and ignores
older asynchronous responses after the active load changes.

The shared effectiveDataset projection feeds exact matching, discovery, recommendation
and regional facility/map APIs. Tests exercise actual field approval and the public
consumers for Gajo, Hapcheon, Okcheon, Muan and a newly registered fixture region.
HTTP tests separately verify public responses and authenticated versus anonymous review.

## Ingestion input boundary

The allowed source types are OFFICIAL_LOCAL_GOV, OFFICIAL_BUSINESS, KTO,
OFFICIAL_MAP_LISTING and OTHER_VERIFIED_SOURCE. Their URLs/type labels supply
provenance, not proof that a candidate's identity has been approved.

Without an explicit canonical ID, display name/address/phone/coordinates are compared
only to produce review suggestions in identityCandidates. A single match does not
assign that canonical, even when all observed facts agree. Multiple matching canonical
IDs abort before any write. Unapproved aliases do not participate in this comparison.
The newly created record has a new candidate ID and remains UNVERIFIED.

An explicit canonical ID plus region continues to stage facts on that specific identity;
it never bypasses the separate approval of proposed facts. APPROVE/APPLY_CHANGE remain
the actions that establish approved current facts. Tests cover every allowed source,
name-only observations, fully corroborated observations, multiple canonical matches,
preservation of existing documents and explicit-ID idempotence.

Repeated unidentified ingestion can produce separate review candidates. Operators must
resolve identityCandidates before approving a duplicate-looking candidate; this work
does not automatically merge candidates or infer approval from a source label.

## Read-only production lineage evidence (2026-09-06)

- Local starting point and local main: `0aefe28d3173815fe80883d2431264b1c7974fd6`.
- Production checkout: `b7c76a81e370e6092c2c4e16061bc5593248a36a`.
- `git merge-base` on the production repository returned the local starting point.
- `git rev-list --left-right --count localStart...production` returned `0 80`.
- Thus the specified starting points have not diverged: production is 80 reachable
  commits ahead, including merge commits. Local-start-only commits: none.
- The complete production-only list is in `receipt32-production-only-commits.txt`.
  It includes regional manager localization, Hapcheon home/journey updates, mobile GPS
  recovery, Gyeryong onboarding/toilet data and humanized guidance.
- The local review chain is `0aefe28 -> 87cf963 -> 893b16c -> public-boundary commit`.
  These three review commits are on a separate branch from the production-only history.

Starting-point main can fast-forward to production. Production and the completed review
branch cannot fast-forward to one another. Merely fast-forwarding old local main to the
review branch and deploying that tree would omit the 80 production-only commits and
their features/data, including the current production place additions.

The intersection of production-changed files and the complete local review changes is
`client/src/components/RegionalDataManager.tsx`. A read-only, file-level 3-way merge of
the actual base/production/local contents, normalized to UTF-8 LF without the SSH login
banner, returned exit 0 with no conflict markers. No textual conflicts are currently
predicted for these fixed inputs. This is not a completed full-tree merge or proof of
behavioral compatibility; review the authentication additions together with production's
localized manager feedback. Production objects were inspected on the server without
fetch/pull or modifying either checkout.

## Proposed integration order (not executed)

1. Confirm current remote main and production image/checkout identities again.
2. Preserve the three review commits and obtain the current main history only when
   separately authorized. Create an integration branch from that current main, ensuring
   it contains the production commit and all subsequent approved production changes.
3. Merge the review branch into the integration branch, retaining production history.
   Alternatively cherry-pick 87cf963, 893b16c and the public-boundary commit in that order;
   this creates new commit IDs and requires equivalent review.
4. Inspect the manager UI merge and verify production-only regional data, GPS recovery,
   home/journey behavior and guidance remain present. Run full server/Client tests and
   local builds on the actual integrated tree, including exact-place and IGNORE_CHANGE
   atomicity contracts.
5. Review the integrated diff before separately approving push/merge. Production
   deployment, document backup and the actual IGNORE_CHANGE each remain separate gates.

The Yuseong Garden data/name follow-up is recorded separately in
`receipt32-yuseong-followup.md`; no place data is changed by this review.

## Final local verification

- Added 24 regression cases covering public identity, source/input boundaries,
  authenticated review access and public HTTP projections.
- Focused public/exact/ingestion contracts: 98 passed across 4 suites.
- Final server run: `npm test -- --runInBand --testTimeout=30000`,
  106 suites / 1044 tests passed, including the prior IGNORE_CHANGE atomicity suite.
- Client full suite: `npm test`, 551 tests passed.
- Final server and Client local builds passed; `git diff --check` passed.
- The Client build emitted existing Node-version and bundle-size warnings; no runtime
  upgrade or dependency change was made.
- No region-specific branch was introduced in the changed public identity/ingestion
  service. Production place datasets and deployed files were not edited.
- These results cover the local review tree. They do not substitute for revalidation
  of the later integrated production-main tree or repair previously incorrect approvals.
