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

test('latest client resolves an old Hapcheon PWA root before session restoration',()=>{
  const main=readFileSync(new URL('./main.tsx',import.meta.url),'utf8'),context=readFileSync(new URL('./RegionContext.tsx',import.meta.url),'utf8');
  assert.match(main,/regionFromLocation\(location\.pathname,location\.search,location\.hostname\)/);
  assert.match(context,/regionFromLocation\(location\.pathname,location\.search,window\.location\.hostname\)/);
  assert.doesNotMatch(`${main}\n${context}`,/localStorage\.(?:clear|removeItem)|sessionStorage\.(?:clear|removeItem)/);
});
