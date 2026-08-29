import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  entrySourceLabel,
  featureLabel,
} from "./regionalReportPresentation.ts";
const page = readFileSync(
    new URL("./pages/RegionalReportPage.tsx", import.meta.url),
    "utf8",
  ),
  css = readFileSync(
    new URL("./pages/regional-report.css", import.meta.url),
    "utf8",
  ),
  app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
test("regional report is read-only, header-authenticated, and has fixed periods", () => {
  assert.match(app, /path="\/regional-report"/);
  assert.match(page, /x-regional-report-token/);
  assert.match(
    page,
    /sessionStorage\.getItem\(["']regional-report-token["']\)/,
  );
  assert.doesNotMatch(page, /query.*token|승인|삭제|수정|download/i);
  for (const label of [
    "오늘",
    "최근 7일",
    "최근 30일",
    "읽기 전용",
    "측정 준비 중",
  ])
    assert.match(page, new RegExp(label));
  assert.match(page, /report\.privacy\.notice/);
  assert.match(
    page,
    /sessionStorage\.removeItem\(["']regional-report-token["']\)/,
  );
});
test("responsive report supplies touch and focus boundaries", () => {
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /width:\s*(?:1024|1440)px/);
});
test("internal report keys always render through Korean allowlists", () => {
  const keys = [
    "quickIntent",
    "freeLanguage",
    "intentRouted",
    "recommendation",
    "map",
    "navigation",
    "phone",
    "booking",
    "website",
  ];
  for (const key of keys) {
    const label = featureLabel(key);
    assert.doesNotMatch(
      label,
      /[a-z][A-Z]|^(?:map|phone|booking|website|navigation|recommendation)$/,
    );
    assert.match(page, /featureLabel\(label\)/);
  }
  for (const key of ["direct", "pension", "unknown-internal-source"])
    assert.doesNotMatch(
      entrySourceLabel(key),
      /[a-z][A-Z]|unknown|internal|source/,
    );
  assert.doesNotMatch(page, />검색 fallback<|오류·fallback/);
});
