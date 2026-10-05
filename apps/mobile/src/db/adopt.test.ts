import { shouldApplyRemote } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { yieldSettingsToAccount } from './adopt';
import { settings } from './schema';
import { createTestContext } from './testing';

const SETTINGS_INPUT = {
  periodKind: 'cycle',
  cycleStartDay: 27,
  currency: 'USD',
  language: 'system',
  theme: 'dark',
  onboardingCompletedAt: '2026-09-25T10:00:00.000Z',
} as const;

describe('yieldSettingsToAccount', () => {
  it('lets any settings the account already has win, and still offers the phone’s', () => {
    const context = createTestContext();
    const created = context.repos.settings.create(SETTINGS_INPUT);
    yieldSettingsToAccount(context.db, context.kv.deviceId());

    const [row] = context.db.select().from(settings).where(eq(settings.id, 'settings')).all();
    // Older than anything a real clock writes, so the account's copy wins both ways: the server
    // keeps it on push (stale), and the pull applies it over this one.
    expect(shouldApplyRemote('000000000000001-0000-other', row?.updatedAt ?? null)).toBe(true);
    expect((row?.updatedAt ?? '') < created.updatedAt).toBe(true);
    // Still pending: an account with no settings receives the phone's on the first push.
    expect(row?.syncState).toBe(1);
    expect(row?.currency).toBe('USD');
  });
});
