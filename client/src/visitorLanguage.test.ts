import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const layout = source("./components/Layout.tsx"), itinerary = source("./pages/ItineraryPage.tsx"), conversation = source("./pages/ConciergePage.tsx"), guide = source("./guide-main.tsx"), css = source("./index.css");

test("Local Concierge visitor navigation and CTAs use AI 여행도우미", () => {
  assert.match(layout, /label: "AI 여행도우미"/);
  for (const copy of ["AI 여행도우미에게 원하는 여행을 말씀해 주세요.", "AI 여행도우미에게 물어보기", "AI 여행도우미로 돌아가기"]) assert.ok(itinerary.includes(copy));
  assert.doesNotMatch(`${layout}\n${itinerary}`, /AI 컨시어지/);
});

test("public Guide uses plain travel language", () => {
  assert.match(guide, /지역 AI 여행안내/);
  assert.doesNotMatch(guide, /컨시어지|Concierge/i);
});

test("voice guidance appears once with examples and one privacy reassurance", () => {
  assert.equal((conversation.match(/음성은 저장하지 않습니다\./g) || []).length, 1);
  assert.equal((conversation.match(/className="voice-helper"/g) || []).length, 1);
  for (const phrase of ["비가 와", "배고파", "카페 가고 싶어"]) assert.ok(conversation.includes(phrase));
  assert.doesNotMatch(conversation, /말씀하신 내용이 위 입력창에 들어갑니다/);
});

test("large shared composer has useful placeholder and mobile-safe readable help", () => {
  assert.match(conversation, /placeholder="예: 비가 와 \/ 배고파 \/ 카페 가고 싶어"/);
  assert.match(conversation, /useSpeechInput\(input, setInput\)/);
  assert.match(css, /\.voice-helper,[\s\S]*font-size:\s*14px/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*concierge-unified-composer/);
  assert.match(conversation, /내 여행으로 돌아가기/);
});
