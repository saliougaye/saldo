import {
  formatHlc,
  parseHlc,
  SYNC_SCHEMA_VERSION,
  type SyncChangeEnvelope,
  transactionSchema,
} from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readPull } from '../sync/pull';
import { applyPush } from '../sync/push';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { FIXTURE_NOW, seedOnboarded } from './fixtures';
import { saveTransaction } from './transactions';

let harness: TestDatabase;

const expense = {
  id: null,
  kind: 'expense',
  buffer: '48.2',
  date: '2026-09-28',
  accountId: 'acc-main',
  toAccountId: null,
  categoryId: 'seed-category-groceries',
  description: 'Esselunga',
  tagIds: [],
  excludeFromTotals: false,
};

/** A phone whose clock runs 12h ahead of the server: within the 24h §8.2 allows. */
const PHONE_AHEAD_MS = 12 * 3600 * 1000;

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

describe('a web write, through the sync endpoints', () => {
  it('reaches the pull with the server stamp, and LWW holds both ways', async () => {
    const userId = (await createTestSession(harness.db)).userId;
    await seedOnboarded(harness.db, userId);

    // 1. The web creates a transaction; a phone pulling from 0 receives it with the server stamp.
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    const first = await readPull(harness.db, userId, { since: 0, limit: 500 });
    const pulled = first.changes.find(
      (change) => change.entity === 'transaction' && change.id === created.id,
    );
    if (pulled === undefined) throw new Error('the pull did not return the transaction');
    const serverStamp = parseHlc(pulled.updatedAt);
    expect(serverStamp.deviceId).toMatch(/^server-/);
    expect(serverStamp.wallMs).toBe(FIXTURE_NOW.getTime());
    expect(pulled.deletedAt).toBeNull();
    const received = transactionSchema.parse(pulled.data);
    expect(received).toMatchObject({ id: created.id, amount: 4820, updatedAt: pulled.updatedAt });

    // 2. The phone edits the row with a clock ahead of the server's and pushes it: it wins.
    const phoneStamp = formatHlc({
      wallMs: FIXTURE_NOW.getTime() + PHONE_AHEAD_MS,
      counter: 0,
      deviceId: 'phone-a',
    });
    expect(phoneStamp > pulled.updatedAt).toBe(true);
    const phoneEdit: SyncChangeEnvelope = {
      entity: 'transaction',
      id: created.id,
      updatedAt: phoneStamp,
      deletedAt: null,
      data: transactionSchema.parse({
        ...received,
        amount: 1250,
        description: 'Dal telefono',
        updatedAt: phoneStamp,
      }),
    };
    const pushed = await applyPush(
      harness.db,
      userId,
      { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'phone-a', changes: [phoneEdit] },
      FIXTURE_NOW,
    );
    expect(pushed).toEqual([{ entity: 'transaction', id: created.id, status: 'applied' }]);
    expect((await readUserData(harness.db, userId)).transactions).toEqual([
      expect.objectContaining({ id: created.id, amount: 1250, description: 'Dal telefono' }),
    ]);

    // 3. The web edits again, its own wall clock still behind the phone's: the web's edit wins,
    //    because the clock received the phone's stamp before minting its own.
    const edited = await saveTransaction(
      harness.db,
      userId,
      { ...expense, id: created.id, buffer: '60', description: 'Dal web' },
      FIXTURE_NOW,
    );
    expect(edited).toEqual({ ok: true, id: created.id });
    expect((await readUserData(harness.db, userId)).transactions).toEqual([
      expect.objectContaining({ id: created.id, amount: 6000, description: 'Dal web' }),
    ]);

    // 4. The phone pulling from where it stopped receives the web's edit, stamped after its own.
    const second = await readPull(harness.db, userId, { since: first.nextSince, limit: 500 });
    const again = second.changes.find(
      (change) => change.entity === 'transaction' && change.id === created.id,
    );
    if (again === undefined) throw new Error('the pull did not return the web edit');
    expect(again.updatedAt > phoneStamp).toBe(true);
    expect(parseHlc(again.updatedAt).deviceId).toBe(serverStamp.deviceId);
    expect(transactionSchema.parse(again.data)).toMatchObject({
      amount: 6000,
      description: 'Dal web',
      updatedAt: again.updatedAt,
    });
  });
});
