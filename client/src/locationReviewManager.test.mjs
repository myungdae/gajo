import test, { after } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
  plugins: [
    {
      name: "location-map-fixture",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/components/LocationPinMap.tsx"))
          return `import React from 'react'; export default function Pin(props){return React.createElement('button',{disabled:!props.editable,onClick:()=>props.onChange({latitude:35.55,longitude:128.05})},'fixture 지도 핀 이동')}`;
      },
    },
  ],
});
const { default: Manager } = await vite.ssrLoadModule(
  "/src/components/LocationReviewManager.tsx",
);
after(async () => vite.close());
const { window, document } = parseHTML(
  '<html><body><div id="root"></div></body></html>',
);
Object.assign(globalThis, {
  window,
  document,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  Event: window.Event,
  IS_REACT_ACT_ENVIRONMENT: true,
  sessionStorage: { getItem: () => "" },
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: window.navigator,
});
const savedFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = savedFetch;
});
const row = () => ({
  id: "fixture-34",
  regionId: "hapcheon",
  displayName: "유성가든식당",
  publicDisplayName: "유성가든식당",
  address: "fixture 주소",
  phone: "055-933-7055",
  current: undefined,
  mapVisible: false,
  needsLocationReview: true,
  mapHiddenReason:
    "위치가 확인되지 않아 지도와 가까운 곳 찾기에는 나오지 않습니다.",
  canWrite: true,
  proposal: null,
  precondition: { expectedVersion: 0, expectedHash: "a".repeat(64) },
  region: { center: { latitude: 35.55, longitude: 128.05 } },
  coordinateEvidence: { verificationStatus: "UNVERIFIED" },
});
const warnings = {
  boundaryKnown: true,
  outsideRegion: false,
  largeMove: false,
  duplicates: [],
  approvalBlocked: false,
};
function button(text) {
  return [...document.querySelectorAll("button")].find((n) =>
    n.textContent.trim().startsWith(text),
  );
}
async function click(text) {
  // Wait for the observable control, including a lazy map's Suspense commit.
  for (let n = 0; !button(text) && n < 100; n++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  const node = button(text);
  assert(node, text);
  assert(!node.disabled, `${text} disabled`);
  await act(async () => {
    node.click();
  });
  await settle();
}
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
async function edit(label, value) {
  const element = [...document.querySelectorAll("label")]
    .find((n) => n.textContent.startsWith(label))
    ?.querySelector("input,textarea,select");
  assert(element, label);
  // Dispatch the React change handler with the same payload as an input event.
  const props =
    element[Object.keys(element).find((k) => k.startsWith("__reactProps$"))];
  await act(async () => props.onChange({ target: { value, checked: value } }));
}

test("manager pin/candidate remain local until reviewed, explicit approval uses a separate action", async () => {
  let current = row();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const body = init.body && JSON.parse(init.body);
    let data;
    if (url.includes("/preview"))
      data = { proposal: body, current: current.current, warnings };
    else if (url.includes("/actions/PROPOSE")) {
      current = {
        ...current,
        proposal: {
          ...body.proposal,
          verificationStatus: "PROPOSED",
          proposedBy: "fixture",
          proposedAt: "2026-09-07",
        },
        warnings,
        precondition: { expectedVersion: 1, expectedHash: "b".repeat(64) },
      };
      data = current;
    } else if (url.includes("/actions/APPROVE")) {
      current = {
        ...current,
        current: { latitude: 35.55, longitude: 128.05 },
        needsLocationReview: false,
        mapVisible: true,
        proposal: { ...current.proposal, verificationStatus: "APPROVED" },
      };
      data = current;
    } else
      data = url.includes("/fixture-34") ? current : { records: [current] };
    return { ok: true, json: async () => data };
  };
  const root = createRoot(document.querySelector("#root"));
  try {
    await act(async () =>
      root.render(
        React.createElement(Manager, {
          regionId: "hapcheon",
          copilotToken: "fixture-token",
        }),
      ),
    );
    await settle();
    assert.match(document.body.textContent, /위치가 확인되지 않아/);
    assert.match(
      document.body.textContent,
      /지도에 표시하려면 위치 확인이 필요합니다/,
    );
    assert.match(document.body.textContent, /검색·상세·전화 기능은 계속 이용/);
    await click("위치정보 보완");
    await settle();
    await click("fixture 지도 핀 이동");
    assert.equal(calls.filter((c) => c.url.includes("/actions/")).length, 0);
    await edit("출처 근거", "https://example.invalid/fixture");
    await edit("변경 사유", "지도 출입구 확인");
    await click("변경 전·후 비교");
    assert.match(document.body.textContent, /35.55, 128.05/);
    await click("검토 요청");
    assert.equal(current.mapVisible, false);
    assert.match(document.body.textContent, /검토 대기/);
    assert.equal(button("승인").disabled, true);
    assert.match(
      document.body.textContent,
      /승인하면 검토한 위치가 공개 지도·거리 계산·길찾기에 반영/,
    );
    assert.match(
      document.body.textContent,
      /승인 후 다른 수정이 생기면 복원할 수 없/,
    );
    await edit("검토 사유", "출처와 지도 검토 완료");
    await edit(" 지도·출처", true);
    await click("승인");
    assert.equal(current.mapVisible, true);
    const mutations = calls.filter((c) => c.url.includes("/actions/"));
    assert.equal(mutations.length, 2);
    assert.match(mutations[0].url, /PROPOSE/);
    assert.match(mutations[1].url, /APPROVE/);
    assert.equal(
      JSON.parse(mutations[1].init.body).precondition.expectedVersion,
      1,
    );
    assert.match(document.body.textContent, /대표명 변경은 기존 이름 검토/);
  } finally {
    await act(async () => root.unmount());
  }
});

test("region change discards previous private rows and stale asynchronous response", async () => {
  let resolveOld;
  globalThis.fetch = async (url) =>
    url.includes("regionId=hapcheon")
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : { ok: true, json: async () => ({ records: [] }) };
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.querySelector("#root"));
  try {
    await act(async () =>
      root.render(
        React.createElement(Manager, {
          regionId: "hapcheon",
          copilotToken: "fixture",
        }),
      ),
    );
    await act(async () =>
      root.render(
        React.createElement(Manager, {
          regionId: "okcheon",
          copilotToken: "fixture",
        }),
      ),
    );
    await act(async () =>
      resolveOld({ ok: true, json: async () => ({ records: [row()] }) }),
    );
    await settle();
    assert(!document.body.textContent.includes("유성가든식당"));
  } finally {
    await act(async () => root.unmount());
  }
});
