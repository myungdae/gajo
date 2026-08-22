# Shared Intelligence, Isolated Regions

The platform shares engines, runtime logic, the semantic adapter, Roo orchestration, and UI frameworks. It does not share regional truth, visitor state, manager authority, semantic evidence, or operational actions.

## Isolation contract

Every region-scoped operation must receive an explicit `regionId`. Missing or unknown regions fail closed; they never select the first registry entry or Gajo/Hapcheon/Okcheon. Regional resource identity is the composite of region and resource identity, even where a UUID or namespaced URI is already globally unique.

The isolated resources include RDM records and field evidence, Copilot candidates/tasks, Core metadata, EXKO subgraphs and aliases, Place Concepts, search evidence, weather/runtime context, field-demo readiness, conversations, and all TripSession state.

## Boundaries

- RDM and Copilot queries use region predicates for regional lists, evidence changes, readiness, candidates, and task queues. Candidate UUIDs and canonical ontology URIs are globally unique; after lookup, server authorization still checks the row's authoritative region.
- EXKO loads a named regional subgraph. Traversal rejects unsupported regions and filters nodes, alignments, aliases, edges, and results by the requested region.
- Runtime weather caches use region, source, and coordinates. Context-extraction cache and call limits use region plus session identity.
- Region configuration reads return independent cloned objects. Missing/unknown keys fail rather than returning Gajo.
- TripSession and archives use `regional-concierge-trip-session-v1:{regionId}` and `regional-concierge-trip-archive-v1:{regionId}:{tripId}`. Regional read/write APIs have no default region.
- PWA updates do not clear local/session storage. Copilot-origin legacy cache cleanup is hostname-scoped and separate from visitor state.

## Database and destructive-operation audit

RDM operational writes use `{regionId, canonicalEntityId}` and bootstrap upserts include region. Copilot queues and Core lists are region-filtered. Candidate IDs are UUIDs and Core IDs embed region; entity lookup is followed by authoritative row-region authorization. Anonymous trips use `{anonymousTripId, regionId}`. Legacy ontology facility/program CRUD uses globally namespaced RDF URIs rather than regional labels and performs no broad delete.

No regional `deleteMany`, global storage clear, or unscoped reset is used. Archive/new-trip and saved-place clearing target one explicit regional namespace.

## Release and onboarding gate

Every region change must pass its regional functional tests, the symmetric `CROSS_REGION_NON_INTERFERENCE` snapshot suite, three-region golden flow, authorization matrix, semantic/cache/runtime isolation, TripSession/PWA isolation, full server/client suites, and production builds. The same gate applies to Muan, Gyeryong, Daejeon Jung-gu, and future regions.

