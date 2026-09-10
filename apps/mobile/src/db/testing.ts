import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
