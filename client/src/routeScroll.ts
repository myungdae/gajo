type ScrollTarget = {
  scrollTo(options: ScrollToOptions): void;
};

export function resetShellScroll(
  webShell: boolean,
  main: ScrollTarget | null,
  browserWindow: ScrollTarget = window,
) {
  if (webShell) {
    browserWindow.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return;
  }
  main?.scrollTo({ top: 0, behavior: 'auto' });
}
