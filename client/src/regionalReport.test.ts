import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  entrySourceLabel,
  featureLabel,
} from "./regionalReportPresentation.ts";
import {
  canonicalRegionalReportPath,
  regionalReportRegion,
  reportScopeMatchesRoute,
} from "./regionalReportRouting.ts";
const page = readFileSync(
    new URL("./pages/RegionalReportPage.tsx", import.meta.url),
    "utf8",
  ),
  css = readFileSync(
    new URL("./pages/regional-report.css", import.meta.url),
    "utf8",
  ),
  app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const network = readFileSync(
  new URL("./components/RegionalTourismNetwork.tsx", import.meta.url),
  "utf8",
);
test("regional report is read-only, header-authenticated, and has fixed periods", () => {
  assert.match(app, /path="\/regional-report"/);
  assert.match(app, /path="\/:regionId\/regional-report"/);
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
test("regional report canonical routes reuse the registry and reject mismatched scope", () => {
  assert.equal(
    canonicalRegionalReportPath("hapcheon"),
    "/hapcheon/regional-report",
  );
  for (const [regionId, regionName] of [
    ["hapcheon", "합천"],
    ["okcheon", "옥천"],
    ["gajo", "가조"],
  ] as const) {
    assert.equal(
      canonicalRegionalReportPath(regionId),
      `/${regionId}/regional-report`,
    );
    assert.equal(regionalReportRegion(regionId)?.regionName, regionName);
  }
  assert.equal(regionalReportRegion("future-unknown"), undefined);
  assert.equal(reportScopeMatchesRoute("hapcheon", "hapcheon"), true);
  assert.equal(reportScopeMatchesRoute(undefined, "hapcheon"), true);
  assert.equal(reportScopeMatchesRoute("okcheon", "hapcheon"), false);
  assert.equal(reportScopeMatchesRoute("gajo", "hapcheon"), false);
  assert.match(
    page,
    /navigate\(canonicalRegionalReportPath\(responseRegion\.id\)/,
  );
  assert.match(page, /setReport\(undefined\)/);
  assert.match(page, /지원하지 않는 지역 리포트/);
});
test("responsive report supplies touch and focus boundaries", () => {
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /width:\s*(?:1024|1440)px/);
});
test("tourism network uses a fixed privacy-safe 30-day aggregate and accessible cards", () => {
  assert.match(page, /\/regional-report\/network/);
  for (const label of [
    "익명·집계 기반 지역 관광 연결망",
    "같은 익명 이용 흐름에서 함께 관찰된 연결",
    "연결 이벤트 횟수",
    "이동 의도 연결",
    "현장 QR 확인",
    "검증된 혜택 이용",
    "연결 데이터 준비 중",
  ])
    assert.match(network, new RegExp(label));
  assert.match(network, /최근 완료된 30일/);
  assert.match(network, /network-cards/);
  assert.doesNotMatch(
    network,
    /실제 방문자|순 방문자|매출 발생|GPS로 확인된 도착/,
  );
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
