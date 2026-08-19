# Regional operational data deployment

Regional operational data has a separate lifecycle from application code. Git deployment never moves MongoDB regional records.

## Safe staging-to-production procedure

### Source environment

1. Open Admin → 지역 데이터 관리자.
2. Select exactly one region, such as 합천.
3. Confirm the intended records are `ACTIVE / VERIFIED`.
4. Enter the admin write token under 데이터 관리.
5. Select **운영 데이터 내보내기** and retain the downloaded versioned JSON package securely.

The normal export contains only active, verified records for that region. It does not contain analytics, sessions, users, raw visitor text, credentials, or MongoDB internal IDs.

### Production environment

1. Open the production Admin page and select the same region.
2. Enter the production admin write token.
3. Choose **데이터 가져오기** and select the JSON package.
4. Leave trusted import unchecked for the normal safe path.
5. Select **가져오기 검토**. Confirm schema version, record count, new records, conflicts, and unchanged records.
6. Select **검증 대기로 가져오기**.
7. Review each imported record in the production Regional Data Manager and explicitly approve it.
8. Verify the effective recommendation, entity detail, regional map, Nearby result, and navigation destination.

Existing production records are never blindly replaced. Differences become `CHANGE_DETECTED`; identical imports are no-ops.

## API alternative

Export:

```text
GET /api/admin/regional-data/export?regionId=hapcheon
x-admin-token: <source admin token>
```

Preview staged import:

```text
POST /api/admin/regional-data/import/preview
x-admin-token: <production admin token>
Content-Type: application/json

{ "package": <exported JSON>, "trustedVerified": false }
```

Apply staged import by sending the same body to `POST /api/admin/regional-data/import`, then approve the imported records through Admin.

Trusted verified import is reserved for controlled recovery or promotion. It requires `trustedVerified: true`, an explicitly exported application package, verified records, supported provenance, and an administrator decision. The source-environment label alone never grants trust.

## Application-level backup

The export API supports an explicit workflow backup mode for authorized administrators. This is not a MongoDB backup and does not contain other collections. Restore always validates records, preserves canonical identity and provenance, and creates review conflicts rather than replacing current operational facts.

## Future normal operation

Once production source adapters are configured, they should create candidates directly in the production Regional Data Manager. Daily discovery then follows candidate → production review → approval, without local-to-production transfer or code deployment.
