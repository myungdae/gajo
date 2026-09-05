import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGION_CONFIGS, REGION_HOME_ENGLISH } from "./regionConfig.ts";
import { MANAGED_VISITOR_COPY } from './managedVisitorCopy.ts';

const detail=readFileSync(new URL("./pages/MeteorCraterPage.tsx",import.meta.url),"utf8"), korean="5만 년 전 운석 충돌이 만든 거대한 분지", legacy=["5만 년 전 운석","이 만든"].join("");

test("Regional Home welcomes the whole region while crater detail keeps its factual headline",()=>{
  assert.equal(REGION_CONFIGS.hapcheon.home.hero?.title,"수려한 합천에 오신 것을 환영합니다");
  assert.deepEqual(REGION_CONFIGS.hapcheon.home.hero?.titleLines,["수려한 합천에","오신 것을 환영합니다"]);
  assert.equal(REGION_CONFIGS.hapcheon.home.hero?.description,"필요한 순간, 먼저 찾아오는 AI 여행 동행자");
  assert.match(detail, /<h1>\{text\('craterTitle'\)\}<\/h1>/);
  assert.equal(MANAGED_VISITOR_COPY.craterTitle.ko, korean);
  assert.doesNotMatch(detail,new RegExp(legacy));
});

test("English home welcome stays separate from the reviewed crater detail",()=>{
  assert.equal(REGION_HOME_ENGLISH.hapcheon.spotlight?.title,"Welcome to Beautiful Hapcheon");
  assert.equal(MANAGED_VISITOR_COPY.craterTitle.en,"A 50,000-Year-Old Meteorite Impact Basin");
});
