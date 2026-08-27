# AI Travel Diary foundation

## Current evidence and archive semantics

`TripSession` is an anonymous, region-owned browser record. It currently preserves the session identity, created/updated timestamps, planned and runtime context, ordered itinerary steps, separately saved places, execution status, must-visit constraints, and replan events. Starting a new trip copies a meaningful active session to a region-prefixed archive key and creates a separate active identity. Existing archives are read-only in the visitor UI and are never deleted by archive presentation code.

Archive creation previously copied every active session, including the empty session automatically created by `ensureTripSession`. Repeated “새 여행 시작” actions therefore created distinct, validly keyed but evidence-free archives. This was not a duplicate-key or recovery issue. Future evidence-free sessions are no longer archived; all existing empty archives remain and appear as “일정 없음.” A session with itinerary steps, saved places, execution evidence, replan history, or planned context remains archivable.

New archives receive `archivedAt` and sort newest first by that value, with legacy archives falling back to `updatedAt`. The trip display date uses an explicit planned start date when present, otherwise `createdAt`. Archive lookup remains strictly namespaced by region and rejects a payload whose `regionId` differs.

## Visited versus planned

An itinerary item is a plan, not proof of a visit. Only an explicit `COMPLETED` value from `execution.statusByEntityId` or the step status counts as visited. `SKIPPED`, `PLANNED`, `READY`, `EN_ROUTE`, and `NEWLY_ADDED` do not. `EN_ROUTE` currently records a visitor choosing navigation; it does not establish arrival.

The current model supports completed and skipped states, but the visitor UI has no clear completion button. Phase 2 should add one restrained action—“방문 완료”—to an execution item and persist `COMPLETED` through the existing execution state mechanism. A separate “건너뛰기” action can persist `SKIPPED`. Neither action should be triggered from GPS alone. Optional event timestamps should accompany every state transition.

## Replan history

Replanning retains completed/skipped steps in the current itinerary, marks removed future steps as `REPLACED_BY_REPLAN` inside `replanHistory.replacedSteps`, marks genuinely introduced current steps `NEWLY_ADDED`, and retains the same TripSession identity, saved places, must-visit constraints, and updated runtime context. These categories must remain separate in any diary input.

The current chronological sequence is partly reconstructable from itinerary order plus ordered replan events. Gaps remain: original-plan snapshots are not immutable, status transitions have no event timestamps, newly added IDs are stored separately from rich snapshots, and completed/skipped items have no completion/skip time. An append-only execution event stream would make chronology reliable.

## Future photo model

Phase 3 can associate zero to three representative photos with a visited place. Suggested metadata: attachment ID, trip ID, region ID, entity ID, object key, capture time if the user permits it, upload time, media type, dimensions, user-selected representative order, and deletion state. Binary photos should use authenticated object storage rather than localStorage; the application database should hold metadata and ownership.

Strip or separately consent to EXIF location data, make retention and deletion clear, provide trip-level export/deletion, and enforce the anonymous/user owner boundary on every object. Client storage should be limited to transient upload/cache data. Do not expose photos to regional managers, copilots, merchants, or municipalities without a separately designed consent flow.

## Future memo and reflection model

A visited-place record may have an optional short user-authored memo and optional revisit preference. Preserve the original text and its edit history; AI output may summarize it but must never silently replace it. Optional trip-level fields can include favorite place, places to revisit, and a one-line reflection. None should block completion or diary generation.

## Future AI diary generation

Phase 4 should construct a structured input containing visited places only, explicit execution chronology, original user notes, user-selected photo metadata, replan events, and optional reflection. Keep two provenance classes:

- `FACT`: explicit completed place/status/time, original memo, selected photo metadata, or recorded replan event.
- `AI_NARRATIVE`: connective or summarizing prose generated from those facts.

Generation must not infer visits from itinerary membership and must not invent weather, emotions, meals, companions, or experiences. Unsupported context should be omitted or clearly requested from the user. Preserve the source facts and original memo alongside the generated version so regeneration is auditable.

## Privacy and storage boundaries

Trip history, notes, reflections, and photos are personal visitor content. They remain in the visitor continuity boundary. Regional Manager, Regional Copilot, merchant, and municipality surfaces receive none of it without explicit, purpose-specific consent. Local Concierge histories remain isolated to Hapcheon, Gajo/Geochang, Okcheon, or the selected region; a national history view is a separate product and data-governance decision.

Browser storage is adequate for the current privacy-reduced TripSession foundation but not durable photo storage or a rich long-term diary. Server sync will need authentication or a robust anonymous ownership/recovery design, encryption in transit and at rest, quotas, retention, account/session deletion, export, conflict resolution, and clear handling of device loss. Raw free text must not be added to current privacy-safe session serialization without an explicit schema and policy decision.

## Recommended roadmap

1. Phase 1 — Human-readable archive UX (implemented): newest-first archive cards, four collapsed records, progressive reveal, empty-trip copy, and execution-aware counts.
2. Phase 2 — Explicit `VISITED`/`SKIPPED` actions, timestamped execution events, immutable original-plan evidence, and user-authored per-place memo.
3. Phase 3 — One to three representative photos per visited place with consent, object storage, EXIF controls, retention, and deletion.
4. Phase 4 — Evidence-grounded AI diary generation with fact/narrative provenance and preserved originals.
5. Phase 5 — Optional personal travel-history experience; consider cross-region aggregation only as an explicit user-controlled product.
