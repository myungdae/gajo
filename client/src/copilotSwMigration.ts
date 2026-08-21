export const COPILOT_ADMIN_HOSTNAME = 'copilot.odex.kr';

type MigrationClient = {
  url: string;
  postMessage: (message: unknown) => void;
  navigate?: (url: string) => Promise<unknown>;
};

export type WorkerMigrationScope = {
  location: { hostname: string };
  skipWaiting: () => Promise<void>;
  caches: Pick<CacheStorage, 'keys' | 'delete'>;
  registration: Pick<ServiceWorkerRegistration, 'unregister'>;
  clients: {
    claim: () => Promise<void>;
    matchAll: (options: { type: 'window'; includeUncontrolled: true }) => Promise<MigrationClient[]>;
  };
};

export const isCopilotWorkerOrigin = (hostname: string) =>
  hostname === COPILOT_ADMIN_HOSTNAME;

export async function installCopilotWorkerMigration(scope: WorkerMigrationScope) {
  if (!isCopilotWorkerOrigin(scope.location.hostname)) return false;
  await scope.skipWaiting();
  return true;
}

export async function activateCopilotWorkerMigration(scope: WorkerMigrationScope) {
  if (!isCopilotWorkerOrigin(scope.location.hostname)) return false;

  const cacheNames = await scope.caches.keys();
  await Promise.allSettled(cacheNames.map((name) => scope.caches.delete(name)));
  await scope.clients.claim();
  await scope.registration.unregister();

  const clients = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.allSettled(
    clients.map(async (client) => {
      client.postMessage({ type: 'COPILOT_VISITOR_SW_REMOVED' });
      await client.navigate?.(client.url);
    }),
  );
  return true;
}
