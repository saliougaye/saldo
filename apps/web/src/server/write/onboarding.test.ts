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

  it('names the account in the user’s language when the field was left empty', async () => {
    const { userId } = await createTestSession(harness.db);
    await finishWebOnboarding(harness.db, userId, { ...DRAFT, accountName: '  ' }, 'en', NOW);
    const data = await readUserData(harness.db, userId);
    expect(data.accounts[0]?.name).toBe('Main account');
    expect(
      data.categories.find((category) => category.id === 'seed-category-groceries')?.name,
    ).toBe('Groceries');
  });

  it('keeps a negative opening balance, and an empty one is zero', async () => {
    const { userId } = await createTestSession(harness.db);
    await finishWebOnboarding(
      harness.db,
      userId,
      { ...DRAFT, accountType: 'credit_card', balanceBuffer: '-300' },
      'it',
      NOW,
    );
    expect((await readUserData(harness.db, userId)).accounts[0]).toMatchObject({
      openingBalance: -30000,
      icon: 'card',
    });

    const other = await createTestSession(harness.db, 'Grace');
    await finishWebOnboarding(harness.db, other.userId, { ...DRAFT, balanceBuffer: '' }, 'it', NOW);
    expect((await readUserData(harness.db, other.userId)).accounts[0]?.openingBalance).toBe(0);
  });

  it('refuses a draft that does not parse', async () => {
    const { userId } = await createTestSession(harness.db);
    for (const draft of [
      { ...DRAFT, periodKind: 'fortnight' },
      { ...DRAFT, accountType: 'pocket' },
      { ...DRAFT, balanceBuffer: '12,50' },
      // What the keypad cannot type: too many decimals or integer digits, leading zeros, a sign
      // anywhere but first.
      { ...DRAFT, balanceBuffer: '12.505' },
      { ...DRAFT, balanceBuffer: '1234567' },
      { ...DRAFT, balanceBuffer: '-0012' },
      { ...DRAFT, currency: 'JPY', balanceBuffer: '12.5' },
      { ...DRAFT, selectedCategoryKeys: ['groceries', 'nope'] },
      { ...DRAFT, cycleStartDay: 0 },
      null,
    ]) {
      expect(await finishWebOnboarding(harness.db, userId, draft, 'it', NOW)).toEqual({
        ok: false,
        error: 'invalid',
      });
    }
    expect((await readUserData(harness.db, userId)).settings).toBeNull();
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
