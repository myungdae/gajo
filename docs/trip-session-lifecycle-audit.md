# TripSession identity and archive lifecycle audit

## Finding

The canonical trip identity is `regionId + anonymousTripId`. Calendar date is presentation data and is never an identity or merge key. Archive storage already uses `regional-concierge-trip-archive-v1:{regionId}:{anonymousTripId}`, so repeated archival of the same TripSession updates the same canonical record rather than creating a second key.

Multiple same-day cards with different TripSession IDs can legitimately result from confirmed “새 여행 시작” actions. Legacy evidence-free fragments were also possible before empty sessions were excluded from archival. The lifecycle audit found one unintended identity-replacement race: an asynchronous server restoration begun for trip A could finish after the visitor explicitly started trip B, and `saveTripSession(A)` could overwrite B's active regional pointer because persistence validated region but not identity. That path is classified `RESTORE_REPLACEMENT` and can fragment later activity across identities.

## Creation and mutation paths

`createTripSession` is reached in production only when `ensureTripSession` finds no valid regional record or when `archiveAndStartNewTrip` executes after explicit confirmation. Adding/removing/saving places, location changes, Concierge questions, completion/skipping, itinerary edits, replanning, navigation return, reload, and PWA reopen load and mutate the current identity. Server sync uses the current anonymous ID; reconciliation does not intentionally create one.

The three explicit start surfaces are Trip Management, Saved Trip Entry, and home Trip Continuity. Each requires a confirmation and calls the same archive/start function. Archive records now carry `archiveReason: EXPLICIT_NEW_TRIP` for future diagnosis.

## Fix

Normal persistence may no longer replace an existing same-region active pointer with a different TripSession ID. Only `archiveAndStartNewTrip` receives the narrow `allowIdentityReplacement` authority after writing the meaningful old trip to its canonical archive key. Home restoration adopts the value returned by guarded persistence, so a stale response cannot remain presented as active.

This preserves one identity through PLAN, NOW, saved-place changes, VISITED/SKIPPED evidence, replanning, and conversation. It also preserves intentional same-day separate trips when the visitor explicitly starts each one.

## Legacy evidence and future migration

No archive is deleted, merged, renamed, or rewritten in this phase. `auditArchivedTripLifecycle` provides a read-only regional inventory, reports repeated original TripSession IDs, groups same-day records without treating them as duplicates, and classifies known explicit, empty legacy, repeated-ID, and otherwise unknown records. The repository cannot inspect the field user's mobile localStorage, so the exact count and content overlap of that device's records cannot be truthfully reported here.

A future opt-in migration should first export/backup all bytes, group only by original TripSession ID—not date—compare itinerary, saved-place, execution, and replan evidence, and present uncertain cases for user confirmation. Exact repeated-ID copies may be candidates for canonical-key consolidation; different IDs must remain separate absent stronger lifecycle provenance.

## UI and diary compatibility

Archive cards now show the recorded `createdAt` time below the date/region label, allowing genuine same-day trips to be distinguished without inventing a time. One canonical TripSession can therefore remain the future AI Travel Diary container for original plan, visited/skipped evidence, replans, additions, photos, memos, and narrative generation. Region-scoped active and archive keys prohibit cross-region deduplication.
