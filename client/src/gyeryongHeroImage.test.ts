import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { REGION_CONFIGS } from "./regionConfig.ts";

test("Gyeryong uses the supplied mountain photo as its approved home background", () => {
  const hero = REGION_CONFIGS.gyeryong.home.hero!;
  assert.equal(hero.image, "/branding/gyeryong-mountain-user-v1.png");
  assert.equal(hero.photoSource, "사용자 제공 계룡 현장사진");
  assert.equal(hero.photoRightsStatus, "APPROVED");
  assert.match(hero.alt!, /계룡의 산 능선/);

  const image = readFileSync(new URL("../public/branding/gyeryong-mountain-user-v1.png", import.meta.url));
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(image.readUInt32BE(16), 515);
  assert.equal(image.readUInt32BE(20), 295);
  assert.ok(statSync(new URL("../public/branding/gyeryong-mountain-user-v1.png", import.meta.url)).size < 200_000);
});
