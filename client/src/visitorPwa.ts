export const registerVisitorPwa = () => {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    let refreshing = false;
    const controlledAtRegistration = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!controlledAtRegistration || refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    void navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => registration.update())
      .catch(() => undefined);
  });
};
