import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '가조 AI 컨시어지',
        short_name: '가조컨시어지',
        description: '거창 가조 온천단지 에이전틱 AI 디지털 컨시어지',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        // TODO: replace with real PNG icons (192/512) before production
        // launch; omitted for now since only favicon.svg exists in public/.
        icons: [],
      },
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
