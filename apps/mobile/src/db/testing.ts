import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { type Clock, createClock } from './clock';
import { createKvStore, type KvStore } from './kv';
import { createRepositories, type Repositories } from './repositories/index';
import { schema } from './schema';

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'drizzle');

/**
 * The generated migrations applied to an in-memory database, so Node tests run the same SQL the
 * device runs. The Expo driver cannot load outside React Native, hence the second driver.
 */
export function createTestDatabase(): TestDatabase {
  const sqlite = new Database(':memory:');
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    throw new Error('No migrations found; run pnpm --filter mobile db:generate');
  }
  for (const file of files) {
    const statements = readFileSync(join(MIGRATIONS_DIR, file), 'utf8').split(
      '--> statement-breakpoint',
    );
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.exec(trimmed);
    }
  }
  return drizzle(sqlite, { schema });
}

export interface TestContext {
  db: TestDatabase;
  repos: Repositories;
  kv: KvStore;
  clock: Clock;
}

/**
 * A whole device in memory: the migrated database plus the repositories, kv store and HLC clock
 * built over it. Sync tests need all four, and they must be the *same* instances the repositories
 * write through or the clock would fork.
 */
export function createTestContext(createdAt = '2026-04-18T10:00:00.000Z'): TestContext {
  const db = createTestDatabase();
  const kv = createKvStore(db);
  return { db, repos: createRepositories(db, () => createdAt), kv, clock: createClock(kv) };
}
