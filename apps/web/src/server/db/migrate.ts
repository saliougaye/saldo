import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { env } from '../env';
import { schema } from './schema';

const migrationsFolder = new URL('../../../drizzle', import.meta.url).pathname;

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
