/**
 * Seeds a Saldo SQLite file with onboarding settings plus the demo data, so a simulator or device
 * can be inspected without tapping through onboarding.
 *
 * Run with (esbuild bundles it because the workspace packages use extensionless imports, which
 * plain Node ESM cannot resolve):
 *
 *   pnpm --filter mobile seed:db <path-to-saldo.db> [--reset]
 *
 * Without `--reset` an already-seeded file is left untouched; with it every row is dropped first,
 * which is how a change to the demo data reaches a simulator that has already run the seeder.
 *
 * Find the simulator's file with:
 *
 *   xcrun simctl get_app_container <device> io.github.saldo.app data
 *   # then Documents/SQLite/saldo.db inside it
 *
 * The database must already exist, i.e. the app has to have launched once so its migrations ran.
 */
import { type PeriodDef, todayLocal } from '@saldo/core';
import { en } from '@saldo/i18n';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { seedDemoData } from '../src/db/demo';
import { runMaterialiser } from '../src/db/recurrenceService';
import { createRepositories } from '../src/db/repositories/index';
import { schema } from '../src/db/schema';
import { seedFromOnboarding } from '../src/db/seed';

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const target = args.find((arg) => !arg.startsWith('--'));
if (target === undefined) {
  throw new Error('usage: pnpm --filter mobile seed:db <saldo.db> [--reset]');
}

const sqlite = new Database(target);
const db = drizzle(sqlite, { schema });
const repos = createRepositories(db);
/** The seed catalogues name their categories by `seed.*` key (§4.2); resolve them in English. */
const translate = (key: string): string =>
  (en.seed as Record<string, string | undefined>)[key] ?? key;

const today = todayLocal();
/** The demo fixture is written against a pay cycle (§5.2), which is still one of the kinds. */
const PERIOD_DEF: PeriodDef = { kind: 'cycle', startDay: 27 };

if (reset) {
  // Hard delete, not tombstones: this is a development fixture, not a user action.
  for (const table of [
    'transactions',
    'attachments',
    'recurrences',
    'budgets',
    'tags',
    'categories',
    'accounts',
    'settings',
    'kv',
  ]) {
    sqlite.prepare(`delete from ${table}`).run();
  }
}

if (repos.settings.get() === null) {
  seedFromOnboarding(repos, {
    periodKind: PERIOD_DEF.kind,
    cycleStartDay: PERIOD_DEF.startDay,
    currency: 'EUR',
    language: 'system',
    theme: 'system',
    account: { name: 'Conto corrente', type: 'checking', openingBalance: 0, icon: 'landmark' },
    // The demo data brings its own catalogue, so onboarding creates none here.
    selectedCategoryKeys: [],
    translate,
    completedAt: new Date().toISOString(),
    timeZone: 'Europe/Rome',
  });
  for (const category of repos.categories.list()) repos.categories.remove(category.id);
  for (const account of repos.accounts.list()) repos.accounts.remove(account.id);
  seedDemoData(repos, { today, def: PERIOD_DEF, translate });
  runMaterialiser(db, repos, today, PERIOD_DEF);
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
