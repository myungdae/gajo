import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("journey questions use traveler language while stable option values remain unchanged", () => {
  const journey = read("./runtimeJourney.ts");
  const entry = read("./components/RuntimeJourneyEntry.tsx");
  for (const copy of ["지금 나에게 맞는 여행", "지금 무엇을 하고 싶으세요?", "내 여행에 맞게 더 알려주세요", "오늘 여행할 시간이 얼마나 있으신가요?", "원하는 것을 말하거나 글로 알려주세요"]) assert.match(journey, new RegExp(copy));
  for (const copy of ["지금 하고 싶은 것을 골라보세요", "누구와 함께 여행하시나요?", "어떻게 이동하실 건가요?", "걷는 데 불편함이 있으신가요?"]) assert.match(entry, new RegExp(copy));
  for (const value of ["FOOD", "CAFE", "ACCOMMODATION", "NEXT_PLACE", "EVENT_TODAY"]) assert.match(journey, new RegExp(`'${value}'`));
});

test("departure guidance offers an AI check without inventing current weather", () => {
  const home = read("./pages/HomePage.tsx");
  assert.match(home, /출발 전에 확인하세요/);
  assert.match(home, /목적지의 최신 날씨는 아직 확인되지 않았어요/);
  assert.match(home, /여정을 만들면 출발 전에 필요한 정보를 확인해 드릴게요/);
  assert.match(home, /출발 정보 확인하기/);
  assert.match(home, /최신 날씨와 이용 정보를 확인해 주세요/);
  assert.doesNotMatch(home, /현재 .*주변 날씨는/);
});
