import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const brand = read("components/PublicBrand.tsx");
const brandCss = read("components/public-brand.css");
const layout = read("components/Layout.tsx");
const heroCss = read("home.css");
const portal = read("pages/PlatformPortalPage.tsx");
const report = read("pages/RegionalReportPage.tsx");
const selection = read("pages/RegionSelectionPage.tsx");
const adoption = read("pages/RegionAdoptionPage.tsx");
const partner = read("pages/PartnerApplicationPage.tsx");

test("public surfaces share the proactive travel helper brand with EXKOVIA attribution", () => {
  assert.match(brand, /찾아오는 여행도우미/);
  assert.match(brand, /필요한 순간, 먼저 찾아갑니다\./);
  assert.match(brand, /Powered by EXKOVIA/);
  assert.match(layout, /<PublicBrand compact/);
  assert.match(portal, /<PublicBrand \/>/);
  assert.equal((report.match(/<PublicBrand/g) || []).length, 3);
  assert.match(selection, /<PublicBrand\/>/);
  assert.match(adoption, /<PublicBrand\/>/);
  assert.match(partner, /<PublicBrand \/>/);
});

test("brand symbol depicts a lightweight service approaching a traveler without external assets", () => {
  assert.match(brand, /viewBox="0 0 24 24"/);
  assert.match(brand, /aria-hidden="true"/);
  assert.match(brand, /focusable="false"/);
  assert.match(brand, /public-brand__traveler/);
  assert.doesNotMatch(brand, /script|https?:|href=/i);
  assert.match(brandCss, /\.public-brand__symbol[^{]*\{[^}]*width: 28px/);
  assert.match(brandCss, /\.public-brand--compact \.public-brand__symbol[^{]*\{[^}]*width: 23px/);
  assert.match(brandCss, /\.public-brand--compact \.public-brand__slogan[^{]*\{[^}]*display: none/);
  assert.match(brandCss, /\.public-brand:focus-visible/);
  assert.doesNotMatch(brandCss, /gradient|box-shadow|filter:/i);
});

test("mobile regional hero lifts the complete content group without region exceptions", () => {
  const mobile = heroCss.match(/@media\(max-width:430px\)\{([^]*?)\}\n@media/)?.[1] || "";
  assert.match(mobile, /\.home-regional-hero\{min-height:360px;align-items:flex-start\}/);
  assert.match(mobile, /\.home-regional-hero-copy\{padding:30px 18px 24px\}/);
  assert.doesNotMatch(mobile, /hapcheon|okcheon|gajo|hostname/i);
  assert.match(heroCss, /\.home-regional-hero-actions button\{min-height:48px/);
});
