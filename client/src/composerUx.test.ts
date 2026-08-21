import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = source("./pages/ConciergePage.tsx"), css = source("./index.css");

test("AI conversation renders one shared text and voice composer", () => {
  assert.equal((page.match(/<textarea/g) || []).length, 1);
  assert.equal((page.match(/ref=\{voiceButtonRef\}/g) || []).length, 1);
  assert.match(page, /hasCompletedTurn\s*\?\s*"concierge-followup-composer"/);
});
test("typed Enter click and speech preserve the existing send and voice flows", () => {
  assert.match(page, /e\.key === "Enter"[\s\S]*send\(\)/);
  assert.match(page, /onClick=\{\(\) => send\(\)\}/);
  assert.match(page, /onClick=\{toggleListening\}/);
  assert.match(page, /aria-label=\{hasCompletedTurn \? "이어서 물어보기"/);
  assert.match(page, /aria-label=\{hasCompletedTurn \? "질문 전송"/);
});
test("persistent composer clears content without replacing conversation state", () => {
  assert.match(page, /setInput\(""\)/);
  assert.match(page, /conversationAnchor\?\.regionId === region\.id/);
  assert.match(page, /turnId,[\s\S]*conversationalAnchor/);
});
test("composer sits above navigation with safe clearance and one scroll surface", () => {
  assert.match(css, /\.concierge-followup-composer\{position:absolute/);
  assert.match(css, /bottom:calc\(58px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.has-persistent-composer\{padding-bottom:88px\}/);
  assert.doesNotMatch(css, /\.concierge-followup-composer\{[^}]*overflow-y:scroll/);
});
test("360 390 430 and desktop widths retain compact 44px controls without overflow", () => {
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(css, /@media\(max-width:380px\)/);
  assert.match(css, /@media\(min-width:700px\)/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 44px 44px/);
  assert.match(css, /max-width:680px/);
});
test("resolved-turn focus is conservative and targets the current result", () => {
  assert.match(page, /followCurrentTurnRef/);
  assert.match(page, /scrollHeight - scrollSurface\.scrollTop - scrollSurface\.clientHeight < 280/);
  assert.match(page, /currentResultRef\.current\?\.scrollIntoView/);
  assert.match(page, /currentTurnConversationRef\.current\?\.scrollIntoView/);
});
