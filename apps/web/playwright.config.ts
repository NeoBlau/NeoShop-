import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

/**
 * Normally Playwright uses the browser it installed itself. Sandboxes and CI
 * images that ship a pinned Chromium can point at it instead of downloading a
 * second copy.
 */
const CHROMIUM_PATH = process.env.E2E_CHROMIUM_PATH;

/**
 * End-to-end coverage of the paths a person actually walks. The API and the
 * database must be up (`make up && make db-migrate`); the web dev server is
 * started here unless one is already running.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: WEB_URL,
    // The interface follows the browser language. Pin it so the specs can
    // assert on Russian copy regardless of where they run.
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(CHROMIUM_PATH ? { launchOptions: { executablePath: CHROMIUM_PATH } } : {}),
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm run dev',
      url: WEB_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
