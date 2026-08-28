import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
test("planning UI explicitly exposes saved regional trip loading and safe new-trip copy", () => {
  const entry = source("./components/SavedTripEntry.tsx"),
    concierge = source("./pages/ConciergePage.tsx");
  for (const copy of [
    "저장한 {region.regionName} 여행이 있습니다.",
    "내 여행 불러오기",
    "새 일정 만들기",
    "이전 여행은 보관됩니다",
  ])
    assert.ok(entry.includes(copy));
  assert.match(concierge, /tripMode\s*===\s*["']PLAN["'][\s\S]*<SavedTripEntry/);
});
test("automatic restore is not the only My Trip access path", () => {
  const layout = source("./components/Layout.tsx"),
    continuity = source("./components/TripContinuity.tsx");
  assert.match(layout, /label:'내 여행'|label: "내 여행"/);
  assert.match(layout, /navItems\.map/);
  assert.doesNotMatch(layout, /hasSavedTrip/);
  assert.match(layout, /itineraryItemCount/);
  assert.match(layout, /my-trip-count/);
  assert.match(layout, /regionalPath\(item\.to, region\.id\)/);
  assert.match(continuity, /이어갈 여행이 있어요/);
});
test("post-save continuation keeps discovery in place and exposes immediate execution", () => {
  const continuation = source("./components/ItineraryAddContinuation.tsx"),
    actions = source("./components/EntityActions.tsx"),
    nearby = source("./pages/NearbyRestaurantsPage.tsx");
  for (const copy of [
    "내 여행에 담았습니다.",
    "으로 출발",
    "내 여행 전체 보기",
    "계속 장소 찾기",
  ])
    assert.ok(continuation.includes(copy));
  assert.match(actions, />내 여행에 담기</);
  assert.match(nearby, />내 여행에 담기</);
  assert.doesNotMatch(continuation, /도착 완료/);
});
test("unverified search candidates cannot be added to My Trip", () => {
  const item = source("./components/RecommendationItineraryItem.tsx");
  assert.match(item, /operationalEvidence\?\.tripEligible\s*!==\s*false/);
});
test("saved-place collection is independent with restrained persistent removal", () => {
  const page = source("./pages/ItineraryPage.tsx"),
    item = source("./components/RecommendationItineraryItem.tsx");
  assert.match(page, /담아둔 곳/);
  assert.match(page, /모두 방문하지 않아도 괜찮아요/);
  assert.match(page, /<details\s+className="saved-place-menu">/);
  assert.match(page, /내 여행에서 빼기/);
  assert.match(page, /removeSavedPlace/);
  assert.match(item, /collection/);
  assert.match(item, /!collection\s*&&\s*\(/);
});
test("full journey remains ordered while saved places render separately", () => {
  const page = source("./pages/ItineraryPage.tsx"),
    journey = source("./journeyExecution.ts");
  assert.match(page, /itinerary-day-group/);
  assert.match(page, /SavedPlacesSection/);
  assert.match(journey, /savedPlaces:\s*\[\.\.\.places, normalized\]/);
  assert.match(journey, /savedAsFullJourney/);
});
test("mobile My Trip controls avoid nested scrolling through 430px", () => {
  const css = source("./index.css");
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*saved-trip-entry/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /saved-place-card/);
  assert.doesNotMatch(css, /saved-places-section[^}]*overflow-y/);
});
