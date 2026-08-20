import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'branding/regional-ai-icon-192.png', 'branding/gajo-ai-icon-512.png', 'manifest-*.webmanifest'],
      // Small region-specific manifests preserve the path used to install;
      // every region continues to share this one app and service worker.
      manifest: false,
      workbox: {
        // Never cache the app shell/service worker itself stale — always
        // revalidate index.html and the API so PWA users see fresh builds
        // (lesson learned from the sibling report.odex.kr project).
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
