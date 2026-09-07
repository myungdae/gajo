import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("receipt 33 keeps production travel simple and reveals replanning only for real changes", () => {
  const page = read("./pages/ItineraryPage.tsx");
  assert.match(page, /<h2>여행 중 달라진 상황 확인<\/h2>/);
  assert.match(page, /날씨나 이동 상황이 달라지면 남은 일정에 미치는 영향만 알려드려요/);
  assert.match(page, /import\.meta\.env\.DEV && <div className="demo-runtime-control">/);
  assert.match(page, /<h2>여행 상황이 바뀌었어요<\/h2>/);
  assert.match(page, /새 일정으로 바꾸기/);
  assert.match(page, /기존 일정 유지/);
  assert.doesNotMatch(page, /<h2>런타임 상황 확인<\/h2>/);
  assert.doesNotMatch(page, /<h2>추천 근거 요약<\/h2>/);
});

test("receipt 33 exposes immediate action and restrained optional sound", () => {
  const page = read("./pages/ItineraryPage.tsx");
  const sound = read("./journeySound.ts");
  assert.match(page, /<small>지금 갈 곳<\/small>/);
  assert.match(page, /navigationLabel="출발하기"/);
  assert.match(page, /playJourneySound\("ready"/);
  assert.match(page, /playJourneySound\("success"/);
  assert.match(page, /알림 소리 끄기/);
  assert.match(page, /알림 소리 켜기/);
  assert.match(sound, /gain\.gain\.exponentialRampToValueAtTime\(0\.035/);
  assert.match(sound, /played\.has\(eventKey\)/);
});

test("receipt 33 uses everyday language for past trips and recommendation evidence", () => {
  const archive = read("./components/ArchivedTrips.tsx");
  const page = read("./pages/ItineraryPage.tsx");
  assert.match(archive, /이전에 다녀온 여행과 일정을 다시 볼 수 있어요/);
  assert.match(archive, /아직 지난 여행이 없습니다/);
  assert.doesNotMatch(archive, /읽기 전용/);
  assert.match(page, /<h2>추천 이유<\/h2>/);
  assert.match(page, /<h2>이 추천을 만든 정보<\/h2>/);
  assert.doesNotMatch(page, /Evidence Chain/);
});
