import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { env } from '../env';
import { schema } from './schema';

/**
 * Relative to the working directory, which is `apps/web` both for `pnpm --filter web db:migrate`
 * and for the Docker entrypoint. It is deliberately not derived from `import.meta.url`: this file
 * is also bundled to CJS for the image, where that would not resolve.
 */
const migrationsFolder = process.env.SALDO_MIGRATIONS_DIR ?? 'drizzle';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: env().databaseUrl });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });
  await pool.end();
  console.log('[saldo] migrations applied');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
