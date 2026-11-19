import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Testele rulează în fusul orar al utilizatorului țintă, ca granițele de zi/lună și ora de vară să fie reale.
process.env.TZ = 'Europe/Bucharest';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { 'virtual:pwa-register/react': new URL('./src/test/pwaRegisterStub.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // Testele de interfață își declară singure mediul cu „// @vitest-environment jsdom”.
    setupFiles: ['src/test/setup.ts'],
  },
});
