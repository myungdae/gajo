import test from "node:test";
import assert from "node:assert/strict";
import {
  alignCompletedResponse,
  stabilizeCompletedResponse,
  type ResponseAnchor,
} from "./responseScroll.ts";

function anchor() {
  const scrollCalls: ScrollIntoViewOptions[] = [];
  const focusCalls: FocusOptions[] = [];
  return {
    element: {
      scrollIntoView: (options: ScrollIntoViewOptions) =>
        scrollCalls.push(options),
      focus: (options: FocusOptions) => focusCalls.push(options),
    } as unknown as ResponseAnchor,
    scrollCalls,
    focusCalls,
  };
}

test("completed response targets the AI answer start and focuses without a second scroll", () => {
  const answer = anchor();
  const actionButtons = anchor();
  assert.equal(
    alignCompletedResponse(answer.element, () => true),
    true,
  );
  assert.deepEqual(answer.scrollCalls, [
    { behavior: "smooth", block: "start", inline: "nearest" },
  ]);
  assert.deepEqual(answer.focusCalls, [{ preventScroll: true }]);
  assert.equal(actionButtons.scrollCalls.length, 0);
  assert.equal(actionButtons.focusCalls.length, 0);
});

test("user scroll intent prevents both forced scroll and focus", () => {
  const answer = anchor();
  assert.equal(
    alignCompletedResponse(answer.element, () => false),
    false,
  );
  assert.equal(answer.scrollCalls.length, 0);
  assert.equal(answer.focusCalls.length, 0);
});

test("reduced motion uses immediate alignment without changing the focus target", () => {
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = (() => ({ matches: true })) as typeof matchMedia;
  try {
    const answer = anchor();
    alignCompletedResponse(answer.element, () => true);
    assert.equal(answer.scrollCalls[0]?.behavior, "auto");
    assert.deepEqual(answer.focusCalls, [{ preventScroll: true }]);
  } finally {
    globalThis.matchMedia = originalMatchMedia;
  }
});

test("replacement response keeps a live anchor and late resize realigns only while following", () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let resize: ResizeObserverCallback = () => {};
  let disconnected = false;
  class FakeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {
      disconnected = true;
    }
  }
  globalThis.ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver;
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};
  try {
    let following = true;
    const loadingAnchor = anchor();
    const completedAnchor = anchor();
    assert.equal(
      alignCompletedResponse(loadingAnchor.element, () => following),
      true,
    );
    const cleanup = stabilizeCompletedResponse(
      completedAnchor.element,
      () => following,
      10_000,
    );
    resize([], {} as ResizeObserver);
    assert.deepEqual(completedAnchor.scrollCalls, [
      { behavior: "auto", block: "start", inline: "nearest" },
    ]);
    following = false;
    resize([], {} as ResizeObserver);
    assert.equal(completedAnchor.scrollCalls.length, 1);
    cleanup();
    assert.equal(disconnected, true);
  } finally {
    globalThis.ResizeObserver = originalResizeObserver;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  }
});
