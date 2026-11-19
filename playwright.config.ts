import { defineConfig, devices } from '@playwright/test';

/**
 * Teste cap-coadă în WebKit (motorul Safari) cu profilul iPhone 13 Pro:
 * ecran 390×844, densitate 3x, atingere, agent iOS.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5180',
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone-13-pro-webkit', use: { ...devices['iPhone 13 Pro'], browserName: 'webkit' } },
  ],
  webServer: [
    {
      command: 'npx vite --port 5180 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:5180',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // build-ul de producție (cu lucrătorul offline), pentru testele de instalare și offline
      command: 'npx vite build && npx vite preview --port 5181 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:5181',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
