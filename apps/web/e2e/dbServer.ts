/**
 * The database the end-to-end suite runs against: PGlite (real Postgres compiled to WASM) in
 * memory, migrated, and served over a socket so the Next server's `pg` pool connects to it as it
 * would to any Postgres. Playwright starts it as a `webServer`, before Next.
 *
 *   tsx e2e/dbServer.ts
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { E2E_DB_PORT } from './env';

async function main(): Promise<void> {
  const client = new PGlite();
  await migrate(drizzle(client), {
    migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
  });

  const server = new PGLiteSocketServer({
    db: client,
    port: E2E_DB_PORT,
    host: '127.0.0.1',
    maxConnections: 16,
  });
  await server.start();
  console.log(`[e2e] database ready on ${E2E_DB_PORT}`);

  const stop = async () => {
    await server.stop();
    await client.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
