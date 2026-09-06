import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
  plugins: [{
    name: 'fixture-map',
    enforce: 'pre',
    load(id) {
      if (id.replaceAll('\\\\', '/').endsWith('/components/LocationPinMap.tsx'))
        return 'export default function Map(){return null}';
    },
  }],
});
after(() => vite.close());
const { default: AdminEntry } = await vite.ssrLoadModule('/src/pages/AdminEntry.tsx');
const { api } = await vite.ssrLoadModule('/src/api/client.ts');
const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>');
const values = new Map();
const storage = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
Object.assign(window, {
  location: { hostname: 'localhost', pathname: '/admin', search: '', href: 'http://localhost/admin' },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});
window.HTMLElement.prototype.scrollIntoView = () => {};
Object.assign(globalThis, {
  window,
  document,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  Event: window.Event,
  sessionStorage: storage,
  localStorage: storage,
  requestAnimationFrame: (fn) => fn(),
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
const savedFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = savedFetch;
});

const regions = [
  { id: 'hapcheon', regionName: '합천', serviceName: '합천 여행안내' },
  { id: 'gyeryong', regionName: '계룡', serviceName: '계룡 여행안내' },
];
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
async function change(selector, value) {
  const node = document.querySelector(selector);
  assert(node, selector);
  const props = node[Object.keys(node).find((key) => key.startsWith('__reactProps$'))];
  await act(async () => props.onChange({ target: { value } }));
  await settle();
}

for (const entry of ['/admin', '/hapcheon/admin'])
  test(entry + ' logs in with account JWT and keeps one authorized region scope', async () => {
    values.clear();
    const calls = [];
    api.defaults.adapter = async (config) => {
      const url = new URL(config.url, 'http://localhost/api/');
      for (const [key, value] of Object.entries(config.params || {}))
        url.searchParams.set(key, value);
      calls.push({ path: url.pathname, region: url.searchParams.get('regionId'), headers: config.headers });
      if (url.pathname.endsWith('/copilot/auth/login'))
        return {
          data: {
            accessToken: 'fixture-jwt',
            principal: { sub: 'manager-1', username: 'manager', role: 'REGIONAL_MANAGER', regions: ['hapcheon', 'gyeryong'] },
          },
          status: 200, statusText: 'OK', headers: {}, config,
        };
      if (url.pathname.endsWith('/admin/regions')) {
        assert.equal(config.headers.Authorization, 'Bearer fixture-jwt');
        return { data: regions, status: 200, statusText: 'OK', headers: {}, config };
      }
      if (url.pathname.endsWith('/admin/dashboard'))
        return { data: { totals: {}, recentContexts: [], recentRecommendations: [], recentReservations: [] }, status: 200, statusText: 'OK', headers: {}, config };
      if (url.pathname.endsWith('/admin/regional-data'))
        return { data: { records: [], quality: { totalActive: 1 } }, status: 200, statusText: 'OK', headers: {}, config };
      if (url.pathname.endsWith('/admin/regional-spotlights') || url.pathname.endsWith('/admin/businesses'))
        return { data: [], status: 200, statusText: 'OK', headers: {}, config };
      return { data: null, status: 200, statusText: 'OK', headers: {}, config };
    };
    globalThis.fetch = async (url, init) => {
      calls.push({ path: new URL(url, 'http://localhost').pathname, headers: init.headers });
      return { ok: true, json: async () => ({ records: [] }) };
    };

    document.body.innerHTML = '<div id="root"></div>';
    const router = createMemoryRouter(
      [
        { path: '/admin', element: React.createElement(AdminEntry) },
        { path: '/:regionId/admin', element: React.createElement(AdminEntry) },
      ],
      { initialEntries: [entry] },
    );
    const root = createRoot(document.querySelector('#root'));
    try {
      await act(async () => root.render(React.createElement(RouterProvider, { router })));
      await settle();
      assert.match(document.body.textContent, /아이디/);
      assert.equal(document.body.textContent.includes('관리자 인증'), false);
      assert.equal(calls.length, 0);

      const usernameInput = document.querySelector('input[name="username"]');
      const passwordInput = document.querySelector('input[name="password"]');
      assert(usernameInput, 'username input');
      assert(passwordInput, 'password input');
      assert.equal(usernameInput.autocomplete || usernameInput.getAttribute('autocomplete'), 'username');
      assert.equal(passwordInput.autocomplete || passwordInput.getAttribute('autocomplete'), 'current-password');
      await change('input[name="username"]', 'manager');
      await change('input[name="password"]', 'secret');
      const form = document.querySelector('form');
      const props = form[Object.keys(form).find((key) => key.startsWith('__reactProps$'))];
      await act(async () => props.onSubmit({ preventDefault() {} }));
      await settle();

      assert.equal(values.get('copilot-access-token'), 'fixture-jwt');
      assert.equal(values.has('admin-write-token'), false);
      if (entry === '/admin') await change('select[aria-label="관리 지역"]', 'hapcheon');
      assert.match(document.body.textContent, /현재 관리 지역: 합천/);
      assert.match(document.body.textContent, /합천 업소 관리/);

      await change('select[aria-label="관리 지역"]', 'gyeryong');
      assert.equal(router.state.location.pathname, '/admin');
      assert.equal(new URLSearchParams(router.state.location.search).get('regionId'), 'gyeryong');
      assert.match(document.body.textContent, /현재 관리 지역: 계룡/);
      assert(calls.filter((call) => call.region).every((call) => call.region === 'hapcheon' || call.region === 'gyeryong'));
    } finally {
      await act(async () => root.unmount());
      router.dispose();
    }
  });
