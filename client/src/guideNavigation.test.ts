import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('./guide-main.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./guide.css', import.meta.url), 'utf8');

test('stable bottom navigation exposes Home and New conversation without a floating pill', () => {
  assert.match(main, /<nav className="guide-navigation" aria-label="Guide 탐색">/);
  assert.match(main, />홈<\/button>/);
  assert.match(main, />새 대화<\/button>/);
  assert.match(css, /\.guide-navigation\{position:fixed[^}]*left:0;right:0;bottom:0[^}]*width:100%/);
  assert.match(css, /border-top:1px solid/);
  assert.doesNotMatch(css, /\.guide-navigation\{[^}]*border-radius/);
  assert.doesNotMatch(css, /\.guide-navigation\{[^}]*transform:translate/);
});

test('Home returns to the landing section while preserving conversation and audience', () => {
  const home = main.slice(main.indexOf('const home ='), main.indexOf('const restart ='));
  assert.match(home, /focus\(\{ preventScroll: true \}\)/);
  assert.match(home, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.doesNotMatch(home, /setMessages|setAudience|setInput|location|reload/);
  assert.match(main, /className="guide-landing"[\s\S]*지역 AI 컨시어지[\s\S]*무엇이 궁금하세요\?[\s\S]*많이 묻는 질문/);
  assert.match(main, /aria-label="이전 질문과 답변"/);
  assert.match(main, /audience === value/);
});

test('New conversation remains separate, explicit, confirmed, and Guide-state-only', () => {
  assert.match(main, /window\.confirm\('이전 질문과 답변을 지우고 새 대화를 시작할까요\?'\)/);
  assert.match(main, /className="guide-new-conversation"/);
  assert.match(main, /disabled=\{messages\.length === 0\}/);
  const restart = main.match(/const restart = \(\) => \{([^\n]+)\};/)?.[1] || '';
  assert.match(restart, /setMessages\(\[\]\)/);
  assert.doesNotMatch(restart, /localStorage|sessionStorage|TripSession|region|reload/);
});

test('bottom bar clearance and controls are safe at 360, 390, 430, and desktop widths', () => {
  assert.match(css, /\.guide-shell\{[^}]*padding:[^;}]*calc\(88px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /padding:[^;}]*calc\(8px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.guide-navigation button\{[^}]*min-height:44px/);
  assert.match(css, /max-width:220px/);
  assert.match(css, /@media\(max-width:520px\)[\s\S]*padding-inline:12px/);
  for (const width of [360, 390, 430]) assert.ok(width <= 520);
});

test('bottom navigation is keyboard accessible with visible labels and focus treatment', () => {
  assert.match(main, /<button type="button" onClick=\{home\} aria-label="Guide 홈으로 이동">홈<\/button>/);
  assert.match(main, /aria-label="새 대화 시작"/);
  assert.match(css, /\.guide-navigation button:focus-visible/);
  assert.match(css, /outline:3px solid/);
});
