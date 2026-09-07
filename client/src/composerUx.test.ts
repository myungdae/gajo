import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = source("./pages/ConciergePage.tsx"), home = source("./pages/HomePage.tsx"), entry = source("./components/RuntimeJourneyEntry.tsx"), runtimeCss = source("./components/runtime-journey.css"), css = source("./index.css");

test("Home owns the primary text and voice entry while Concierge owns results", () => {
  assert.match(home, /<RuntimeJourneyEntry/);
  assert.match(entry, /말로 알려주기/);
  assert.match(entry, /글로 입력하기/);
  assert.match(entry, /<textarea/);
  assert.doesNotMatch(page, /concierge-primary-entry|concierge-unified-composer/);
  assert.equal((page.match(/<VoiceInputDialog /g) || []).length, 1);
});

test("Home text submit and voice entry feed the existing concierge flow", () => {
  assert.match(entry, /onSubmit=\{event=>/);
  assert.match(home, /onSubmit=\{text=>ask\(text,text\)\}/);
  assert.match(home, /voiceRequested:true/);
  assert.match(page, /entryState\?\.voiceRequested/);
  assert.match(page, /openVoice\(\)/);
});
test("composer clears only after success and retains text on failure", () => {
  assert.match(page, /await postConciergeChat[\s\S]*setInput\(""\)[\s\S]*catch/);
  assert.doesNotMatch(page, /if \(!retry\)[\s\S]{0,300}setInput\(""\)/);
  assert.match(page, /conversationAnchor\?\.regionId === region\.id/);
  assert.match(page, /turnId,[\s\S]*conversationalAnchor/);
});
test("Home primary entry is vertical and Concierge does not duplicate it", () => {
  assert.match(runtimeCss, /\.entry-input-actions\{display:flex;flex-direction:column/);
  assert.match(home, /<RuntimeJourneyEntry/);
  assert.doesNotMatch(page, /concierge-primary-entry|concierge-unified-composer/);
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
