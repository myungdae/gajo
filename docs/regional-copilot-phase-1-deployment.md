# Regional Copilot Phase 1 deployment

Regional Copilot is built as a separate Vite entry (`copilot.html`) and a separately authorized API namespace (`/api/copilot/*`). It may share the Phase-1 client container, API process, MongoDB, and AWS host, but it does not share visitor routes or manager write credentials.

## `copilot.odex.kr`

1. Build the existing client with `npm run build`. The output includes `dist/copilot.html` and Copilot-only CSS/JS chunks.
2. Build/start the API with the existing server commands. No additional physical server or port is required; the API remains on internal port `3000`, and the web container remains on internal port `80` (`8090` on the current Compose host mapping).
3. Add a dedicated reverse-proxy virtual host for `copilot.odex.kr`. Serve `/` with `/copilot.html`, serve generated assets from the same client image, proxy only `/api/copilot/` to `api:3000`, and return 404 for visitor/admin API namespaces on this host. Keep the existing visitor host configuration unchanged.
4. Create a DNS A/AAAA record to the existing load balancer/host, or a CNAME to the established application hostname. Do not change DNS until ownership and deployment credentials are available.
5. Issue a TLS certificate covering `copilot.odex.kr`, redirect HTTP to HTTPS, enable HSTS after validation, and mark the page `noindex` (already present in the HTML).

Required server environment:

- `COPILOT_JWT_SECRET`: strong independent signing secret, injected from AWS Secrets Manager/SSM; never reuse `ADMIN_WRITE_TOKEN`.
- `COPILOT_USERS_JSON`: initial Phase-1 identity configuration containing `sub`, `username`, bcrypt `passwordHash`, `role`, and assigned `regions`. Do not store plaintext passwords or this JSON in source control.
- existing `MONGODB_URI` and normal RDM configuration.

Example user object shape (values intentionally omitted):

```json
{"sub":"...","username":"...","passwordHash":"$2b$...","role":"REGIONAL_MANAGER","regions":["hapcheon"]}
```

Production should restrict `/api/copilot/*` with WAF/rate limits and centralized access logs. The Phase-1 JWT expires after eight hours. Migrating identity configuration to an external OIDC/SSO provider is the recommended next security step; the server-side role and region checks remain the authorization boundary.

## Future phases (documentation only)

- Phase 2: direct regional entity creation/editing and richer, still-confirmed natural-language management.
- Phase 3: semantic relationship candidate review/editor and controlled EXKO/RDF workflows.
- Phase 4: privacy-safe tourist demand/gap analytics and reports.
- Phase 5: merchant tooling, subscriptions/revenue sharing, and municipality dashboards.

No Phase 1 code writes EXKO RDF, creates a second runtime reasoner, fakes demand analytics, or automatically verifies a candidate.
