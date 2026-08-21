import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("./copilot-main.tsx", import.meta.url), "utf8"),
  css = readFileSync(new URL("./copilot.css", import.meta.url), "utf8"),
  html = readFileSync(new URL("../copilot.html", import.meta.url), "utf8");
test("Copilot is a separate noindex web entry with bearer authentication", () => {
  assert.match(html, /copilot-root/);
  assert.match(html, /noindex,nofollow/);
  assert.match(ui, /Authorization: `Bearer/);
  assert.doesNotMatch(ui, /ADMIN_WRITE_TOKEN|x-admin-token/);
});
test("home exposes real task counts, safe manager queries, and future-limited sections", () => {
  for (const text of [
    "오늘 확인할 일이",
    "정보 변경 의심",
    "신규 업체 후보",
    "검색에서 발견",
    "오늘 뭐부터 할까요",
    "관광객 수요 · 준비 중",
    "관계 관리 · 준비 중",
  ])
    assert.match(ui, new RegExp(text));
});
test("candidate review separates evidence, explanation, review, confirmation, and rejection", () => {
  for (const text of [
    "왜 확인해야 하나요",
    "검색 증거",
    "검토 값",
    "검토 내용 저장",
    "검증하여 활성화",
    "보류",
    "거부",
    'role="alertdialog"',
  ])
    assert.match(ui, new RegExp(text));
});
test("core destination dashboard exposes health, why, safe fix and natural-language queries", () => {
  for (const text of [
    "핵심 장소 점검",
    "핵심 장소 상태 요약",
    "정상",
    "확인 필요",
    "누락",
    "원인 보기",
    "황계폭포는\\s+왜 안",
    "명시적으로 승인하기 전에는 지역 운영정보가 변경되지 않습니다",
    "카테고리 수정 검토",
    "검색 이름 추가",
  ])
    assert.match(ui, new RegExp(text));
});
test("manager UX supports 360 390 430 widths with touch targets and card layouts", () => {
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*1fr\)/);
  assert.match(css, /@media\s*\(min-width:\s*760px\)/);
  assert.match(css, /\.copilot-query input\s*\{[^}]*min-width:\s*0;[^}]*flex:\s*1/);
});
