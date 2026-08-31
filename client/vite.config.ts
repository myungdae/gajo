import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // Registration is deliberately owned by the visitor entry. The plugin's
      // HTML transform otherwise injects registerSW.js into every Rollup HTML
      // input, including the authenticated, non-PWA Copilot application.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'branding/*.svg', 'branding/*.png', 'manifest-*.webmanifest'],
      // Small region-specific manifests preserve the path used to install;
      // every region continues to share this one app and service worker.
      manifest: false,
      injectManifest: {
        // Copilot's HTML is never part of the visitor offline application shell.
        // Shared JS chunks remain precached because the visitor bundle needs them.
        globIgnores: ['**/copilot.html','**/guide.html','**/portal.html','**/exkovia.html','**/hapcheon.html','**/unsupported.html'],
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
  build:{rollupOptions:{input:{visitor:resolve(__dirname,'index.html'),exkovia:resolve(__dirname,'exkovia.html'),hapcheon:resolve(__dirname,'hapcheon.html'),unsupported:resolve(__dirname,'unsupported.html'),copilot:resolve(__dirname,'copilot.html'),guide:resolve(__dirname,'guide.html'),portal:resolve(__dirname,'portal.html')}}},
});
