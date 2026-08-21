# Concierge Guide Copilot Phase 1 deployment

The Guide is an isolated public explainer. It is not the visitor Local Concierge and not the authenticated Regional Copilot.

## Build artifacts

- Entry HTML: `dist/guide.html`
- Client entry: `src/guide-main.tsx` and its generated hashed CSS/JS assets
- Public API: `POST /api/guide/questions`
- The Guide entry has no manifest and does not register the visitor service worker.

## Proposed `guide.odex.kr` boundary

Create a dedicated reverse-proxy virtual host after DNS/TLS ownership is available. Serve `/` from `/guide.html`, serve only generated static assets, and proxy only `/api/guide/` to the API container. Return 404 for `/api/admin/`, `/api/copilot/`, visitor itinerary APIs, and other operational namespaces on this host. Do not forward an admin token or Copilot JWT.

The Guide API is read-only, accepts a maximum 500-character question, and applies a per-client in-process Phase-1 rate limit. Production infrastructure should add load-balancer/WAF rate limiting because an in-process limit is not shared across replicas.

No new environment variables or secrets are required. The existing client and API production builds include the entry and module. DNS, TLS, and production proxy changes are intentionally outside this task.

## Data and learning boundary

Unknown questions return an ephemeral `NEW_GUIDE_QUESTION` review candidate with `questionStored: false`. Phase 1 has no public answer editor and writes neither RDM nor Regional Copilot data. A future reviewed workflow may promote approved questions into the structured Guide Knowledge catalog.

Platform principle: **shared intelligence, isolated regions**. The Guide knowledge is shared; operational regional data and journey state remain outside the Guide.
