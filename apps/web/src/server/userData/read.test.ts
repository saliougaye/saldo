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
