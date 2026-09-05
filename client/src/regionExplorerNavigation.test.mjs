import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { default: NationwideRegionExplorer } = await vite.ssrLoadModule('/src/components/NationwideRegionExplorer.tsx');
after(async () => { await vite.close(); });

const { window: domWindow, document } = parseHTML('<!doctype html><html><head></head><body><div id="root"></div></body></html>');
class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key) { return this.#values.get(String(key)) ?? null; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  removeItem(key) { this.#values.delete(String(key)); }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
}
const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
Object.assign(globalThis, {
  window: domWindow,
  document,
  HTMLElement: domWindow.HTMLElement,
  Node: domWindow.Node,
  Event: domWindow.Event,
  MouseEvent: domWindow.MouseEvent,
  localStorage,
  sessionStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: domWindow.navigator });

function RoutedExplorer() {
  const { regionId } = useParams();
  return React.createElement(NationwideRegionExplorer, { routeRegionId: regionId, routed: true });
}

const routes = [
  { path: '/regions', element: React.createElement(RoutedExplorer) },
  { path: '/regions/:regionId', element: React.createElement(RoutedExplorer) },
  { path: '/regions/:regionId/*', element: React.createElement(Navigate, { to: '/regions', replace: true }) },
  { path: '/', element: React.createElement(NationwideRegionExplorer) },
];

async function renderAt(initialEntries) {
  document.body.innerHTML = '<div id="root"></div>';
  const router = createMemoryRouter(routes, { initialEntries });
  const root = createRoot(document.querySelector('#root'));
  await act(async () => { root.render(React.createElement(RouterProvider, { router })); });
  return { router, root };
}

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

function regionSummary() {
  return document.querySelector('.region-child-heading')?.textContent?.replace(/\s+/g, ' ').trim();
}

async function selectProvince(name) {
  const button = [...document.querySelectorAll('.region-province-list button')]
    .find((candidate) => candidate.textContent?.includes(name));
  assert.ok(button, `${name} button must exist`);
  await act(async () => { button.click(); });
  await settle();
}

function assertRegion(pathname, label, count, router) {
  assert.equal(router.state.location.pathname, pathname);
  assert.match(regionSummary() ?? '', new RegExp(label));
  assert.match(regionSummary() ?? '', new RegExp(`${count}개 시·군·구`));
}

async function unmount(root) {
  await act(async () => { root.unmount(); });
}

test('route explorer follows back and forward history through production navigation', async () => {
  const { router, root } = await renderAt(['/regions/seoul']);
  assertRegion('/regions/seoul', '서울특별시', 25, router);
  await selectProvince('인천');
  assertRegion('/regions/incheon', '인천광역시', 11, router);
  await selectProvince('제주');
  assertRegion('/regions/jeju', '제주특별자치도', 2, router);
  await act(async () => { await router.navigate(-1); });
  assertRegion('/regions/incheon', '인천광역시', 11, router);
  await act(async () => { await router.navigate(-1); });
  assertRegion('/regions/seoul', '서울특별시', 25, router);
  await act(async () => { await router.navigate(1); });
  assertRegion('/regions/incheon', '인천광역시', 11, router);
  await unmount(root);
});

test('direct routes render the route-owned region selection', async () => {
  for (const [id, label, count] of [
    ['seoul', '서울특별시', 25],
    ['incheon', '인천광역시', 11],
    ['jeju', '제주특별자치도', 2],
    ['sejong', '세종특별자치시', 0],
    ['gwangju-jeonnam', '전남광주통합특별시', 27],
  ]) {
    const { router, root } = await renderAt([`/regions/${id}`]);
    assertRegion(`/regions/${id}`, label, count, router);
    await unmount(root);
  }
  const { router, root } = await renderAt(['/regions/seoul?source=portal']);
  assertRegion('/regions/seoul', '서울특별시', 25, router);
  assert.equal(router.state.location.search, '?source=portal');
  await unmount(root);
});

test('invalid route is replaced by the safe unselected directory without a loop', async () => {
  for (const path of ['/regions/not-a-region', '/regions/SEOUL', '/regions/%E0%A4%A', '/regions/seoul/extra']) {
    const { router, root } = await renderAt([path]);
    await settle();
    assert.equal(router.state.location.pathname, '/regions');
    assert.match(regionSummary() ?? '', /서울특별시/);
    assert.equal(router.state.historyAction, 'REPLACE');
    await unmount(root);
  }
});

test('embedded Portal explorer stays local and does not create route or storage state', async () => {
  const beforeLocal = localStorage.length;
  const beforeSession = sessionStorage.length;
  const { router, root } = await renderAt(['/']);
  await selectProvince('인천');
  assert.equal(router.state.location.pathname, '/');
  assert.match(regionSummary() ?? '', /인천광역시/);
  assert.equal(localStorage.length, beforeLocal);
  assert.equal(sessionStorage.length, beforeSession);
  assert.equal(document.querySelector('link[rel="manifest"]'), null);
  await unmount(root);
});

test('service corsages decorate only live and field-test region cards', async () => {
  for (const [parentId, expectedStatuses] of [
    ['gyeongnam', ['FIELD_TEST', 'AI_LIVE']],
    ['chungbuk', ['FIELD_TEST']],
    ['chungnam', ['FIELD_TEST']],
    ['seoul', []],
  ]) {
    const { root } = await renderAt([`/regions/${parentId}`]);
    const corsages = [...document.querySelectorAll('.region-service-corsage')];
    assert.deepEqual(corsages.map((corsage) => corsage.getAttribute('data-service-status')), expectedStatuses);
    for (const corsage of corsages) {
      assert.equal(corsage.getAttribute('aria-hidden'), 'true');
      assert.equal(corsage.getAttribute('focusable'), 'false');
      assert.equal(corsage.getAttribute('tabindex'), null);
    }
    await unmount(root);
  }
});
