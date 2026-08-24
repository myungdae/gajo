import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recoverCopilotFromVisitorPwa, isCopilotProductionOrigin } from './copilotSwRecovery.ts';
import { activateCopilotWorkerMigration, installCopilotWorkerMigration } from './copilotSwMigration.ts';

const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const copilot = readFileSync(new URL('../copilot.html', import.meta.url), 'utf8');
const visitor = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
const worker = readFileSync(new URL('./sw.ts', import.meta.url), 'utf8');

test('build config disables multi-page PWA injection while visitor owns registration', () => {
  assert.match(vite, /injectRegister:\s*false/);
  assert.match(worker, /\(\?:copilot\|guide\|portal\)\(\?:\\\.html\)\?/);
  assert.doesNotMatch(copilot, /registerSW|manifest-|vite-plugin-pwa/);
  assert.match(visitor, /registerVisitorPwa\(\)/);
  assert.match(worker, /isCopilotWorkerOrigin\(self\.location\.hostname\)/);
  assert.match(worker, /intentionally installs no Workbox fetch\/navigation handlers/);
});

test('replacement worker takes over and self-destructs only on the Copilot origin', async () => {
  const events: string[] = [];
  const scope = {
    location: { hostname: 'copilot.odex.kr' },
    skipWaiting: async () => { events.push('skipWaiting'); },
    caches: { keys: async () => ['old-visitor-precache', 'old-runtime'], delete: async (name: string) => { events.push(`delete:${name}`); return true; } },
    registration: { unregister: async () => { events.push('unregister'); return true; } },
    clients: {
      claim: async () => { events.push('claim'); },
      matchAll: async () => [{ url: 'https://copilot.odex.kr/', postMessage: () => { events.push('notify'); }, navigate: async () => { events.push('navigate'); } }],
    },
  };
  assert.equal(await installCopilotWorkerMigration(scope), true);
  assert.equal(await activateCopilotWorkerMigration(scope), true);
  assert.deepEqual(events, ['skipWaiting', 'delete:old-visitor-precache', 'delete:old-runtime', 'claim', 'unregister', 'notify', 'navigate']);

  events.length = 0;
  scope.location.hostname = 'gajo.odex.kr';
  assert.equal(await installCopilotWorkerMigration(scope), false);
  assert.equal(await activateCopilotWorkerMigration(scope), false);
  assert.deepEqual(events, []);
});

test('old visitor worker and caches are removed with exactly one controlled reload', async () => {
  let unregisters = 0, reloads = 0;
  const values = new Map<string, string>();
  const deleted: string[] = [];
  const env = {
    serviceWorker: { controller: {} as ServiceWorker, getRegistrations: async () => [{ unregister: async () => { unregisters++; return true; } }] as ServiceWorkerRegistration[] },
    caches: { keys: async () => ['workbox-precache-v2', 'unrelated-cache'], delete: async (name: string) => { deleted.push(name); return true; } },
    sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } },
    reload: () => { reloads++; },
  };
  assert.equal((await recoverCopilotFromVisitorPwa(env)).reloaded, true);
  assert.equal((await recoverCopilotFromVisitorPwa(env)).reloaded, false);
  assert.equal(reloads, 1);
  assert.equal(unregisters, 2);
  assert.deepEqual(deleted, ['workbox-precache-v2', 'workbox-precache-v2']);
});

test('migration hostname guard never targets visitor domains', () => {
  assert.equal(isCopilotProductionOrigin('copilot.odex.kr'), true);
  for (const host of ['gajo.odex.kr', 'hapcheon.odex.kr', 'odex.kr', 'localhost'])
    assert.equal(isCopilotProductionOrigin(host), false);
});
