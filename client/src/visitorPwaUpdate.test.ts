import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('visitor PWA checks for updates and reloads a controlled page without touching trip storage',()=>{
  const source=readFileSync(new URL('./visitorPwa.ts',import.meta.url),'utf8');
  assert.match(source,/registration\.update\(\)/);
  assert.match(source,/controllerchange/);
  assert.match(source,/window\.location\.reload\(\)/);
  assert.doesNotMatch(source,/localStorage\.(?:clear|removeItem)|sessionStorage\.(?:clear|removeItem)|caches\.delete/);
});
