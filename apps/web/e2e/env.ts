/** Ports and configuration the end-to-end suite shares between Playwright's config and the tests. */
/** Overridable, so two checkouts (two agents, a worktree) can run the suite side by side. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_DB_PORT = Number(process.env.E2E_DB_PORT ?? 54329);
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;

/** The server's environment: complete, and obviously fake like the vitest one. */
export const serverEnv = {
  PUBLIC_URL: E2E_ORIGIN,
  WEBAUTHN_RP_ID: 'localhost',
  WEBAUTHN_RP_NAME: 'Saldo e2e',
  JWT_SECRET: 'ZTJlLXNlY3JldC1lMmUtc2VjcmV0LWUyZS1zZWNyZXQtZTJl',
  SETTINGS_ENCRYPTION_KEY: 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=',
  DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${E2E_DB_PORT}/postgres`,
  ATTACHMENT_STORAGE: 'none',
  APP_REDIRECT_SCHEMES: 'saldo',
} as const;
