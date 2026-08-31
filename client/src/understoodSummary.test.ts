import test from "node:test";
import assert from "node:assert/strict";
import { understoodSummary } from "./understoodSummary.ts";

test("place discovery never claims an itinerary was composed", () => assert.doesNotMatch(understoodSummary({ discovery: { category: "CAFE", anchorLabel: "합천호 스마일펜션" } }), /일정.*구성/));
test("journey composer retains itinerary copy", () => assert.equal(understoodSummary({ recommendation: { itinerary: { steps: [] } } }), "말씀하신 방문 상황을 바탕으로 일정을 구성했습니다."));
test("cafe summary uses the canonical anchor", () => assert.equal(understoodSummary({ discovery: { category: "CAFE", anchorLabel: "합천호 스마일펜션" } }), "합천호 스마일펜션을 기준으로 주변에서 차를 마실 수 있는 카페를 찾았습니다."));
test("food summary reflects dining intent", () => assert.equal(understoodSummary({ discovery: { category: "FOOD", anchorLabel: "로우풀" } }), "로우풀을 기준으로 주변에서 식사할 수 있는 곳을 찾았습니다."));
test("attraction summary safely falls back to the current place", () => assert.equal(understoodSummary({ discovery: { category: "TOURISM_NATURE" } }), "현재 장소를 기준으로 주변에서 둘러볼 만한 곳을 찾았습니다."));
test("exact attraction search describes the requested canonical place instead of nearby discovery", () => assert.equal(understoodSummary({ discovery: { category: "TOURISM_NATURE", referenceResolution: { mode: "EXPLICIT_ENTITY_TARGET" }, entities: [{ programLabel: "합천 영상테마파크" }] } }), "요청하신 합천 영상테마파크를 정확히 찾았습니다."));
test("pronoun-resolved attraction summary uses the canonical active reference", () => assert.equal(understoodSummary({ discovery: { category: "TOURISM_NATURE", anchorLabel: "로우풀" } }), "로우풀을 기준으로 주변에서 둘러볼 만한 곳을 찾았습니다."));
test("search-backed sauna summary remains intent-aware", () => assert.equal(understoodSummary({ discovery: { category: "HOT_SPRING_WELLNESS", anchorLabel: "합천호 스마일펜션", searchFallback: { used: true } } }), "합천호 스마일펜션을 기준으로 주변 사우나·목욕시설을 찾았습니다."));
