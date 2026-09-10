import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../env';
import { schema } from './schema';
import type { ServerDatabase } from './types';

let pool: Pool | null = null;
let database: ServerDatabase | null = null;

/**
 * One pool per process, created on first use. Route handlers call this; a test that goes through a
 * route handler instead installs a PGlite handle with `setDatabaseForTests`.
 */
export function getDb(): ServerDatabase {
  if (database === null) {
    pool = new Pool({ connectionString: env().databaseUrl });
    database = drizzle(pool, { schema });
  }
  return database;
}

export function setDatabaseForTests(handle: ServerDatabase | null): void {
  database = handle;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  database = null;
}
