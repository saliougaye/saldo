import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { finishWebOnboarding } from './onboarding';

let harness: TestDatabase;
const NOW = new Date('2026-09-29T10:00:00.000Z');

const DRAFT = {
  periodKind: 'cycle',
  cycleStartDay: 27,
  currency: 'EUR',
  accountName: 'Conto corrente',
  accountType: 'checking',
  balanceBuffer: '1250.5',
  selectedCategoryKeys: ['groceries', 'restaurants'],
  timeZone: 'Europe/Rome',
};

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

describe('finishWebOnboarding', () => {
  it('writes settings, the first account and the seed with the ids every device uses', async () => {
    const { userId } = await createTestSession(harness.db);
    expect(await finishWebOnboarding(harness.db, userId, DRAFT, 'it', NOW)).toEqual({ ok: true });
    const data = await readUserData(harness.db, userId);
    expect(data.settings).toMatchObject({
      periodKind: 'cycle',
      cycleStartDay: 27,
      currency: 'EUR',
      language: 'system',
      theme: 'system',
      timeZone: 'Europe/Rome',
      onboardingCompletedAt: NOW.toISOString(),
    });
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0]).toMatchObject({
      name: 'Conto corrente',
      type: 'checking',
      openingBalance: 125050,
      icon: 'landmark',
    });
    const ids = data.categories.map((category) => category.id);
    expect(ids).toContain('seed-category-groceries');
    expect(ids).toContain('seed-category-supermarket');
    expect(ids).toContain('seed-category-restaurants');
    // Hidden seed rows are created regardless; unselected ones are not.
    expect(ids).toContain('seed-category-refunds');
    expect(ids).not.toContain('seed-category-home');
    expect(
      data.categories.find((category) => category.id === 'seed-category-groceries')?.name,
    ).toBe('Spesa');
  });

  it('writes nothing over an account that already has settings', async () => {
    const { userId } = await createTestSession(harness.db);
    await finishWebOnboarding(harness.db, userId, DRAFT, 'it', NOW);
    expect(
      await finishWebOnboarding(harness.db, userId, { ...DRAFT, currency: 'USD' }, 'it', NOW),
    ).toEqual({ ok: false, error: 'alreadyOnboarded' });
    const data = await readUserData(harness.db, userId);
    expect(data.settings?.currency).toBe('EUR');
    expect(data.accounts).toHaveLength(1);
  });

  it('saves no time zone when the browser reported one Intl does not know', async () => {
    const { userId } = await createTestSession(harness.db);
    expect(
      await finishWebOnboarding(
        harness.db,
        userId,
        { ...DRAFT, timeZone: 'Mars/Olympus' },
        'it',
        NOW,
      ),
    ).toEqual({ ok: true });
    expect((await readUserData(harness.db, userId)).settings?.timeZone).toBeNull();
  });
});
