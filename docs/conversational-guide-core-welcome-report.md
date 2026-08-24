# Conversational Guide and first-visit audit

## Shared behavior

- Approved Guide explanations are available read-only inside every regional Local Concierge.
- Explanation requests return before runtime context construction and do not save or replace TripSession, itinerary, execution, conversational anchor, or discovery context.
- The shared first-visit intent recognizes the same natural-language variants for every region and reads only the existing Core Destination configuration.
- Core candidates are presented as candidates, not paid ranking or guaranteed recommendations. Weather, remaining time, mobility, and visitor preferences remain replanning inputs.

## Core Destination coverage

| Region | Existing configured candidates | Current first-visit result |
| --- | --- | --- |
| Hapcheon | 황매산, 합천영상테마파크, 황계폭포, 금성산 | Existing candidates are introduced without a forced rank. |
| Gajo | 거창창포원, 수승대 | Existing candidates are introduced without adding a generic restaurant or café. |
| Okcheon | None in `INITIAL_CORE_DESTINATIONS` | `CORE_DATA_INSUFFICIENT`; no new designation is invented. Existing official cultural/tourism evidence remains available to its established semantic journey, but it is not silently promoted to Core Destination. |

## Glossary

One client-side glossary supplies tap/click/keyboard explanations for Regional Copilot, Regional Manager, Hyper-local Knowledge, Replanning, Core Destination, and RDM. It is shared by Guide and Concierge answers. Mobile presentation uses a fixed, bounded popover above bottom navigation at 360, 390, and 430 px widths.

## Boundaries retained

No Local Concierge operating logic, preview navigation policy, RDM authorization, regional source data, or current municipality/private-operator contract claim was added or changed by this work.
