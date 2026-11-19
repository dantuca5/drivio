import { defineConfig } from '@vite-pwa/assets-generator/config';

/**
 * Icoane pline (fără transparență): iOS le rotunjește singur pe ecranul principal,
 * iar Android le decupează („maskable”). Rulează: npx pwa-assets-generator
 * Icoanele rotunjite și ecranele de pornire: pwa-assets.rounded.config.ts
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [], favicons: [] },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#2F6BEF' } },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: '#2F6BEF' } },
  },
  images: ['public/icon.svg'],
});
