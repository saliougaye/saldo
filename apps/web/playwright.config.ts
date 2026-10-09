import { defineConfig, devices } from '@playwright/test';
import { E2E_ORIGIN, E2E_PORT, serverEnv } from './e2e/env';

/** `E2E_DEV=1` runs `next dev` (no build, slower pages); `E2E_SKIP_BUILD=1` reuses the last `.next`. */
function nextCommand(): string {
  if (process.env.E2E_DEV) return `pnpm exec next dev -p ${E2E_PORT}`;
  const start = `pnpm exec next start -p ${E2E_PORT}`;
  return process.env.E2E_SKIP_BUILD ? start : `pnpm exec next build && ${start}`;
}

/**
 * End-to-end tests of the web app (TODO.md). One database and one server for the whole run: the
 * `setup` project walks the first-run wizard, and every other spec starts from the instance it leaves.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // No retries: every test registers a member with a fixed e-mail address in one shared database, so a retry
  // would fail on «e-mail taken» and hide the first error.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: E2E_ORIGIN,
    trace: 'retain-on-failure',
    locale: 'it-IT',
  },
  projects: [
    { name: 'setup', testMatch: '01-setup.spec.ts', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium',
      testIgnore: '01-setup.spec.ts',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx e2e/dbServer.ts',
      wait: { stdout: /database ready/ },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: nextCommand(),
      url: `${E2E_ORIGIN}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...serverEnv },
    },
  ],
});
