import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const layout = source("./components/Layout.tsx"), itinerary = source("./pages/ItineraryPage.tsx"), conversation = source("./pages/ConciergePage.tsx"), managedCopy = source("./managedVisitorCopy.ts"), guide = source("./guide-main.tsx"), css = source("./index.css");

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
  assert.equal((source("./components/VoiceInputDialog.tsx").match(/\{copy.privacyCompact\}/g) || []).length, 1);
  assert.equal((source("./components/VoiceInputDialog.tsx").match(/className="voice-helper"/g) || []).length, 1);
  for (const phrase of ["Ask by Voice or Text", "Speak a Question", "Type a Question"]) assert.ok(managedCopy.includes(phrase));
  assert.doesNotMatch(conversation, /말씀하신 내용이 위 입력창에 들어갑니다/);
});

test("Home entry has bilingual visitor help while Concierge keeps safe voice handling", () => {
  const home = source("./pages/HomePage.tsx"), entry = source("./components/RuntimeJourneyEntry.tsx");
  assert.match(home, /<RuntimeJourneyEntry/);
  assert.match(entry, /말로 알려주기/);
  assert.match(entry, /글로 입력하기/);
  assert.match(managedCopy, /Tell us what you need/);
  assert.match(conversation, /useSpeechInput\(voiceDraft, setVoiceDraft,onVoiceFinal,language\)/);
  assert.match(css, /\.voice-helper,[\s\S]*font-size:\s*14px/);
  assert.doesNotMatch(conversation, /concierge-primary-entry|concierge-unified-composer/);
});
