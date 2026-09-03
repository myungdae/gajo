import test from "node:test";
import assert from "node:assert/strict";
import { REGION_CONFIGS } from "./regionConfig.ts";

test("temporary Hapcheon AI image is explicitly identified in metadata and alt text",()=>{
  const hero=REGION_CONFIGS.hapcheon.home.hero!;
  assert.equal(hero.photoRightsStatus,"DEVELOPMENT_ONLY");
  assert.match(hero.photoSource!,/AI 생성 임시 이미지/);
  assert.match(hero.photoSource!,/공식 합천 현장사진 아님/);
  assert.match(hero.alt!,/AI 생성 개발용 이미지/);
});
