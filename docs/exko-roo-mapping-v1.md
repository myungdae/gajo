# EXKO → Regional Concierge → Roo mapping v1

## Architecture and source

EXKO supplies semantic classes, taxonomy, object relationships, inverse relationships, and relational facets. Regional Data Manager (RDM) remains current verified operational truth. Roo owns current visitor/runtime state and decisions; live tools own observations; the action layer owns navigation, calls, reservations, saving, execution, and replanning.

The read-only source is `server/semantic/exko/sight-copy.rdf`, copied byte-for-byte from `C:\Users\ZZANGGUN-US\Documents\Downloads\sight copy.rdf`. It is RDF/XML created with TopBraid Composer, XML-default UTF-8, base namespace `http://sight.eventpool.kr/resource/`, and SHA-256 `9FC6DB71857448B4047F18B4E1D6A2500C0226C0AC8CD426C96021541372FFF9`. The source is never normalized or modified. `server/scripts/build-exko-inventory.py` is the reproducible inspection/extraction step.

## Inventory

The source contains 71 unique classes (218 declarations), 154 unique object properties (518 declarations), 16 unique datatype properties (27 declarations), 1,564 described entities, 5,754 extracted object edges, and 5,060 literals. Seventy-eight object properties declare `owl:inverseOf`. Machine-readable class hierarchy, domain/range, inverses, `facet:defaultFacets`, namespaces, and major taxonomy matches are in `inventory.json`.

The bounded one-hop Hapcheon pilot has 30 entities and 98 internal edges. Seeds cover 합천군, 합천호, 합천호 스마일펜션, 카페 로우풀, 해인사, 팔만대장경, 황매산, 합천 영상테마파크, 합천 가야산 소리길, and 합천댐 where present. It also exposes connected restaurant, cafe, accommodation, camping, nature, cultural, theme, and infrastructure entities. This is not national graph activation.

## Mapping policy

Class hierarchy, object properties, inverses: `KEEP`. Default facets: `KEEP/MAP`. `lat_long`: `TRANSFORM + VERIFY`. Telephone/homepage: `VERIFY`. 여행최적기: seasonal-context `MAP`. Near/related business edges: `SEMANTIC_HINT`. Weather: `RUNTIME`. Fatigue and remaining time: `ROO_ONLY`. Geographic distance: `RUNTIME_DERIVED`, never a static EXKO edge.

Relational facets remain graph edges (`subject → ObjectProperty → entity`) and are not flattened into tags. Attribute facets remain literal/value facts. Inverse declarations and observed reverse edges are independently queryable.

Accommodation alignment uses actual RDF URIs. `숙박`, `호텔`, `모텔`, and `리조트` align exactly to their operational concepts; `펜션_풀빌라`, `민박_게스트하우스`, and `B&B_한옥마을_게스트하우스` are close mappings. EXKO `글램핑_캠핑` is close to GLAMPING/CAMPING and broader than AUTO_CAMPING/CARAVAN. FOREST_LODGE is narrower than EXKO 숙박 until a more specific source class is verified. Neither hierarchy is discarded.

## Entity alignment and precedence

Alignment records are separate from RDF and use EXACT, HIGH_CONFIDENCE, POSSIBLE, UNRESOLVED, or CONFLICT. Name alone never creates identity and the pilot emits no `owl:sameAs`. Smile Pension and `카페_로우풀` have reviewed HIGH_CONFIDENCE mappings using name, class/region relationships, aliases or RDM review. `카페Lowful` remains POSSIBLE as a likely duplicate. 황매산 versus 황매산 군립공원 and 영상테마파크 versus 정원테마파크 remain POSSIBLE because scope differs.

Operational precedence is ACTIVE/VERIFIED RDM > verified regional baseline > EXKO candidate fact > unknown. EXKO-only entities can supply knowledge or become verification candidates, but never visitor-operational actions. RDM-only ACTIVE/VERIFIED entities remain fully eligible without EXKO alignment. A future manager-created business therefore proceeds NEW_CANDIDATE → verification → ACTIVE and can receive alignment later without editing RDF.

## Runtime boundary and reference behavior

EXKO states that 합천호 스마일펜션 is related to 카페_로우풀. The adapter contributes that semantic candidate edge. RDM supplies Lowful’s current verified coordinates/actions and Smile Pension’s verified coordinates/phone. Roo computes approximately 301 m for the current request. The distance is neither read from nor written to EXKO.

Current location, fatigue, weather, remaining time, itinerary execution, companions, availability, distances, and scores remain runtime facts. Diagnostics contain only resolution status and counts—never raw visitor text.

## Feature flag, limitations, and rollback

Set `EXKO_HAPCHEON_PILOT=true` to enable enrichment. It is off by default and always disabled outside Hapcheon. Disabling it restores existing discovery behavior without changing RDM data.

EXKO instance coverage is intentionally incomplete. Missing instances never mean missing concepts and never suppress RDM entities. EXKO operational literals may be stale and are not promoted by the adapter. The pilot provides structured semantic evidence for future explanations but does not create a new RAG system or recommendation engine.
