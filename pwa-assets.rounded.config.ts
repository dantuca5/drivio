import { createAppleSplashScreens, defineConfig } from '@vite-pwa/assets-generator/config';

/**
 * Icoane rotunjite (favicon, manifest „any”) și ecranul de pornire pentru iPhone 13 Pro,
 * în variantă luminoasă și întunecată. Rulează: npx pwa-assets-generator --config pwa-assets.rounded.config.ts
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], padding: 0, favicons: [[48, 'favicon.ico']] },
    maskable: { sizes: [] },
    apple: { sizes: [] },
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.62,
        resizeOptions: { background: '#EDF0F3', fit: 'contain' },
        darkResizeOptions: { background: '#121820', fit: 'contain' },
        linkMediaOptions: { log: false, addMediaScreen: true, basePath: './', xhtml: false },
        png: { compressionLevel: 9, quality: 80 },
        name: (landscape, size, dark) => `apple-splash-${landscape ? 'landscape' : 'portrait'}-${dark ? 'dark' : 'light'}-${size.width}x${size.height}.png`,
      },
      ['iPhone 13 Pro'],
    ),
  },
  images: ['public/icon-rounded.svg'],
});
