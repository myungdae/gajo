/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import {
  activateCopilotWorkerMigration,
  installCopilotWorkerMigration,
  isCopilotWorkerOrigin,
  type WorkerMigrationScope,
} from './copilotSwMigration.ts';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

const migrationScope = self as unknown as WorkerMigrationScope;

if (isCopilotWorkerOrigin(self.location.hostname)) {
  // This branch intentionally installs no Workbox fetch/navigation handlers.
  self.addEventListener('install', (event) => {
    event.waitUntil(installCopilotWorkerMigration(migrationScope));
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil(activateCopilotWorkerMigration(migrationScope));
  });
} else {
  self.skipWaiting();
  clientsClaim();
  precacheAndRoute(self.__WB_MANIFEST);
  cleanupOutdatedCaches();
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('index.html'), {
      // Dedicated HTML entries own their own React bootstrap. Returning the
      // visitor shell here would mount App/BrowserRouter at paths it does not
      // own (for example /portal.html) and render a blank routed page.
      denylist: [
        /^\/api\//,
        /^\/(?:copilot|guide|portal)(?:\.html)?$/,
      ],
    }),
  );
  registerRoute(/^\/api\//, new NetworkOnly());
}
