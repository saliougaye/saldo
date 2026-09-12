import type { Account, Settings } from '@saldo/core';
import { schema } from './schema';
import { createTestContext, type TestContext } from './testing';
import { hasLocalData, wipeDevice } from './wipe';

const SETTINGS_INPUT = {
  periodKind: 'cycle',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'system',
  theme: 'dark',
  onboardingCompletedAt: '2026-09-11T10:00:00.000Z',
} satisfies Omit<Settings, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

const ACCOUNT_INPUT = {
  name: 'Conto corrente',
  type: 'checking',
  institution: null,
  openingBalance: 500000,
  includeInSpendable: true,
  colorIndex: 0,
  icon: 'landmark',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
} satisfies Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** A device that has been used: synced entities, and the device-local keys beside them. */
function fill(context: TestContext): void {
  context.repos.settings.create(SETTINGS_INPUT);
  context.repos.accounts.create(ACCOUNT_INPUT);
  context.repos.tags.create({ name: 'Trasloco' });
  context.kv.set('syncCursor', '42');
  context.kv.set('appLockEnabled', 'true');
  context.kv.deviceId();
}

function totalRows(context: TestContext): number {
  return Object.values(schema).reduce(
    (total, table) => total + context.db.select().from(table).all().length,
    0,
  );
}

describe('hasLocalData', () => {
  it('is false on a fresh install and true once anything is written', () => {
    const context = createTestContext();
    expect(hasLocalData(context.db)).toBe(false);
    context.repos.tags.create({ name: 'Trasloco' });
    expect(hasLocalData(context.db)).toBe(true);
  });

  it('ignores the device keys, which every install has', () => {
    const context = createTestContext();
    context.kv.deviceId();
    context.kv.set('syncCursor', '42');
    // `kv` says who this *device* is, never whose data it holds — counting it would make every
    // phone look occupied.
    expect(hasLocalData(context.db)).toBe(false);
  });

  it('is false again after a wipe', () => {
    const context = createTestContext();
    fill(context);
    wipeDevice(context.db);
    expect(hasLocalData(context.db)).toBe(false);
  });
});

describe('wipeDevice', () => {
  it('empties every table, the device-local ones included', () => {
    const context = createTestContext();
    fill(context);
    // Guard against a test that would pass against an empty database anyway.
    expect(totalRows(context)).toBeGreaterThan(0);

    wipeDevice(context.db);

    expect(totalRows(context)).toBe(0);
  });

  it('forgets who this device is, so it rejoins as a new one', () => {
    const context = createTestContext();
    fill(context);
    const before = context.kv.deviceId();

    wipeDevice(context.db);

    // `deviceId()` mints a fresh id once the row is gone. Keeping the old one would let the next
    // account inherit this device's HLC identity, which is what a reset is undoing.
    expect(context.kv.deviceId()).not.toBe(before);
    expect(context.kv.get('syncCursor')).toBeNull();
    // The lock is a device setting, not an account one: a wiped phone must not stay locked by a
    // passcode belonging to data that is no longer there.
    expect(context.kv.get('appLockEnabled')).toBeNull();
  });

  it('leaves a database the app can immediately use again', () => {
    const context = createTestContext();
    fill(context);

    wipeDevice(context.db);

    // No settings row is what sends the boot router to onboarding (§6.29), and writing the new
    // ones must not collide with anything the wipe left behind.
    expect(context.repos.settings.get()).toBeNull();
    context.repos.settings.create(SETTINGS_INPUT);
    const account = context.repos.accounts.create({ ...ACCOUNT_INPUT, name: 'Nuovo' });
    expect(account.name).toBe('Nuovo');
    expect(context.repos.accounts.list()).toHaveLength(1);
  });
});
