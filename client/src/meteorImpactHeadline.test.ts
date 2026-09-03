import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGION_CONFIGS, REGION_HOME_ENGLISH } from "./regionConfig.ts";

const detail=readFileSync(new URL("./pages/MeteorCraterPage.tsx",import.meta.url),"utf8"), korean="5만 년 전 운석 충돌이 만든 거대한 분지", legacy=["5만 년 전 운석","이 만든"].join("");

test("Regional Home and crater detail share the clarified Korean headline",()=>{
  assert.equal(REGION_CONFIGS.hapcheon.home.hero?.title,korean);
  assert.deepEqual(REGION_CONFIGS.hapcheon.home.hero?.titleLines,["5만 년 전 운석 충돌이 만든","거대한 분지"]);
  assert.match(detail,new RegExp(`<h1>${korean}</h1>`));
  assert.doesNotMatch(detail,new RegExp(legacy));
});

test("reviewed English headline remains unchanged",()=>{
  assert.equal(REGION_HOME_ENGLISH.hapcheon.spotlight?.title,"A 50,000-Year-Old Meteorite Impact Basin");
});
