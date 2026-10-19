import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4300);

/**
 * End-to-end tests: `npm run test:e2e`. Builds the client and starts the production server with a fresh demo
 * database (e2e/server.mjs). The tests share that database, so they run one after another.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Zurich',
    trace: 'retain-on-failure',
    launchOptions: {
      // A fake camera and microphone for the call test, without permission prompts.
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'de-DE' } }],
  webServer: {
    command: 'npm run build && node e2e/server.mjs',
    url: `http://localhost:${PORT}/api/health`,
    env: { E2E_PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
  },
});
