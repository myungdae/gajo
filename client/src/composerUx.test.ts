import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = source("./pages/ConciergePage.tsx"), css = source("./index.css");

test("AI conversation renders one shared text and voice composer", () => {
  assert.equal((page.match(/<textarea/g) || []).length, 1);
  assert.equal((page.match(/<VoiceInputDialog /g) || []).length, 1);
  assert.match(page, /concierge-input-panel concierge-unified-composer/);
  assert.doesNotMatch(page, /"concierge-followup-composer"/);
});
test("typed Enter click and speech preserve the existing send and voice flows", () => {
  assert.match(page, /e\.key\s*===\s*"Enter"[\s\S]*send\(\)/);
  assert.match(page, /onClick=\{\(\) => send\(\)\}/);
  assert.match(page, /onClick=\{openVoice\}/);assert.match(page,/const openVoice=.*setVoiceOpen\(true\);beginVoice\(\)/);
  assert.match(page, /aria-label=\{hasCompletedTurn \? "이어서 물어보기"/);
  assert.match(page, /aria-label=\{hasCompletedTurn \? "질문 전송"/);
});
test("composer clears only after success and retains text on failure", () => {
  assert.match(page, /await postConciergeChat[\s\S]*setInput\(""\)[\s\S]*catch/);
  assert.doesNotMatch(page, /if \(!retry\)[\s\S]{0,300}setInput\(""\)/);
  assert.match(page, /conversationAnchor\?\.regionId === region\.id/);
  assert.match(page, /turnId,[\s\S]*conversationalAnchor/);
});
test("unified composer is large, inline, and does not overlap bottom navigation", () => {
  assert.match(css, /\.concierge-input-panel\s*\{[\s\S]*?position:\s*static/);
  assert.match(css, /\.concierge-input-panel textarea\s*\{[\s\S]*?min-height:\s*132px/);
  assert.match(page, /내 여행으로 돌아가기/);
});
test("360 390 430 and desktop widths retain compact 44px controls without overflow", () => {
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
  assert.match(css, /@media\s*\(min-width:\s*700px\)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*concierge-unified-composer/);
});
test("resolved-turn focus is conservative and targets the current result", () => {
  assert.match(page, /followCurrentTurnRef/);
  assert.match(page, /scrollHeight\s*-\s*scrollSurface\.scrollTop\s*-\s*scrollSurface\.clientHeight\s*<\s*280/);
  assert.match(page, /currentAnswerRef/);
  assert.match(page, /alignCompletedResponse/);
  assert.match(page, /stabilizeCompletedResponse/);
  assert.match(page, /currentTurnConversationRef\.current\?\.scrollIntoView/);
  assert.doesNotMatch(page, /currentResultRef/);
  assert.match(css, /\.current-ai-answer-anchor\s*\{[\s\S]*scroll-margin-top:/);
});
test("primary place content precedes follow-up actions", () => {
  assert.match(page, /visibleEntities = discovery\.entities\.filter/);
  assert.ok(page.indexOf("<PlaceDiscoveryPanel") < page.indexOf("<AiResponseActions"));
});
test("voice activation cannot resize the Android composer without text content",()=>{assert.match(page,/\[\s*input\s*,\s*hasCompletedTurn\s*\]/);assert.doesNotMatch(page,/\[\s*input\s*,\s*hasCompletedTurn\s*,\s*listening\s*\]|\[\s*listening\s*,\s*input/);assert.match(page,/Math\.min\(\s*Math\.max\(textarea\.scrollHeight\s*,\s*44\)\s*,\s*88\s*\)/);assert.match(css,/max-block-size:\s*88px/);assert.match(css,/max-height:\s*112px/)});
