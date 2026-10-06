import { csvRows, readBackup, settingsSchema, toCsv } from '@saldo/core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT, attachment, CATEGORY, TAG, tx } from '../../../src/features/test/fixtures';
import { syncRows } from '../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { createTestSession, type TestSession } from '../../../src/server/test/session';
import { readUserData } from '../../../src/server/userData/read';
import { GET as backup } from './backup/route';
import { GET as csv } from './csv/route';

let harness: TestDatabase;
let ada: TestSession;
let seq = 0;

const HLC = '000000000000001-0000-dev';
const CREATED = '2026-09-01T10:00:00.000Z';

/** A cycle from the 27th, read in Rome: on the instant below it is already the 11th there. */
const SETTINGS = settingsSchema.parse({
  id: 'settings',
  createdAt: CREATED,
  updatedAt: HLC,
  deletedAt: null,
  periodKind: 'cycle',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'it',
  theme: 'system',
  onboardingCompletedAt: CREATED,
  timeZone: 'Europe/Rome',
});
const NOW = new Date('2026-09-10T22:30:00.000Z');

// Current cycle: 2026-08-27 … 2026-09-26. The one before: 2026-07-27 … 2026-08-26.
const IN_A = tx({ id: 't-in-a', amount: 4500, date: '2026-09-05', tagIds: [TAG.id] });
const IN_B = tx({ id: 't-in-b', amount: 1200, date: '2026-08-27', description: 'Primo giorno' });
const BEFORE = tx({ id: 't-before', amount: 900, date: '2026-08-26' });
const OLD = tx({ id: 't-old', amount: 100, date: '2026-07-01' });
const NEWEST_FIRST = [IN_A, IN_B, BEFORE, OLD];
const CONTEXT = {
  currency: 'EUR',
  accounts: [ACCOUNT],
  categories: [CATEGORY],
  tags: [TAG],
} as const;

async function seedRow(
  userId: string,
  entity: string,
  data: { id: string },
  deletedAt: Date | null = null,
): Promise<void> {
  seq += 1;
  await harness.db
    .insert(syncRows)
    .values({ userId, entity, id: data.id, updatedAt: HLC, deletedAt, data, seq });
}

async function seedBook(userId: string): Promise<void> {
  await seedRow(userId, 'settings', SETTINGS);
  await seedRow(userId, 'account', ACCOUNT);
  await seedRow(userId, 'category', CATEGORY);
  await seedRow(userId, 'tag', TAG);
  // Out of order on purpose: the file's order is the export's, not the table's.
  for (const row of [OLD, IN_A, BEFORE, IN_B]) await seedRow(userId, 'transaction', row);
  await seedRow(userId, 'attachment', attachment('att-1', IN_A.id));
}

const request = (path: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/export/${path}`, { headers });
const asAda = (path: string) => request(path, { authorization: ada.bearer });

/** The body as it was sent: `response.text()` would drop the BOM the file starts with. */
const sent = async (response: Response) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer());

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  // Only the clock: PGlite and Better Auth keep their real timers.
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  ada = await createTestSession(harness.db, 'Ada');
});

afterEach(async () => {
  vi.useRealTimers();
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('the export routes', () => {
  it('answer 401 without a session', async () => {
    await seedBook(ada.userId);
    for (const response of [await backup(request('backup')), await csv(request('csv'))]) {
      expect(response.status).toBe(401);
      expect(response.headers.get('content-disposition')).toBeNull();
    }
  });

  it('answer 409 for an account with no settings: there is nothing to restore into', async () => {
    await seedRow(ada.userId, 'account', ACCOUNT);
    for (const response of [await backup(asAda('backup')), await csv(asAda('csv'))]) {
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: { code: 'nothing_to_export' } });
    }
  });
});

describe('GET /api/export/backup', () => {
  it('sends a file named after the user’s today that readBackup accepts', async () => {
    await seedBook(ada.userId);
    const response = await backup(asAda('backup'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="saldo-backup-2026-09-11.json"',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');

    const result = readBackup(await response.text());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.exportedAt).toBe(NOW.toISOString());
    expect(result.backup.data).toEqual(await readUserData(harness.db, ada.userId));
    expect(result.backup.data.transactions).toHaveLength(4);
    // The attachment's row, not its bytes (§17.1.9).
    expect(result.backup.data.attachments.map((row) => row.id)).toEqual(['att-1']);
  });

  it('holds live rows of this user only', async () => {
    await seedBook(ada.userId);
    await seedRow(
      ada.userId,
      'transaction',
      tx({ id: 't-gone', amount: 1, date: '2026-09-02' }),
      NOW,
    );
    const bob = await createTestSession(harness.db, 'Bob');
    await seedRow(bob.userId, 'transaction', tx({ id: 't-bob', amount: 1, date: '2026-09-02' }));

    const result = readBackup(await (await backup(asAda('backup'))).text());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.data.transactions.map((row) => row.id).sort()).toEqual(
      NEWEST_FIRST.map((row) => row.id).sort(),
    );
  });
});

describe('GET /api/export/csv', () => {
  it('sends every transaction by default, as the phone’s file', async () => {
    await seedBook(ada.userId);
    const response = await csv(asAda('csv'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="saldo-transactions-2026-09-11.csv"',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const expected = toCsv(csvRows(NEWEST_FIRST, CONTEXT));
    expect(await sent(response)).toBe(expected);
    expect(await sent(await csv(asAda('csv?range=all')))).toBe(expected);
  });

  it('range=period keeps the period containing the user’s today', async () => {
    await seedBook(ada.userId);
    const response = await csv(asAda('csv?range=period'));
    expect(response.status).toBe(200);
    expect(await sent(response)).toBe(toCsv(csvRows([IN_A, IN_B], CONTEXT)));
  });
});
