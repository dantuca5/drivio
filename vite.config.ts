import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Pe GitHub Pages aplicația stă într-un subfolder (ex. /drivio/); local stă la rădăcină.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // versiunea nouă se instalează doar când utilizatorul apasă „Actualizează” (niciodată în timpul unei curse)
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'apple-splash-*.png', 'icon.svg'],
      manifest: {
        id: base,
        name: 'Drivio – profitul curselor',
        short_name: 'Drivio',
        description: 'Calculează profitul real al fiecărei curse Uber și Bolt: comision, energie, uzură și km până la client.',
        lang: 'ro',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#121820',
        theme_color: '#121820',
        categories: ['finance', 'productivity', 'travel'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // totul (inclusiv fonturile TTF pentru PDF și biblioteca PDF) se salvează pentru folosire offline
        globPatterns: ['**/*.{js,css,html,woff2,woff,ttf,png,svg,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4174 },
});
