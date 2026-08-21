const RECOVERY_MARKER = 'copilot-visitor-sw-recovery-v1';
const VISITOR_CACHE = /workbox|precache|runtime|regional-ai|gajo/i;

type RecoveryEnvironment = {
  serviceWorker?: Pick<ServiceWorkerContainer, 'controller' | 'getRegistrations'>;
  caches?: Pick<CacheStorage, 'keys' | 'delete'>;
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  reload: () => void;
};

export async function recoverCopilotFromVisitorPwa(env: RecoveryEnvironment) {
  const registrations = (await env.serviceWorker?.getRegistrations()) ?? [];
  const removed = (
    await Promise.all(registrations.map((registration) => registration.unregister()))
  ).some(Boolean);
  const cacheNames = (await env.caches?.keys()) ?? [];
  await Promise.all(
    cacheNames
      .filter((name) => VISITOR_CACHE.test(name))
      .map((name) => env.caches!.delete(name)),
  );

  const controlled = Boolean(env.serviceWorker?.controller);
  const alreadyReloaded = env.sessionStorage.getItem(RECOVERY_MARKER) === 'reloaded';
  if (controlled && removed && !alreadyReloaded) {
    env.sessionStorage.setItem(RECOVERY_MARKER, 'reloaded');
    env.reload();
    return { removed, controlled, reloaded: true };
  }
  return { removed, controlled, reloaded: false };
}

export const runCopilotServiceWorkerRecovery = () =>
  recoverCopilotFromVisitorPwa({
    serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    caches: 'caches' in window ? window.caches : undefined,
    sessionStorage: window.sessionStorage,
    reload: () => window.location.reload(),
  });

export const isCopilotProductionOrigin = (hostname: string) =>
  hostname === 'copilot.odex.kr';
