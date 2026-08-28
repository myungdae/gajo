export type ResponseAnchor = HTMLElement & {
  scrollIntoView(options?: ScrollIntoViewOptions): void;
};

export function alignCompletedResponse(
  answer: ResponseAnchor | null,
  shouldFollow: () => boolean,
  behavior: ScrollBehavior = "smooth",
) {
  if (!answer || !shouldFollow()) return false;
  const reducedMotion =
    behavior === "smooth" &&
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  answer.scrollIntoView({
    behavior: reducedMotion ? "auto" : behavior,
    block: "start",
    inline: "nearest",
  });
  answer.focus({ preventScroll: true });
  return true;
}

export function stabilizeCompletedResponse(
  answer: ResponseAnchor | null,
  shouldFollow: () => boolean,
  durationMs = 2500,
) {
  if (!answer || typeof ResizeObserver === "undefined") return () => {};
  let frame = 0;
  const observer = new ResizeObserver(() => {
    if (!shouldFollow()) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() =>
      alignCompletedResponse(answer, shouldFollow, "auto"),
    );
  });
  observer.observe(answer);
  const responseRegion = answer.closest?.(".concierge-conversation");
  if (responseRegion && responseRegion !== answer) observer.observe(responseRegion);
  const timer = setTimeout(() => observer.disconnect(), durationMs);
  return () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}
