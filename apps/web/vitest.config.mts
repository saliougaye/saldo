import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'app/**/*.test.ts'],
    // The server reads its configuration through `src/server/env.ts`, which validates it with Zod
    // and fails closed. Tests get a complete, obviously-fake configuration.
    env: {
      PUBLIC_URL: 'http://localhost:3000',
      WEBAUTHN_RP_ID: 'localhost',
      WEBAUTHN_RP_NAME: 'Saldo test',
      JWT_SECRET: 'dGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQ=',
      DATABASE_URL: 'postgres://saldo:saldo@localhost:5432/saldo_test',
      STORAGE_DIR: '/tmp/saldo-test-attachments',
      REGISTRATION: 'open',
      APP_REDIRECT_SCHEMES: 'saldo',
    },
  },
});
