import test from "node:test";
import assert from "node:assert/strict";
import { REGION_CONFIGS, REGION_HOME_ENGLISH } from "./regionConfig.ts";
import { regionalHomeGuidancePlace, selectedRegionalHomePlace } from "./regionalHomeGuidanceContext.ts";
import type { TripSession } from "./tripSession.ts";

const session = (overrides: Partial<TripSession> = {}): TripSession => ({ id: "trip-1", anonymousTripId: "trip-1", regionId: "hapcheon", mode: "NOW", createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T00:00:00.000Z", ...overrides });

test("does not invent Hapcheon Lake when location and destination are absent", () => {
  const current = session(), context = regionalHomeGuidancePlace(REGION_CONFIGS.hapcheon, current, "en", REGION_HOME_ENGLISH.hapcheon);
  assert.equal(selectedRegionalHomePlace(REGION_CONFIGS.hapcheon, current), undefined);
  assert.doesNotMatch(JSON.stringify(context), /Hapcheon Lake/);
  assert.match(context.characteristic, /Create a journey to see verified guidance/);
});

test("user location alone is not treated as a selected destination", () => {
  const current = session({ locationContext: { now: { status: "CONFIRMED", source: "GPS", latitude: 35.56, longitude: 128.16, observedAt: "2026-09-03T00:00:00.000Z", confirmedAt: "2026-09-03T00:00:00.000Z" } } });
  assert.doesNotMatch(JSON.stringify(regionalHomeGuidancePlace(REGION_CONFIGS.hapcheon, current, "en", REGION_HOME_ENGLISH.hapcheon)), /Hapcheon Lake/);
});

test("uses a place only after it is explicitly selected in the trip", () => {
  const lakeId = "https://hapcheon.example/ontology#hapcheonLake", current = session({ execution: { currentEntityId: lakeId } });
  assert.equal(selectedRegionalHomePlace(REGION_CONFIGS.hapcheon, current)?.id, lakeId);
  assert.equal(regionalHomeGuidancePlace(REGION_CONFIGS.hapcheon, current, "en", REGION_HOME_ENGLISH.hapcheon).label, "Hapcheon Lake");
});
