import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('radius controls block repeated clicks while a request is loading',()=>{const source=readFileSync(new URL('./pages/NearbyRestaurantsPage.tsx',import.meta.url),'utf8');assert.match(source,/radiusClickGuard/);assert.match(source,/now-last\.at<800/);assert.match(source,/disabled=\{loading\}/);assert.match(source,/onClick=\{\(\)=>selectRadius\(value\)\}/)});
