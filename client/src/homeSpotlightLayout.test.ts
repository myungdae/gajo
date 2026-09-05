import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("./pages/HomePage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./home.css", import.meta.url), "utf8");

test("Hapcheon renders its third welcome line inside the visible spotlight card", () => {
  assert.match(home, /spotlightQuestion=region\.id === "hapcheon"/);
  assert.match(home, /className="spotlight-question">\{spotlightQuestion\}/);
});

test("mobile spotlight height follows content and reserves a shorter canvas only for images", () => {
  assert.match(css, /\.spotlight-card\{min-height:0/);
  assert.match(css, /\.spotlight-card\.has-image\{min-height:330px/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.spotlight-card\.has-image\{min-height:280px/);
  assert.doesNotMatch(css, /min-height:360px/);
});
