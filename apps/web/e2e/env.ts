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
  // Blank, not absent: Next loads `apps/web/.env` for any variable the process does not define, and a
  // developer's REGISTRATION or S3 settings would lock panels and change what the tests read.
  REGISTRATION: '',
  INSTANCE_NAME: '',
  MCP_ENABLED: '',
  SMTP_HOST: '',
  SMTP_PORT: '',
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  SMTP_FROM: '',
  TRUSTED_PROXIES: '',
} as const;

let nextClient = 0;

/**
 * A caller address of its own for each browser context. Better Auth limits requests per address
 * (20 a minute, 3 per 10 seconds on sign-in), and every test here comes from 127.0.0.1. The server
 * trusts a lone `X-Forwarded-For`, so a context that sends one gets a bucket of its own.
 */
export function clientHeaders(): Record<string, string> {
  nextClient += 1;
  return {
    'X-Forwarded-For': `10.${process.pid % 250}.${Math.floor(nextClient / 250)}.${nextClient % 250}`,
  };
}
