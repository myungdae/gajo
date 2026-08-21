import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration is deliberately owned by the visitor entry. The plugin's
      // HTML transform otherwise injects registerSW.js into every Rollup HTML
      // input, including the authenticated, non-PWA Copilot application.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'branding/regional-ai-icon-192.png', 'branding/gajo-ai-icon-512.png', 'manifest-*.webmanifest'],
      // Small region-specific manifests preserve the path used to install;
      // every region continues to share this one app and service worker.
      manifest: false,
      workbox: {
        // Copilot's HTML is never part of the visitor offline application shell.
        // Shared JS chunks remain precached because the visitor bundle needs them.
        globIgnores: ['**/copilot.html'],
        // Never cache the app shell/service worker itself stale — always
        // revalidate index.html and the API so PWA users see fresh builds
        // (lesson learned from the sibling report.odex.kr project).
        navigateFallbackDenylist: [/^\/api\//, /^\/copilot(?:\.html)?$/],
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
  build:{rollupOptions:{input:{visitor:resolve(__dirname,'index.html'),copilot:resolve(__dirname,'copilot.html')}}},
});
