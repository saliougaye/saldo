import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { FIXTURE_NOW, seedOnboarded } from './fixtures';
import { saveSetting } from './settings';
import { writeChanges } from './writeChanges';

let harness: TestDatabase;
let userId: string;

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

async function onboarded() {
  userId = (await createTestSession(harness.db)).userId;
  await seedOnboarded(harness.db, userId);
}

const LATER = new Date('2026-09-30T08:00:00.000Z');

async function settings() {
  const row = (await readUserData(harness.db, userId)).settings;
  if (row === null) throw new Error('no settings row');
  return row;
}

describe('saveSetting', () => {
  it.each([
    [{ key: 'language', value: 'sv' }, { language: 'sv' }],
    [{ key: 'language', value: 'it' }, { language: 'it' }],
    [{ key: 'theme', value: 'dark' }, { theme: 'dark' }],
    [{ key: 'currency', value: 'JPY' }, { currency: 'JPY' }],
    [{ key: 'cycleStartDay', value: 1 }, { cycleStartDay: 1 }],
    [{ key: 'cycleStartDay', value: 28 }, { cycleStartDay: 28 }],
    [{ key: 'timeZone', value: 'Europe/Stockholm' }, { timeZone: 'Europe/Stockholm' }],
  ])('saves %o', async (input, expected) => {
    await onboarded();
    const before = await settings();
    expect(await saveSetting(harness.db, userId, input, LATER)).toEqual({ ok: true });
    const after = await settings();
    expect(after).toMatchObject(expected);
    expect(after.updatedAt).not.toBe(before.updatedAt);
  });

  it('stores the time zone under the id the list holds', async () => {
    await onboarded();
    expect(
      await saveSetting(harness.db, userId, { key: 'timeZone', value: 'Asia/Kolkata' }, LATER),
    ).toEqual({ ok: true });
    expect((await settings()).timeZone).toBe('Asia/Calcutta');
  });

  it.each([
    ['an unknown key', { key: 'periodKind', value: 'week' }],
    ['an unknown language', { key: 'language', value: 'xx' }],
    ['an unknown theme', { key: 'theme', value: 'sepia' }],
    ['an unknown currency', { key: 'currency', value: 'XXX_' }],
    ['a lower-case currency', { key: 'currency', value: 'eur' }],
    ['day 0', { key: 'cycleStartDay', value: 0 }],
    ['day 29', { key: 'cycleStartDay', value: 29 }],
    ['half a day', { key: 'cycleStartDay', value: 1.5 }],
    ['a day as text', { key: 'cycleStartDay', value: '5' }],
    ['a zone Intl does not know', { key: 'timeZone', value: 'Mars/Olympus' }],
    ['an empty zone', { key: 'timeZone', value: '' }],
    ['no value', { key: 'theme' }],
    ['not an object', 'theme'],
  ])('refuses %s', async (_name, input) => {
    await onboarded();
    const before = await settings();
    expect(await saveSetting(harness.db, userId, input, LATER)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(await settings()).toEqual(before);
  });

  it.each([
    [{ key: 'language', value: 'system' }],
    [{ key: 'theme', value: 'system' }],
    [{ key: 'currency', value: 'EUR' }],
    [{ key: 'cycleStartDay', value: 27 }],
    [{ key: 'timeZone', value: 'Europe/Rome' }],
  ])('does not write %o again when it is already so', async (input) => {
    await onboarded();
    const before = await settings();
    expect(await saveSetting(harness.db, userId, input, LATER)).toEqual({ ok: true });
    expect((await settings()).updatedAt).toBe(before.updatedAt);
  });

  it('does not rewrite a zone a phone stored under its other name', async () => {
    await onboarded();
    const { updatedAt: _stamp, ...row } = await settings();
    await writeChanges(
      harness.db,
      userId,
      [{ entity: 'settings', id: 'settings', data: { ...row, timeZone: 'Asia/Kolkata' } }],
      FIXTURE_NOW,
    );
    const before = await settings();
    expect(
      await saveSetting(harness.db, userId, { key: 'timeZone', value: 'Asia/Calcutta' }, LATER),
    ).toEqual({ ok: true });
    expect(await settings()).toEqual(before);
  });
});
