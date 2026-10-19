import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.SITE_E2E_PORT ?? 4329);

/**
 * Spec 0.8a: the landing page, built and served as static files, at 1440 and 390 in both themes.
 * `SITE_E2E_SKIP_BUILD=1` reuses the last `dist/`.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `${process.env.SITE_E2E_SKIP_BUILD ? '' : 'pnpm exec astro build && '}pnpm exec astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ASTRO_TELEMETRY_DISABLED: '1' },
  },
});
