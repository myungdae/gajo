import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { default: Network } = await vite.ssrLoadModule('/src/components/ContextResourceNetwork.tsx');
after(async () => { await vite.close(); });
const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>');
Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, Node: window.Node, IS_REACT_ACT_ENVIRONMENT: true });

test('selection keeps only direct evidence highlighted across all five filters', async () => {
  // Synthetic test data only; never returned by the application API.
  const levels = ['RESOURCE_RELATIONSHIP', 'INTEREST', 'MOVEMENT_INTENT', 'VERIFIED_USE'];
  const nodes = ['STAY', 'FOOD', 'CAFE', 'ATTRACTION'].map((kind, i) => ({
    id: String(i), label: `테스트 자원 ${i}`, kind, status: 'VERIFIED', area: 'test', sourceName: 'test',
  }));
  const edges = levels.map(evidenceLevel => ({ source: '0', target: '1', evidenceLevel, relation: evidenceLevel, basis: `test ${evidenceLevel}`, total: 5 }));
  edges.push({ ...edges[1], source: '1', target: '2' }, { ...edges[1], source: '2', target: '3' });
  const data = { nodes, edges, actionPath: ['PLAN', 'NOW'], counts: { total: 4, verified: 4, byKind: {} } };
  function Harness() {
    const [selected, onSelect] = useState();
    return React.createElement(Network, { data, selected, onSelect });
  }
  const root = createRoot(document.querySelector('#root'));
  try {
    await act(async () => { root.render(React.createElement(Harness)); });
    const buttons = [...document.querySelectorAll('.context-graph-toolbar button')];
    assert.deepEqual(buttons.map(b => b.textContent), ['전체', '자원 관계', '관심 행동', '이동 의도', '검증 이용']);
    assert.equal(new Set([...document.querySelectorAll('.context-edge')].slice(0, 4).map(p => p.getAttribute('d'))).size, 4);
    await act(async () => { document.querySelector('[aria-label^="테스트 자원 0,"]').dispatchEvent(new window.Event('click', { bubbles: true })); });
    for (let index = 0; index < buttons.length; index++) {
      await act(async () => { buttons[index].click(); });
      assert.equal(document.querySelector('[aria-label^="테스트 자원 0,"]').getAttribute('aria-pressed'), 'true');
      const paths = [...document.querySelectorAll('.context-edge')];
      assert.equal(paths.filter(p => p.getAttribute('opacity') === '1').length, index === 0 ? 4 : 1);
      assert.equal(document.querySelector('[aria-label^="테스트 자원 2,"]').getAttribute('opacity'), '0.15');
      assert.equal(document.querySelectorAll('.context-evidence p').length, index === 0 ? 4 : 1);
      assert.equal(document.querySelector('.context-empty'), null);
    }
    data.edges = [];
    await act(async () => { root.render(React.createElement(Network, { data: { ...data }, selected: nodes[0], onSelect() {} })); });
    assert.equal(document.querySelectorAll('.context-edge').length, 0);
    assert.match(document.querySelector('.context-evidence').textContent, /직접 연결 근거가 없습니다/);
  } finally {
    await act(async () => { root.unmount(); });
  }
});

test('empty movement and verified use filters show their exact guidance below the graph', async () => {
  const nodes = ['a', 'b'].map(id => ({ id, label: id, kind: 'FOOD', status: 'VERIFIED' }));
  const data = { nodes, edges: [{ source: 'a', target: 'b', relation: 'NEARBY', evidenceLevel: 'RESOURCE_RELATIONSHIP', basis: 'test' }], actionPath: [] };
  const root = createRoot(document.querySelector('#root'));
  try {
    await act(async () => { root.render(React.createElement(Network, { data, onSelect() {} })); });
    for (const [filter, message] of [
      ['이동 의도', '현재 확인된 이동 의도 관계가 없습니다. 길찾기·이동 시작 행동이 확인되면 이곳에 표시됩니다.'],
      ['검증 이용', '현재 확인된 검증 이용 관계가 없습니다. 현장 검증 기준을 충족한 이용이 확인되면 이곳에 표시됩니다.'],
    ]) {
      await act(async () => { [...document.querySelectorAll('.context-graph-toolbar button')].find(b => b.textContent === filter).click(); });
      const notice = document.querySelector('.context-empty');
      assert.equal(notice?.textContent, message);
      assert.equal(notice.getAttribute('role'), 'status');
      assert.ok(document.querySelector('.context-graph-scroll').compareDocumentPosition(notice) & 4);
      assert.equal(document.querySelectorAll('.context-edge').length, 0);
      assert.equal(document.querySelectorAll('.context-resource').length, 2);
    }
  } finally {
    await act(async () => { root.unmount(); });
  }
});
