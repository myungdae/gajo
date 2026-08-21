import test from "node:test";
import assert from "node:assert/strict";
import { understoodSummary } from "./understoodSummary.ts";

test("place discovery never claims an itinerary was composed", () => assert.doesNotMatch(understoodSummary({ discovery: { category: "CAFE", anchorLabel: "합천호 스마일펜션" } }), /일정.*구성/));
test("journey composer retains itinerary copy", () => assert.equal(understoodSummary({ recommendation: { itinerary: { steps: [] } } }), "말씀하신 방문 상황을 바탕으로 일정을 구성했습니다."));
test("cafe summary uses the canonical anchor", () => assert.equal(understoodSummary({ discovery: { category: "CAFE", anchorLabel: "합천호 스마일펜션" } }), "합천호 스마일펜션을 기준으로 주변에서 차를 마실 수 있는 카페를 찾았습니다."));
test("food summary reflects dining intent", () => assert.equal(understoodSummary({ discovery: { category: "FOOD", anchorLabel: "로우풀" } }), "로우풀을 기준으로 주변에서 식사할 수 있는 곳을 찾았습니다."));
test("attraction summary safely falls back to the current place", () => assert.equal(understoodSummary({ discovery: { category: "TOURISM_NATURE" } }), "현재 장소를 기준으로 주변에서 둘러볼 만한 곳을 찾았습니다."));
