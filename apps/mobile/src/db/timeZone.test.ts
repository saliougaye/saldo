import { eq } from 'drizzle-orm';
import { yieldSettingsToAccount } from './adopt';
import { settings } from './schema';
import { createTestContext } from './testing';
import { backfillTimeZone } from './timeZone';

const SETTINGS_INPUT = {
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'system',
  theme: 'system',
  onboardingCompletedAt: '2026-09-25T10:00:00.000Z',
} as const;

function markSynced(context: ReturnType<typeof createTestContext>) {
  context.db.update(settings).set({ syncState: 0 }).where(eq(settings.id, 'settings')).run();
}

describe('backfillTimeZone', () => {
  it('fills a synced row that has no zone, and marks it for the next push', () => {
    const context = createTestContext();
    context.repos.settings.create(SETTINGS_INPUT);
    markSynced(context);

    expect(backfillTimeZone(context.db, context.repos, 'Europe/Rome')).toBe(true);
    expect(context.repos.settings.get()?.timeZone).toBe('Europe/Rome');
    const [row] = context.db.select().from(settings).all();
    expect(row?.syncState).toBe(1);
  });

  it('waits while the row is pending, so a yielded row keeps losing to the account’s', () => {
    const context = createTestContext();
    context.repos.settings.create(SETTINGS_INPUT);
    yieldSettingsToAccount(context.db, context.kv.deviceId());
    const [before] = context.db.select().from(settings).all();

    expect(backfillTimeZone(context.db, context.repos, 'Europe/Rome')).toBe(false);
    const [after] = context.db.select().from(settings).all();
    expect(after?.updatedAt).toBe(before?.updatedAt);
  });
});
