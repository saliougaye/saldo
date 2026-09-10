/**
 * Seeds a Saldo SQLite file with onboarding settings plus the demo data, so a simulator or device
 * can be inspected without tapping through onboarding.
 *
 * Run with (esbuild bundles it because the workspace packages use extensionless imports, which
 * plain Node ESM cannot resolve):
 *
 *   pnpm --filter mobile seed:db <path-to-saldo.db>
 *
 * Find the simulator's file with:
 *
 *   xcrun simctl get_app_container <device> io.github.saldo.app data
 *   # then Documents/SQLite/saldo.db inside it
 *
 * The database must already exist, i.e. the app has to have launched once so its migrations ran.
 */
import { todayLocal } from '@saldo/core';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { seedDemoData } from '../src/db/demo';
import { runMaterialiser } from '../src/db/recurrenceService';
import { createRepositories } from '../src/db/repositories/index';
import { schema } from '../src/db/schema';
import { seedFromOnboarding } from '../src/db/seed';

const target = process.argv[2];
if (target === undefined) {
  throw new Error('usage: pnpm --filter mobile seed:db <saldo.db>');
}

const sqlite = new Database(target);
const db = drizzle(sqlite, { schema });
const repos = createRepositories(db);
const today = todayLocal();
const CYCLE_START_DAY = 27;

if (repos.settings.get() === null) {
  seedFromOnboarding(repos, {
    cycleStartDay: CYCLE_START_DAY,
    currency: 'EUR',
    language: 'system',
    theme: 'system',
    account: { name: 'Conto corrente', type: 'checking', openingBalance: 0, icon: 'landmark' },
    // The demo data brings its own catalogue, so onboarding creates none here.
    selectedCategoryKeys: [],
    translate: (key) => key,
    completedAt: new Date().toISOString(),
  });
  for (const category of repos.categories.list()) repos.categories.remove(category.id);
  for (const account of repos.accounts.list()) repos.accounts.remove(account.id);
  seedDemoData(repos, { today, cycleStartDay: CYCLE_START_DAY, translate: (key) => key });
  runMaterialiser(db, repos, today, CYCLE_START_DAY);
}

console.log(
  [
    `currency: ${repos.settings.get()?.currency ?? '-'}`,
    `accounts: ${repos.accounts.list().length}`,
    `categories: ${repos.categories.list().length}`,
    `transactions: ${repos.transactions.list().length}`,
    `budgets: ${repos.budgets.list().length}`,
  ].join('  '),
);
sqlite.close();
