# Partner pilot security Phase 1.6

## Public write limits

Partner public-write routes use `PublicWriteRateLimitGuard`. The default store is
process-local and is appropriate for the current single API container. The guard
depends on the `PUBLIC_WRITE_RATE_LIMIT_STORE` token, so a shared Redis-backed
implementation can replace it without changing controllers or policies when the
API is scaled to multiple instances.

Only an HMAC digest of the client identifier is held in memory. Raw addresses are
not written to MongoDB or logs by this feature. `RATE_LIMIT_HASH_SECRET` may be
injected at runtime and is mandatory in production or shared-store mode. It must
contain at least 32 bytes. Development and test may use a random per-process salt;
that fallback intentionally resets all quotas on restart.

Forwarding headers are ignored by default. `TRUSTED_PROXY_ADDRESSES` may contain a
comma-separated allowlist of immediate proxy addresses. Forwarded chains are
considered only when the socket peer is on this allowlist and are evaluated from
the trusted edge toward the client. Do not configure a broad network range or a
public client address.

IPv4-mapped IPv6 is normalized to IPv4. Native IPv6 clients share a `/64` rate
identity. Malformed forwarded chains use one fail-closed identity rather than
receiving a new quota. The in-memory store never evicts an active bucket: after
expired buckets are removed, new identities are rejected at capacity. A separate
process-wide public-write ceiling also applies.

## Application automation defense

The application API applies strict field-size limits, a hidden honeypot, and a
unique normalized fingerprint over region, business name, address, and phone.
Unexpected persistence errors use Nest's generic 500 response and duplicate
submissions receive a stable conflict message without database details.

Before deployment, run the read-only check below against the intended database.
It never creates or modifies an index:

`node scripts/check-partner-application-index.mjs`

No external CAPTCHA dependency is enabled. A CAPTCHA adapter can be added before
the service call if pilot traffic shows the honeypot and rate policy are
insufficient; CAPTCHA tokens must never be treated as partner authentication.

## Management keys

Only SHA-256 key hashes are stored. Issuance, rotation, and revocation update the
key version, timestamps, and embedded audit entry in the same Partner document
write. A plaintext key is returned only by the issuance or rotation response.
Revocation removes the hash and returns no key. Existing keys stop matching as
soon as a rotation or revocation update succeeds.

The management key remains a Phase 1.6 pilot credential, not a user account.
Production expansion still requires authenticated owner identities, scoped
sessions, key delivery controls, and administrative audit attribution.

Management-key audit entries currently grow inside each Partner document. Move
them to an append-only audit collection in Phase 2 before any partner approaches
100 key events, the Partner document exceeds 1 MiB, or administrative attribution
is introduced—whichever happens first. MongoDB's 16 MiB document limit must not
be treated as the operational threshold.
