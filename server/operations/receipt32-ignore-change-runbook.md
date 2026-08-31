# Receipt 32: guarded IGNORE_CHANGE and document restore

This runbook is a design and dry-run checklist. It does not authorize a production write.

## Fixed target

- MongoDB `_id`: `6a851cbab346fbf150ee371f`
- service `id`: `seed-hapcheon-garden-theme-park`
- region: `hapcheon`
- canonical ID: `https://hapcheon.example/ontology#hapcheonGardenThemePark`
- allowed IGNORE_CHANGE fields: `lifecycleStatus`, `detectedChanges`, `proposedFacts`, `auditTrail`, `updatedAt`, and `__v`

Before execution, read the target with a projection that includes all fields and save `EJSON.stringify(document, { relaxed: false })` in an access-restricted location. Record its SHA-256, `_id`, `id`, canonical ID and `__v`. Do not print the pre-image or connection details in a terminal transcript.

The write, if separately approved, must use:

`POST /api/admin/regional-data/seed-hapcheon-garden-theme-park/actions/IGNORE_CHANGE`

The authenticated request must provide the common administrator principal installed by `AdminTokenGuard`; the controller passes its opaque `actorId` to `RegionalDataService.action()`.

## Preconditions

Abort unless all conditions match the saved manifest:

1. `_id`, service `id`, region and canonical ID equal the fixed target above.
2. Current `__v` equals the captured pre-image `__v`.
3. Current full-document SHA-256 equals the captured pre-image SHA-256.
4. Lifecycle is `CHANGE_DETECTED` and the expected proposed/detected change exists.
5. Full hashes for the video theme park and Hwangmaesan silver-grass festival have been recorded for later no-change comparison.

## Expected post-image

Abort verification unless the post-image has `lifecycleStatus=ACTIVE`, no `proposedFacts`, an empty `detectedChanges`, and exactly one new `IGNORE_CHANGE` audit event containing actor, time and the reviewed changes. A protected-facts hash excluding the allowed fields must be identical before and after. The two non-target document hashes must also be identical.

## Restricted document restore

There is currently no safe reverse action in the public controller. Do not add a general restore endpoint. If restoration is separately approved, use a one-run, non-HTTP maintenance entry point that calls a domain service operation and is compiled out of normal routing. It must accept the fixed manifest and pre-image file, not an arbitrary document selector.

The prepared entry point is `npm run receipt32:restore`. It is dry-run unless `--apply`, `--confirm RESTORE_RECEIPT_32_6a851cba`, and `RECEIPT32_RESTORE_APPROVED=true` are all present. The pre-image and manifest must be regular files under `server/.maintenance-private/receipt32/`, which is excluded from Git. Restrict that directory to the operating account before placing backup material there.

The production MongoDB is standalone. The operation therefore uses one-document `findOneAndUpdate`, not a transaction. Its compare-and-set filter is the complete post-image corresponding to the approved SHA-256, including `_id`, service `id`, canonical ID, region and `__v`. It may restore only `lifecycleStatus`, `detectedChanges`, and `proposedFacts`; it must append a new `RESTORE_IGNORE_CHANGE` audit event with opaque actor ID, timestamp, reason, pre-image SHA-256 and restored field names. It must not replace or truncate the audit trail, timestamps, identity or current canonical facts.

Success requires one matched and modified document, restored-field equality with the pre-image, unchanged protected-facts hash, a new restore audit event, and unchanged hashes for the two non-target documents. A mismatch or zero/multiple matches is a failure and must perform no write.

## Minimal read-only production index check

An operator with an already configured read-only MongoDB session can run the following in `mongosh`. It prints collection names and index metadata only:

```javascript
db.getCollectionNames()
  .filter(name => /regional|place|tour|candidate/i.test(name))
  .sort()
  .forEach(name => printjson({ collection: name, indexes: db.getCollection(name).getIndexes().map(({ name, key, unique, partialFilterExpression }) => ({ name, key, unique, partialFilterExpression })) }));
```

To verify the actual target collection without returning documents:

```javascript
db.getCollectionNames().sort().forEach(name => {
  const count = db.getCollection(name).countDocuments({ _id: ObjectId('6a851cbab346fbf150ee371f') });
  if (count) printjson({ collection: name, targetCount: count });
});
```

Run these only in the operator's secured environment. Do not paste credentials, connection strings or document bodies into chat.

## Core destination alignment

The fixed core target is `_id=6a881a4d4c8682c6391c3ca3`, `id=core-hapcheon-합천영상테마파크`, `regionId=hapcheon`. `npm run receipt32:core-align` is dry-run by default. Alignment apply requires all of `--apply`, `--confirm ALIGN_RECEIPT_32_CORE_6a881a4d`, and `RECEIPT32_CORE_ALIGN_APPROVED=true`. Core restore instead requires `--restore --apply`, `--confirm RESTORE_RECEIPT_32_CORE_6a881a4d`, and `RECEIPT32_CORE_RESTORE_APPROVED=true`.

The before core must exactly contain the compact display name, garden canonical ID, both old aliases, `expectedCategory=TOURISM_NATURE`, `active=true`, the manifest `__v`, and the approved pre-image SHA-256. The after core keeps `_id`, `id`, region, category and active unchanged; it sets the public display name to `합천 영상테마파크`, links the video canonical ID, and retains only `합천영상테마파크` and `영상테마파크` as approved aliases. It appends `CORE_DESTINATION_IDENTITY_ALIGNED`. A duplicate row with the new display name aborts before write. A retry that sees this exact after identity and its matching audit event returns `ALREADY_ALIGNED` without writing.

Core restore is an independent one-document compare-and-set. It restores display name, canonical ID, aliases, expected category and active from the core pre-image and appends `RESTORE_CORE_DESTINATION_IDENTITY`; it never truncates the alignment audit. Core and RegionalDataRecord backups use separate Extended JSON files, manifests, SHA-256 values and approval gates under `.maintenance-private/receipt32/`.

## Standalone deployment order and recovery window

1. Read indexes and prove one target for each fixed `_id`; prove no `hapcheon + 합천 영상테마파크` core duplicate.
2. Save separate core and garden Extended JSON pre-images/manifests. Save hashes for every other core and for video theme park, silver-grass festival and C Park RegionalDataRecords.
3. Run core alignment dry-run, then the one-document core compare-and-set.
4. Immediately start only the new API candidate and verify bootstrap and health.
5. If the new candidate fails, do not restart the stable image against the aligned core. Keep the already-running stable container serving, restore the core with the separate core restore gate, verify its hash and audit, then retain/restart the stable image only after the old core identity is back.
6. Only after the new API is healthy, run `npm run receipt32:restore -- --check-ignore` with the garden pre-image and manifest. This mode is read-only and refuses `--apply`. If it passes, use the separately approved domain action for `IGNORE_CHANGE`. Its restore remains an independent document operation.
7. Recheck the three invariant RegionalDataRecords and all unrelated core hashes.
8. Only then switch the client and perform the 390px mobile end-to-end check.

The interval after core alignment and before the new API is healthy is deliberately treated as a compatibility risk window: the old stable image expects the old compact core display name. Do not recycle its healthy container during this interval. If infrastructure automatically restarts it, restore the core first or pin traffic to an already healthy stable instance whose bootstrap has completed.
