import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { syncRows } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from './read';

let harness: TestDatabase;
let seq = 0;

const HLC = '000000000000001-0000-dev';
const CREATED = '2026-09-10T09:00:00.000Z';

function tag(id: string, name: string) {
  return { id, createdAt: CREATED, updatedAt: HLC, deletedAt: null, name };
}

const settings = {
  id: 'settings',
  createdAt: CREATED,
  updatedAt: HLC,
  deletedAt: null,
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'it',
  theme: 'system',
  onboardingCompletedAt: CREATED,
  timeZone: 'Europe/Rome',
};

async function seedRow(
  userId: string,
  entity: string,
  id: string,
  data: unknown,
  deletedAt: Date | null = null,
): Promise<void> {
  seq += 1;
  await harness.db
    .insert(syncRows)
    .values({ userId, entity, id, updatedAt: HLC, deletedAt, data, seq });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('readUserData', () => {
  it('returns the user’s live rows, typed, in their collections', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada');
    await seedRow(userId, 'settings', 'settings', settings);
    await seedRow(userId, 'tag', 'tag-1', tag('tag-1', 'Vacanza'));
    await seedRow(userId, 'tag', 'tag-2', tag('tag-2', 'Regalo'));

    const data = await readUserData(harness.db, userId);
    expect(data.settings).toEqual(settings);
    expect(data.tags.map((row) => row.name).sort()).toEqual(['Regalo', 'Vacanza']);
    expect(data.transactions).toEqual([]);
  });

  it('has no settings before onboarding, nor after the data is deleted', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada');
    expect((await readUserData(harness.db, userId)).settings).toBeNull();

    await seedRow(userId, 'settings', 'settings', settings, new Date());
    expect((await readUserData(harness.db, userId)).settings).toBeNull();
  });

  it('leaves out tombstones and other users’ rows', async () => {
    const ada = (await createTestSession(harness.db, 'Ada')).userId;
    const bob = (await createTestSession(harness.db, 'Bob')).userId;
    await seedRow(ada, 'tag', 'tag-live', tag('tag-live', 'Viva'));
    await seedRow(ada, 'tag', 'tag-gone', tag('tag-gone', 'Andata'), new Date());
    await seedRow(bob, 'tag', 'tag-bob', tag('tag-bob', 'Di Bob'));

    const data = await readUserData(harness.db, ada);
    expect(data.tags.map((row) => row.id)).toEqual(['tag-live']);
  });

  it('skips a row it cannot read and keeps the rest of the page', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada');
    await seedRow(userId, 'tag', 'tag-ok', tag('tag-ok', 'Buono'));
    await seedRow(userId, 'tag', 'tag-bad', { ...tag('tag-bad', ''), name: 42 });
    await seedRow(userId, 'widget', 'w-1', { id: 'w-1' });

    const data = await readUserData(harness.db, userId);
    expect(data.tags.map((row) => row.id)).toEqual(['tag-ok']);
  });

  it('reads an unreadable settings row with defaults instead of dropping it', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada');
    await seedRow(userId, 'settings', 'settings', { ...settings, language: 'pl' });

    const data = await readUserData(harness.db, userId);
    expect(data.settings).toMatchObject({
      language: 'system',
      currency: 'EUR',
      timeZone: 'Europe/Rome',
    });
  });
});
