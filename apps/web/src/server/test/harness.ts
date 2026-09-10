import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { resetAuthForTests } from '../auth/auth';
import { setDatabaseForTests } from '../db/client';
import { schema } from '../db/schema';
import type { ServerDatabase } from '../db/types';

const migrationsFolder = new URL('../../../drizzle', import.meta.url).pathname;

export interface TestDatabase {
  db: ServerDatabase;
  /** Empties every table, keeping the schema — cheaper than a fresh PGlite per test. */
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * An in-memory Postgres for route-handler and service tests (§16). PGlite is real Postgres
 * compiled to WASM, so the schema, the `bytea` codec and `text[]` behave as they do in production.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db: PgliteDatabase<typeof schema> = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  setDatabaseForTests(db);
  // The Better Auth instance closes over the handle it was built with, so it has to be rebuilt
  // whenever a fresh database is installed.
  resetAuthForTests();
  return {
    db,
    reset: async () => {
      await db.execute(
        sql`truncate table sync_rows, passkey, session, account, verification, "user" cascade`,
      );
    },
    close: async () => {
      setDatabaseForTests(null);
      resetAuthForTests();
      await client.close();
    },
  };
}
