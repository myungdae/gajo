import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("./pages/ConciergePage.tsx",import.meta.url),"utf8"),api=readFileSync(new URL("./api/client.ts",import.meta.url),"utf8");
test("follow-up requests reuse one region-scoped structured discovery context",()=>{assert.match(page,/const \[discoveryContext, setDiscoveryContext\]/);assert.match(page,/discoveryContext\?\.regionId === region\.id/);assert.match(page,/discoveryCategoryHint: \(discoveryContext\?\.targetCategory/);assert.match(page,/setDiscoveryContext\(undefined\)/)});
test("discovery context retains anchor category primary result exclusions and source turn",()=>{for(const field of ["anchor:","targetCategory:","currentResult:","shownEntityIds:","sourceTurnId:"])assert.ok(page.includes(field));assert.match(api,/distanceInfo\?:\{status:'RESOLVED'\|'NEEDS_CLARIFICATION'/)});
test("distance answers render as distance information rather than itinerary composition",()=>{assert.match(page,/result\.distanceInfo/);assert.match(page,/className="recommendation-section distance-info-result"/);assert.match(page,/실제 이동 거리는 선택한 길과 교통수단에 따라 달라질 수 있어요/)});
